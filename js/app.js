/* ============================================================
   Skyline — live weather app
   Data: Open-Meteo (geocoding, forecast, air quality). No API key.
   ============================================================ */

'use strict';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const STORAGE = { unit: 'skyline.unit', recent: 'skyline.recent' };

const SUGGESTED_CITIES = [
  { name: 'Mumbai', country: 'India', admin1: 'Maharashtra', latitude: 19.076, longitude: 72.8777 },
  { name: 'Delhi', country: 'India', admin1: 'Delhi', latitude: 28.6139, longitude: 77.209 },
  { name: 'Bengaluru', country: 'India', admin1: 'Karnataka', latitude: 12.9716, longitude: 77.5946 },
  { name: 'Hyderabad', country: 'India', admin1: 'Telangana', latitude: 17.385, longitude: 78.4867 },
  { name: 'Chennai', country: 'India', admin1: 'Tamil Nadu', latitude: 13.0827, longitude: 80.2707 },
  { name: 'Kolkata', country: 'India', admin1: 'West Bengal', latitude: 22.5726, longitude: 88.3639 },
  { name: 'Pune', country: 'India', admin1: 'Maharashtra', latitude: 18.5204, longitude: 73.8567 },
  { name: 'Jaipur', country: 'India', admin1: 'Rajasthan', latitude: 26.9124, longitude: 75.7873 }
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

const state = {
  unit: localStorage.getItem(STORAGE.unit) === 'f' ? 'f' : 'c',
  place: null,
  weather: null,
  aqi: null,
  recent: readJSON(STORAGE.recent, []),
  clockTimer: null,
  offset: 0
};

/* ---------------- tiny helpers ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const rand = (a, b) => a + Math.random() * (b - a);
const round = (n, d = 0) => Number(n).toFixed(d);
const round1 = (n) => Math.round(n * 10) / 10;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be blocked */ }
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

/* ---------------- weather codes ---------------- */

function describe(code, isDay) {
  const day = isDay !== 0;
  const c = Number(code);

  if (c === 0) return day
    ? { label: 'Clear sky', icon: 'sun', theme: 'clear-day', fx: 'motes' }
    : { label: 'Clear sky', icon: 'moon', theme: 'clear-night', fx: 'motes' };

  if (c === 1) return day
    ? { label: 'Mostly clear', icon: 'sun', theme: 'clear-day', fx: 'motes' }
    : { label: 'Mostly clear', icon: 'moon', theme: 'clear-night', fx: 'motes' };

  if (c === 2) return day
    ? { label: 'Partly cloudy', icon: 'partly-day', theme: 'clear-day', fx: 'motes' }
    : { label: 'Partly cloudy', icon: 'partly-night', theme: 'clear-night', fx: 'motes' };

  if (c === 3) return { label: 'Overcast', icon: 'cloud', theme: 'cloudy', fx: 'motes' };
  if (c === 45 || c === 48) return { label: c === 48 ? 'Freezing fog' : 'Fog', icon: 'fog', theme: 'fog', fx: 'none' };

  if (c >= 51 && c <= 57) return { label: c >= 56 ? 'Freezing drizzle' : 'Drizzle', icon: 'drizzle', theme: 'rain', fx: 'rain' };
  if (c >= 61 && c <= 67) return { label: c >= 66 ? 'Freezing rain' : (c === 65 ? 'Heavy rain' : 'Rain'), icon: 'rain', theme: 'rain', fx: 'rain' };
  if (c >= 71 && c <= 77) return { label: 'Snowfall', icon: 'snow', theme: 'snow', fx: 'snow' };
  if (c >= 80 && c <= 82) return { label: c === 82 ? 'Violent showers' : 'Rain showers', icon: 'rain', theme: 'rain', fx: 'rain' };
  if (c === 85 || c === 86) return { label: 'Snow showers', icon: 'snow', theme: 'snow', fx: 'snow' };
  if (c >= 95) return { label: c >= 96 ? 'Thunderstorm with hail' : 'Thunderstorm', icon: 'storm', theme: 'thunder', fx: 'storm' };

  return { label: 'Unknown', icon: 'cloud', theme: 'cloudy', fx: 'none' };
}

/* ---------------- icons ---------------- */

let iconSeq = 0;

const RAYS = (() => {
  let out = '<g stroke="#ffb347" stroke-width="5" stroke-linecap="round">';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x1 = 48 + Math.cos(a) * 22, y1 = 46 + Math.sin(a) * 22;
    const x2 = 48 + Math.cos(a) * 31, y2 = 46 + Math.sin(a) * 31;
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" opacity=".9"/>`;
  }
  return out + '</g>';
})();

const CLOUD = 'M26 68h40a13.5 13.5 0 0 0 1.4-26.8 20.5 20.5 0 0 0-38.6-4.9A12.5 12.5 0 0 0 26 68Z';

function iconSVG(name, cls = '') {
  const open = `<svg class="${cls}" viewBox="0 0 96 96" aria-hidden="true" focusable="false">`;
  const close = '</svg>';
  const id = `sk${++iconSeq}`;
  let body = '';

  switch (name) {
    case 'sun':
      body = RAYS + '<circle cx="48" cy="46" r="16" fill="#ffb347"/>';
      break;

    case 'moon':
      body = `
        <defs><mask id="${id}"><rect width="96" height="96" fill="#fff"/>
          <circle cx="73" cy="32" r="24" fill="#000"/></mask></defs>
        <circle cx="48" cy="48" r="27" fill="#f0e6ff" mask="url(#${id})"/>
        <circle cx="26" cy="24" r="2.2" fill="#efdcff" opacity=".9"/>
        <circle cx="72" cy="70" r="1.7" fill="#efdcff" opacity=".75"/>
        <circle cx="30" cy="66" r="1.4" fill="#efdcff" opacity=".6"/>`;
      break;

    case 'partly-day':
      body = `
        <g transform="translate(14 -8) scale(.62)">${RAYS}<circle cx="48" cy="46" r="16" fill="#ffb347"/></g>
        <path d="${CLOUD}" fill="#fdeee6"/>`;
      break;

    case 'partly-night':
      body = `
        <defs><mask id="${id}"><rect width="96" height="96" fill="#fff"/>
          <circle cx="76" cy="18" r="15" fill="#000"/></mask></defs>
        <circle cx="61" cy="30" r="16" fill="#f0e6ff" mask="url(#${id})"/>
        <path d="${CLOUD}" fill="#e6d9e6"/>`;
      break;

    case 'cloud':
      body = `
        <path d="M30 62h34a11 11 0 0 0 1-21.9 17 17 0 0 0-32-4A10 10 0 0 0 30 62Z" fill="#c9aebc" opacity=".55"/>
        <path d="${CLOUD}" fill="#f7e7e0"/>`;
      break;

    case 'fog':
      body = `
        <path d="${CLOUD}" fill="#f0e2e4" opacity=".92"/>
        <g stroke="#d8c2c9" stroke-width="4.5" stroke-linecap="round" opacity=".75">
          <line x1="24" y1="76" x2="54" y2="76"/>
          <line x1="34" y1="85" x2="70" y2="85"/>
        </g>`;
      break;

    case 'drizzle':
      body = `
        <path d="${CLOUD}" fill="#f2e4e9"/>
        <g stroke="#b9a6ff" stroke-width="4.5" stroke-linecap="round">
          <line x1="36" y1="73" x2="33" y2="82"/>
          <line x1="50" y1="73" x2="47" y2="82"/>
          <line x1="64" y1="73" x2="61" y2="82"/>
        </g>`;
      break;

    case 'rain':
      body = `
        <path d="${CLOUD}" fill="#f2e4e9"/>
        <g stroke="#9fb8e6" stroke-width="4.5" stroke-linecap="round">
          <line x1="34" y1="72" x2="27" y2="87"/>
          <line x1="48" y1="72" x2="41" y2="87"/>
          <line x1="62" y1="72" x2="55" y2="87"/>
        </g>`;
      break;

    case 'snow':
      body = `
        <path d="${CLOUD}" fill="#f7f0f3"/>
        <g stroke="#dbe9ff" stroke-width="3" stroke-linecap="round">
          <g transform="translate(34 80)"><line x1="-6" y1="0" x2="6" y2="0"/><line x1="-3" y1="-5" x2="3" y2="5"/><line x1="-3" y1="5" x2="3" y2="-5"/></g>
          <g transform="translate(49 84)"><line x1="-5" y1="0" x2="5" y2="0"/><line x1="-2.5" y1="-4.3" x2="2.5" y2="4.3"/><line x1="-2.5" y1="4.3" x2="2.5" y2="-4.3"/></g>
          <g transform="translate(63 80)"><line x1="-5" y1="0" x2="5" y2="0"/><line x1="-2.5" y1="-4.3" x2="2.5" y2="4.3"/><line x1="-2.5" y1="4.3" x2="2.5" y2="-4.3"/></g>
        </g>`;
      break;

    case 'storm':
      body = `
        <path d="${CLOUD}" fill="#e9dbe6"/>
        <path d="M52 64 36 84h10.5l-4.5 12L64 71H51.5L58 64Z" fill="#ffb347"/>`;
      break;

    default:
      body = `<path d="${CLOUD}" fill="#f7e7e0"/>`;
  }

  return open + body + close;
}

/* ---------------- formatting ---------------- */

function toUnit(celsius) {
  return state.unit === 'f' ? celsius * 9 / 5 + 32 : celsius;
}

function temp(celsius, withUnit = false) {
  if (celsius === null || celsius === undefined || Number.isNaN(celsius)) return '–';
  const v = Math.round(toUnit(celsius));
  return withUnit ? `${v}°${state.unit.toUpperCase()}` : `${v}°`;
}

function hourLabel(iso) {
  const h = Number(iso.slice(11, 13));
  const suffix = h < 12 ? 'am' : 'pm';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${suffix}`;
}

function clockLabel(hour, minute = 0) {
  const h = Number(hour);
  const suffix = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function isoToClock(iso) {
  if (!iso) return '–';
  return clockLabel(Number(iso.slice(11, 13)), Number(iso.slice(14, 16)));
}

function isoToMinutes(iso) {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

function durationLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function dayParts(dateString) {
  const d = new Date(`${dateString}T00:00:00Z`);
  return { day: DAYS[d.getUTCDay()], date: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` };
}

function uvLabel(uv) {
  if (uv === null || uv === undefined) return '';
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very high';
  return 'Extreme';
}

function compassName(deg) {
  if (deg === null || deg === undefined) return '–';
  return COMPASS[Math.round(deg / 22.5) % 16];
}

function windLabel(kmh) {
  if (kmh < 1) return 'Calm';
  if (kmh < 6) return 'Light air';
  if (kmh < 12) return 'Light breeze';
  if (kmh < 20) return 'Gentle breeze';
  if (kmh < 29) return 'Moderate breeze';
  if (kmh < 39) return 'Fresh breeze';
  if (kmh < 50) return 'Strong breeze';
  if (kmh < 62) return 'Near gale';
  if (kmh < 75) return 'Gale';
  return 'Strong gale';
}

function cityTime(offsetSeconds) {
  return new Date(Date.now() + offsetSeconds * 1000);
}

function aqiInfo(aqi) {
  if (aqi === null || aqi === undefined) return { label: 'Unavailable', color: '#a98d9a', note: 'No air quality data for this location.' };
  if (aqi <= 50) return { label: 'Good', color: '#6fcf97', note: 'Air quality is satisfactory — a good day to be outside.' };
  if (aqi <= 100) return { label: 'Moderate', color: '#ffd166', note: 'Acceptable, though sensitive people may notice it.' };
  if (aqi <= 150) return { label: 'Unhealthy for sensitive groups', color: '#ffa14a', note: 'Kids, elderly and asthma patients should limit long outdoor activity.' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ff6b5e', note: 'Everyone may feel effects. Consider a mask outdoors.' };
  if (aqi <= 300) return { label: 'Very unhealthy', color: '#c65cff', note: 'Health alert — avoid outdoor exertion.' };
  return { label: 'Hazardous', color: '#b3405c', note: 'Emergency conditions. Stay indoors if you can.' };
}

/* ---------------- api ---------------- */

async function geocode(query, signal) {
  const params = new URLSearchParams({ name: query, count: '6', language: 'en', format: 'json' });
  const res = await fetch(`${GEO_URL}?${params}`, { signal });
  if (!res.ok) throw new Error('geocoding failed');
  const data = await res.json();

  const results = (data.results || []).map((r) => ({
    name: r.name,
    country: r.country || '',
    admin1: r.admin1 || '',
    latitude: r.latitude,
    longitude: r.longitude
  }));

  // Light local ranking: exact/prefix matches first, Indian cities nudged up
  // (same default focus as the original weather_app.py, which was India-only).
  const q = query.trim().toLowerCase();
  const score = (p) => {
    const name = p.name.toLowerCase();
    let s = 0;
    if (name === q) s += 6;
    else if (name.startsWith(q)) s += 2;
    if (p.country.toLowerCase().includes('india')) s += 2;
    return s;
  };
  return results.sort((a, b) => score(b) - score(a));
}

async function enrichPlace(place) {
  try {
    const results = await geocode(place.name);
    if (!results.length) return;

    const near = results
      .map((r) => ({ r, d: Math.abs(r.latitude - place.latitude) + Math.abs(r.longitude - place.longitude) }))
      .sort((a, b) => a.d - b.d)[0];

    if (!near || near.d > 1.5) return;

    const merged = {
      ...place,
      admin1: near.r.admin1 || place.admin1 || '',
      country: near.r.country || place.country || ''
    };

    state.place = merged;
    rememberPlace(merged);
    syncURL(merged);

    const region = document.querySelector('#hero .hero-loc .region');
    if (region) {
      region.textContent = [merged.admin1, merged.country]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(', ');
    }
  } catch { /* enrichment is optional */ }
}

async function fetchWeather(place) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: [
      'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'dew_point_2m', 'is_day',
      'precipitation', 'weather_code', 'cloud_cover', 'pressure_msl',
      'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'
    ].join(','),
    hourly: ['temperature_2m', 'weather_code', 'precipitation_probability', 'is_day', 'visibility'].join(','),
    daily: [
      'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'sunrise', 'sunset',
      'uv_index_max', 'precipitation_probability_max', 'wind_speed_10m_max'
    ].join(','),
    timezone: 'auto',
    forecast_days: '7',
    wind_speed_unit: 'kmh'
  });

  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error('weather request failed');
  return res.json();
}

async function fetchAirQuality(place) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: ['us_aqi', 'pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide'].join(','),
    timezone: 'auto'
  });

  const res = await fetch(`${AIR_URL}?${params}`);
  if (!res.ok) throw new Error('air quality request failed');
  return res.json();
}

/* ---------------- rendering: shell ---------------- */

function setTheme(theme) {
  document.body.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(document.body).getPropertyValue('--g1').trim();
    if (bg) meta.setAttribute('content', bg);
  }
}

function render(data, aqi) {
  const current = data.current;
  const meta = describe(current.weather_code, current.is_day);

  setTheme(meta.theme);
  startFx(meta.fx);

  state.offset = data.utc_offset_seconds;

  const hourKey = `${current.time.slice(0, 13)}:00`;
  let startIndex = data.hourly.time.indexOf(hourKey);
  if (startIndex < 0) startIndex = 0;

  renderHero(state.place, data, current, data.daily);
  renderChart(data, startIndex);
  renderSun(data);
  renderHourly(data, startIndex);
  renderDaily(data);
  renderDetails(data, current, startIndex);
  renderAqi(aqi);
  renderWind(current, data.daily);

  $('#footnote').innerHTML =
    `Weather, sun &amp; wind from <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> · air quality from <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noopener">Open-Meteo Air Quality</a> · ${escapeHTML(data.timezone)}`;

  $('#intro').hidden = true;
  $('#weather').hidden = false;
  $('#state').hidden = true;
}

/* ---------------- hero ---------------- */

function renderHero(place, data, current, daily) {
  const meta = describe(current.weather_code, current.is_day);
  const now = cityTime(data.utc_offset_seconds);

  const region = [place.admin1, place.country]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');

  $('#hero').innerHTML = `
    <div class="hero-main">
      <div class="hero-loc">
        <h1>${escapeHTML(place.name)}</h1>
        <span class="region">${escapeHTML(region)}</span>
        <span class="badge" id="heroClock">--:-- local</span>
      </div>

      <p class="hero-cond">${escapeHTML(meta.label)} · feels like ${temp(current.apparent_temperature, true)}</p>

      <div class="hero-temp">
        <span class="value">${Math.round(toUnit(current.temperature_2m))}</span>
        <span class="unit">°${state.unit.toUpperCase()}</span>
      </div>

      <div class="hero-meta">
        <span>High <b>${temp(daily.temperature_2m_max[0])}</b></span>
        <span>Low <b>${temp(daily.temperature_2m_min[0])}</b></span>
        <span>Sunrise <b>${isoToClock(daily.sunrise[0])}</b></span>
        <span>Sunset <b>${isoToClock(daily.sunset[0])}</b></span>
      </div>
    </div>

    <div class="hero-side">
      ${iconSVG(meta.icon, 'hero-icon')}
      <p class="hero-updated">Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
    </div>
  `;

  startClock(data.utc_offset_seconds);
}

function startClock(offsetSeconds) {
  clearInterval(state.clockTimer);
  const tick = () => {
    const el = $('#heroClock');
    if (!el) return;
    const now = cityTime(offsetSeconds);
    el.textContent = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} local`;
  };
  tick();
  state.clockTimer = setInterval(tick, 15000);
}

/* ---------------- 24h temperature chart ---------------- */

function smoothPath(points) {
  if (!points.length) return '';
  if (points.length < 2) return `M${points[0][0]},${points[0][1]}`;

  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function renderChart(data, startIndex) {
  const hourly = data.hourly;
  const end = Math.min(startIndex + 24, hourly.time.length);
  const points = [];
  for (let i = startIndex; i < end; i++) {
    points.push({
      t: toUnit(hourly.temperature_2m[i]),
      pop: hourly.precipitation_probability[i] ?? 0,
      time: hourly.time[i]
    });
  }

  if (points.length < 2) {
    $('#chart').innerHTML = '<p class="aqi-empty">Chart unavailable.</p>';
    return;
  }

  const W = 720, H = 200;
  const padL = 40, padR = 14, padT = 22, padB = 46;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const temps = points.map((p) => p.t);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = Math.max(1, max - min);

  const x = (i) => padL + (i / (points.length - 1)) * plotW;
  const y = (v) => padT + (1 - (v - min) / span) * plotH;

  const coords = points.map((p, i) => [x(i), y(p.t)]);
  const line = smoothPath(coords);
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${padT + plotH} L${coords[0][0].toFixed(1)},${padT + plotH} Z`;

  const gid = `chart${Date.now().toString(36)}`;
  const u = state.unit.toUpperCase();

  const gridLines = [0, 0.5, 1].map((f) => {
    const gy = padT + plotH * f;
    const val = Math.round(max - f * (max - min));
    return `
      <line class="grid-line" x1="${padL}" y1="${gy.toFixed(1)}" x2="${W - padR}" y2="${gy.toFixed(1)}" />
      <text class="axis-text" x="${padL - 8}" y="${(gy + 4).toFixed(1)}" text-anchor="end">${val}°</text>
    `;
  }).join('');

  const bars = points.map((p, i) => {
    const h = (p.pop / 100) * 26;
    return `<rect class="cloud-bar" x="${(x(i) - 8).toFixed(1)}" y="${(padT + plotH + 12 - h).toFixed(1)}" width="16" height="${h.toFixed(1)}" rx="4" />`;
  }).join('');

  const dots = coords.map(([cx, cy], i) => (i % 3 === 0
    ? `<circle class="dot${i === 0 ? ' dot-main' : ''}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${i === 0 ? 4.4 : 3.4}" />`
    : '')).join('');

  const xLabels = points.map((p, i) => {
    if (i % 6 !== 0 && i !== points.length - 1) return '';
    return `<text class="axis-text" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}">${i === 0 ? 'Now' : hourLabel(p.time)}</text>`;
  }).join('');

  $('#chart').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Temperature trend for the next 24 hours, from ${Math.round(min)} to ${Math.round(max)} degrees ${u}">
      <defs>
        <linearGradient id="${gid}-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ffb347" />
          <stop offset="55%" stop-color="#ff7a59" />
          <stop offset="100%" stop-color="#f0568a" />
        </linearGradient>
        <linearGradient id="${gid}-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff7a59" stop-opacity="0.34" />
          <stop offset="100%" stop-color="#ff7a59" stop-opacity="0" />
        </linearGradient>
      </defs>

      ${gridLines}
      ${bars}
      <path d="${area}" fill="url(#${gid}-area)" />
      <path class="line" d="${line}" style="stroke: url(#${gid}-line)" />
      ${dots}
      ${xLabels}
    </svg>
    <div class="chart-legend">
      <span><i style="background:linear-gradient(120deg,#ffb347,#f0568a)"></i>Temperature</span>
      <span><i style="background:rgba(240,86,138,.45)"></i>Chance of rain</span>
      <span>${Math.round(min)}° – ${Math.round(max)}° ${u}</span>
    </div>
  `;

  $('#chartHint').textContent = `${points.length} hours`;
}

/* ---------------- sun path ---------------- */

function renderSun(data) {
  const daily = data.daily;
  const riseIso = daily.sunrise[0];
  const setIso = daily.sunset[0];
  const riseMin = isoToMinutes(riseIso);
  const setMin = isoToMinutes(setIso);
  const dayLen = Math.max(1, setMin - riseMin);

  const nowMin = isoToMinutes(data.current.time);
  const frac = clamp((nowMin - riseMin) / dayLen, 0, 1);
  const isUp = nowMin >= riseMin && nowMin <= setMin;

  const W = 360, H = 200;
  const cx = 180, cy = 158, r = 126;
  const arcLen = Math.PI * r;
  const angle = Math.PI * (1 - frac);
  const sx = cx + r * Math.cos(angle);
  const sy = cy - r * Math.sin(angle);

  // a clear night still shows a faint moon marker
  const markerColor = isUp ? '#ffb347' : '#c3a6ff';

  $('#sun').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sun path from ${isoToClock(riseIso)} to ${isoToClock(setIso)}">
      <defs>
        <linearGradient id="sunArc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ffd166" />
          <stop offset="55%" stop-color="#ffb347" />
          <stop offset="100%" stop-color="#f0568a" />
        </linearGradient>
        <radialGradient id="sunGlow">
          <stop offset="0%" stop-color="${markerColor}" stop-opacity="0.55" />
          <stop offset="100%" stop-color="${markerColor}" stop-opacity="0" />
        </radialGradient>
      </defs>

      <line class="horizon" x1="18" y1="${cy}" x2="${W - 18}" y2="${cy}" />
      <path class="arc-track" d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" />
      <path class="arc-done" d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}"
            stroke-dasharray="${(arcLen * frac).toFixed(1)} ${arcLen.toFixed(1)}" style="stroke: url(#sunArc)" />

      <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="26" fill="url(#sunGlow)" />
      <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="8.5" fill="${markerColor}" opacity="${isUp ? 1 : 0.6}" />

      <text class="sun-label" x="${cx - r}" y="${cy + 20}" text-anchor="middle">Sunrise</text>
      <text class="sun-strong" x="${cx - r}" y="${cy + 38}" text-anchor="middle">${isoToClock(riseIso)}</text>
      <text class="sun-label" x="${cx + r}" y="${cy + 20}" text-anchor="middle">Sunset</text>
      <text class="sun-strong" x="${cx + r}" y="${cy + 38}" text-anchor="middle">${isoToClock(setIso)}</text>

      <text class="sun-label" x="${cx}" y="${cy - 12}" text-anchor="middle">${isUp ? 'Sun above horizon' : 'Sun below horizon'}</text>
      <text class="sun-strong" x="${cx}" y="${cy - 32}" text-anchor="middle">${Math.round(frac * 100)}% of daylight</text>
    </svg>

    <div class="sun-legend">
      <div><span class="k">Daylight</span><span class="v">${durationLabel(dayLen)}</span></div>
      <div><span class="k">Sunset</span><span class="v">${isoToClock(daily.sunset[0])}</span></div>
      <div><span class="k">UV max</span><span class="v">${daily.uv_index_max[0] === null || daily.uv_index_max[0] === undefined ? '–' : Math.round(daily.uv_index_max[0])}</span></div>
    </div>
  `;

  $('#sunHint').textContent = isUp
    ? `${durationLabel(Math.max(0, setMin - nowMin))} of daylight left`
    : 'Night time';
}

/* ---------------- hourly strip ---------------- */

function renderHourly(data, startIndex) {
  const hourly = data.hourly;
  const now = cityTime(data.utc_offset_seconds);
  const end = Math.min(startIndex + 24, hourly.time.length);
  const frag = [];

  for (let i = startIndex; i < end; i++) {
    const meta = describe(hourly.weather_code[i], hourly.is_day[i]);
    const pop = hourly.precipitation_probability[i];
    const isNow = i === startIndex;
    const timeLabel = isNow && now.getUTCHours() === Number(hourly.time[i].slice(11, 13))
      ? 'Now'
      : hourLabel(hourly.time[i]);

    frag.push(`
      <div class="hour${isNow ? ' is-now' : ''}" title="${escapeHTML(meta.label)}${pop ? ` · ${pop}% chance of rain` : ''}">
        <span class="h-time">${timeLabel}</span>
        ${iconSVG(meta.icon, 'h-icon')}
        <span class="h-temp">${temp(hourly.temperature_2m[i])}</span>
        <span class="h-rain">${pop >= 20 ? `${pop}%` : ''}</span>
      </div>
    `);
  }

  $('#hourly').innerHTML = frag.join('');
  $('#hourlyHint').textContent = data.timezone_abbreviation || '';
}

/* ---------------- daily ---------------- */

function renderDaily(data) {
  const d = data.daily;
  const mins = d.temperature_2m_min;
  const maxs = d.temperature_2m_max;
  const weekMin = Math.min(...mins);
  const weekMax = Math.max(...maxs);
  const range = Math.max(1, weekMax - weekMin);
  const rows = [];

  for (let i = 0; i < d.time.length; i++) {
    const meta = describe(d.weather_code[i], 1);
    const parts = dayParts(d.time[i]);
    const left = ((mins[i] - weekMin) / range) * 100;
    const width = Math.max(8, ((maxs[i] - mins[i]) / range) * 100);

    rows.push(`
      <div class="day${i === 0 ? ' is-today' : ''}" title="${escapeHTML(meta.label)}">
        <span class="d-name">${i === 0 ? 'Today' : parts.day}<small>${parts.date}</small></span>
        ${iconSVG(meta.icon, 'd-icon')}
        <span class="d-bar"><span style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></span></span>
        <span class="d-temps"><span class="lo">${temp(mins[i])}</span><span class="hi">${temp(maxs[i])}</span></span>
      </div>
    `);
  }

  $('#daily').innerHTML = rows.join('');
}

/* ---------------- details ---------------- */

function renderDetails(data, current, startIndex) {
  const daily = data.daily;
  const visibilityM = data.hourly.visibility ? data.hourly.visibility[startIndex] : null;
  const visibility = visibilityM === null || visibilityM === undefined
    ? '–'
    : (visibilityM >= 1000 ? `${(visibilityM / 1000).toFixed(1)}<small>km</small>` : `${Math.round(visibilityM)}<small>m</small>`);

  const uv = daily.uv_index_max[0];
  const pop = daily.precipitation_probability_max[0];

  const items = [
    { k: 'Feels like', v: `${Math.round(toUnit(current.apparent_temperature))}<small>°${state.unit.toUpperCase()}</small>`, sub: 'Apparent temperature' },
    { k: 'Humidity', v: `${Math.round(current.relative_humidity_2m)}<small>%</small>`, sub: current.relative_humidity_2m > 70 ? 'Quite humid' : current.relative_humidity_2m < 35 ? 'Dry air' : 'Comfortable' },
    { k: 'Rain chance', v: `${pop ?? 0}<small>%</small>`, sub: `${(current.precipitation ?? 0).toFixed(1)} mm now` },
    { k: 'UV index', v: `${uv === null || uv === undefined ? '–' : Math.round(uv)}`, sub: uvLabel(uv) },
    { k: 'Pressure', v: `${Math.round(current.pressure_msl)}<small>hPa</small>`, sub: current.pressure_msl > 1015 ? 'High' : current.pressure_msl < 1005 ? 'Low' : 'Normal' },
    { k: 'Cloud cover', v: `${Math.round(current.cloud_cover)}<small>%</small>`, sub: current.cloud_cover > 70 ? 'Mostly cloudy' : current.cloud_cover < 20 ? 'Mostly clear' : 'Partly cloudy' },
    { k: 'Visibility', v: visibility, sub: 'Current' },
    { k: 'Dew point', v: `${Math.round(toUnit(current.dew_point_2m))}<small>°${state.unit.toUpperCase()}</small>`, sub: current.dew_point_2m > current.temperature_2m - 2 ? 'Muggy' : 'Comfortable' }
  ];

  $('#details').innerHTML = items.map((it) => `
    <div class="detail">
      <span class="k">${escapeHTML(it.k)}</span>
      <span class="v">${it.v}</span>
      <span class="sub">${escapeHTML(it.sub)}</span>
    </div>
  `).join('');
}

/* ---------------- air quality ---------------- */

function renderAqi(aqi) {
  const current = aqi && aqi.current ? aqi.current : null;

  if (!current || current.us_aqi === null || current.us_aqi === undefined) {
    $('#aqi').innerHTML = '<p class="aqi-empty">Air quality data is not available for this location right now.</p>';
    $('#aqiHint').textContent = 'US AQI';
    return;
  }

  const value = Math.round(current.us_aqi);
  const info = aqiInfo(value);
  const frac = clamp(value / 300, 0, 1);
  const r = 66;
  const c = 2 * Math.PI * r;

  const pollutants = [
    { k: 'PM2.5', v: current.pm2_5, max: 75 },
    { k: 'PM10', v: current.pm10, max: 150 },
    { k: 'O₃', v: current.ozone, max: 180 },
    { k: 'NO₂', v: current.nitrogen_dioxide, max: 100 }
  ].filter((p) => p.v !== null && p.v !== undefined);

  const rows = pollutants.map((p) => `
    <div class="poll">
      <span class="pk">${p.k}</span>
      <span class="ptrack"><span class="pbar" style="width:${clamp((p.v / p.max) * 100, 2, 100).toFixed(1)}%;background:linear-gradient(90deg,${info.color},var(--accent-3))"></span></span>
      <span class="pv">${round1(p.v)} µg/m³</span>
    </div>
  `).join('');

  $('#aqi').innerHTML = `
    <div class="aqi-wrap">
      <div class="gauge">
        <svg viewBox="0 0 156 156" role="img" aria-label="US air quality index ${value}, ${escapeHTML(info.label)}">
          <circle class="track" cx="78" cy="78" r="${r}" />
          <circle class="bar" cx="78" cy="78" r="${r}" stroke="${info.color}"
                  stroke-dasharray="${c.toFixed(1)}"
                  stroke-dashoffset="${(c * (1 - frac)).toFixed(1)}" />
        </svg>
        <div class="gauge-center">
          <span class="gauge-num" style="color:${info.color}">${value}</span>
          <span class="gauge-cap">US AQI</span>
        </div>
      </div>

      <div>
        <p class="aqi-cat" style="color:${info.color}">${escapeHTML(info.label)}</p>
        <p class="aqi-note">${escapeHTML(info.note)}</p>
        ${rows}
      </div>
    </div>
  `;

  $('#aqiHint').textContent = aqi.current.time ? `Updated ${isoToClock(aqi.current.time)}` : 'US AQI';
}

/* ---------------- wind ---------------- */

function renderWind(current, daily) {
  const speed = current.wind_speed_10m ?? 0;
  const gust = current.wind_gusts_10m ?? 0;
  const dir = current.wind_direction_10m ?? 0;
  const from = compassName(dir);
  const calm = speed < 1;

  const cx = 86, cy = 86, R = 70;
  const angleRad = ((dir - 90) * Math.PI) / 180;
  const nx = cx + Math.cos(angleRad) * 52;
  const ny = cy + Math.sin(angleRad) * 52;
  const tx = cx - Math.cos(angleRad) * 26;
  const ty = cy - Math.sin(angleRad) * 26;

  const ticks = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI) / 8;
    const long = i % 4 === 0;
    const r1 = R - (long ? 11 : 6);
    const r2 = R - 1;
    return `<line class="tick" x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}"
                  x2="${(cx + Math.cos(a) * r2).toFixed(1)}" y2="${(cy + Math.sin(a) * r2).toFixed(1)}"
                  stroke-width="${long ? 1.8 : 1}" />`;
  }).join('');

  const cardinals = [
    ['N', cx, cy - R + 24], ['E', cx + R - 14, cy + 4],
    ['S', cx, cy + R - 12], ['W', cx - R + 14, cy + 4]
  ].map(([label, x, y]) => `<text class="cardinal" x="${x}" y="${y}" text-anchor="middle">${label}</text>`).join('');

  $('#wind').innerHTML = `
    <div class="wind-wrap">
      <svg class="wind-compass" viewBox="0 0 172 172" role="img" aria-label="Wind from ${escapeHTML(from)} at ${Math.round(speed)} kilometres per hour">
        <defs>
          <linearGradient id="windGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffd166" />
            <stop offset="100%" stop-color="#f0568a" />
          </linearGradient>
        </defs>
        <circle class="ring" cx="${cx}" cy="${cy}" r="${R}" />
        ${ticks}
        ${cardinals}
        <line class="needle-tail" x1="${cx}" y1="${cy}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}" />
        <line class="needle" x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" style="stroke: url(#windGrad)" />
        <circle class="hub" cx="${cx}" cy="${cy}" r="3.6" />
        <text class="wind-center" x="${cx}" y="${cy + 34}" text-anchor="middle">${Math.round(speed)}</text>
        <text class="wind-center-sub" x="${cx}" y="${cy + 47}" text-anchor="middle">KM/H</text>
      </svg>

      <div class="wind-stats">
        <div class="ws"><span class="wk">Direction</span><span class="wv">${calm ? 'Calm' : `${escapeHTML(from)} · ${Math.round(dir)}°`}</span></div>
        <div class="ws"><span class="wk">Gusts</span><span class="wv">${Math.round(gust)} km/h</span></div>
        <div class="ws"><span class="wk">Feel</span><span class="wv">${escapeHTML(windLabel(speed))}</span></div>
        <div class="ws"><span class="wk">Peak today</span><span class="wv">${daily && daily.wind_speed_10m_max && daily.wind_speed_10m_max[0] != null ? `${Math.round(daily.wind_speed_10m_max[0])} km/h` : '—'}</span></div>
      </div>
    </div>
  `;

  $('#windHint').textContent = calm ? 'Calm' : `${escapeHTML(from)} ${Math.round(speed)} km/h`;
}

/* ---------------- flow ---------------- */

function showState(text) {
  $('#stateText').textContent = text;
  $('#state').hidden = false;
  $('#intro').hidden = true;
}

let toastTimer = 0;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3800);
}

async function loadPlace(place) {
  state.place = place;
  showState(`Fetching weather for ${place.name}…`);

  try {
    const [weather, aqi] = await Promise.all([
      fetchWeather(place),
      fetchAirQuality(place).catch(() => null)
    ]);

    state.weather = weather;
    state.aqi = aqi;
    render(weather, aqi);

    rememberPlace(place);
    renderChips();
    syncURL(place);

    if (!place.admin1 && place.name !== 'My location') enrichPlace(place);
  } catch (err) {
    console.error(err);
    if (state.weather) {
      $('#state').hidden = true;
      $('#weather').hidden = false;
      toast('Could not refresh the weather. Check your connection.');
    } else {
      $('#state').hidden = true;
      $('#intro').hidden = false;
      toast('Could not load that city. Check your connection and try again.');
    }
  }
}

function rememberPlace(place) {
  const entry = {
    name: place.name,
    country: place.country || '',
    admin1: place.admin1 || '',
    latitude: place.latitude,
    longitude: place.longitude
  };
  state.recent = [entry, ...state.recent.filter((p) => p.name !== entry.name || p.country !== entry.country)].slice(0, 6);
  writeJSON(STORAGE.recent, state.recent);
}

function syncURL(place) {
  const params = new URLSearchParams({
    q: place.name,
    lat: Number(place.latitude).toFixed(4),
    lon: Number(place.longitude).toFixed(4)
  });
  if (place.country) params.set('c', place.country);
  history.replaceState(null, '', `${location.pathname}?${params}`);
}

function renderChips() {
  const list = (state.recent.length ? state.recent : SUGGESTED_CITIES).slice(0, 8);
  $('#chips').innerHTML = list.map((c, i) => `
    <button class="chip" type="button" data-index="${i}">
      ${escapeHTML(c.name)}${c.admin1 || c.country ? `<span class="chip-sub">${escapeHTML(c.admin1 || c.country)}</span>` : ''}
    </button>
  `).join('');

  $('#chips').querySelectorAll('.chip').forEach((btn) => {
    btn.addEventListener('click', () => loadPlace(list[Number(btn.dataset.index)]));
  });
}

/* ---------------- search ---------------- */

const searchInput = $('#searchInput');
const suggestions = $('#suggestions');
let searchTimer = 0;
let searchController = null;
let currentSuggestions = [];
let activeIndex = -1;

function closeSuggestions() {
  suggestions.hidden = true;
  suggestions.innerHTML = '';
  currentSuggestions = [];
  activeIndex = -1;
  searchInput.setAttribute('aria-expanded', 'false');
}

function showSuggestions(items, query) {
  currentSuggestions = items;
  activeIndex = -1;

  if (!items.length) {
    suggestions.innerHTML = `<li class="empty">No place found for “${escapeHTML(query)}”</li>`;
    suggestions.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    return;
  }

  suggestions.innerHTML = items.map((p, i) => `
    <li role="option" data-index="${i}" aria-selected="false">
      <strong>${escapeHTML(p.name)}</strong>
      <span>${escapeHTML([p.admin1, p.country].filter(Boolean).join(', '))}</span>
    </li>
  `).join('');

  suggestions.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');

  suggestions.querySelectorAll('li[data-index]').forEach((li) => {
    li.addEventListener('mousedown', (e) => e.preventDefault());
    li.addEventListener('click', () => selectSuggestion(Number(li.dataset.index)));
  });
}

function selectSuggestion(index) {
  const place = currentSuggestions[index];
  if (!place) return;
  closeSuggestions();
  searchInput.value = place.name;
  searchInput.blur();
  loadPlace(place);
}

function setActive(index) {
  const items = [...suggestions.querySelectorAll('li[data-index]')];
  if (!items.length) return;
  activeIndex = (index + items.length) % items.length;
  items.forEach((li, i) => {
    const on = i === activeIndex;
    li.classList.toggle('is-active', on);
    li.setAttribute('aria-selected', String(on));
  });
  items[activeIndex].scrollIntoView({ block: 'nearest' });
}

searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  clearTimeout(searchTimer);
  if (searchController) searchController.abort();

  if (query.length < 2) {
    closeSuggestions();
    return;
  }

  searchTimer = setTimeout(async () => {
    searchController = new AbortController();
    try {
      const results = await geocode(query, searchController.signal);
      showSuggestions(results, query);
    } catch (err) {
      if (err.name !== 'AbortError') closeSuggestions();
    }
  }, 260);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setActive(activeIndex + 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActive(activeIndex - 1);
  } else if (e.key === 'Enter') {
    if (activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(activeIndex);
    }
  } else if (e.key === 'Escape') {
    closeSuggestions();
    searchInput.blur();
  }
});

searchInput.addEventListener('blur', () => setTimeout(closeSuggestions, 120));

$('#searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  if (currentSuggestions.length && activeIndex >= 0) {
    selectSuggestion(activeIndex);
    return;
  }

  closeSuggestions();
  showState(`Searching for ${query}…`);
  try {
    const results = await geocode(query);
    if (!results.length) {
      $('#state').hidden = true;
      if (!state.weather) $('#intro').hidden = false;
      toast(`“${query}” not found. Try a different spelling.`);
      return;
    }
    loadPlace(results[0]);
  } catch {
    $('#state').hidden = true;
    if (!state.weather) $('#intro').hidden = false;
    toast('Search failed. Check your connection.');
  }
});

/* ---------------- geolocation ---------------- */

$('#geoBtn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    toast('Your browser does not support location access.');
    return;
  }

  const btn = $('#geoBtn');
  btn.classList.add('is-busy');

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    btn.classList.remove('is-busy');

    let place = { name: 'My location', country: '', admin1: '', latitude, longitude };

    try {
      const res = await fetch(`${REVERSE_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
      if (res.ok) {
        const data = await res.json();
        const name = data.city || data.locality || data.principalSubdivision;
        if (name) {
          place = {
            name,
            admin1: data.principalSubdivision || '',
            country: data.countryName || '',
            latitude,
            longitude
          };
        }
      }
    } catch { /* keep generic name */ }

    loadPlace(place);
    searchInput.value = place.name === 'My location' ? '' : place.name;
  }, () => {
    btn.classList.remove('is-busy');
    toast('Location permission denied. Search a city instead.');
  }, { timeout: 10000, maximumAge: 300000 });
});

/* ---------------- units ---------------- */

$('#unitToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-unit]');
  if (!btn) return;
  const unit = btn.dataset.unit;
  if (unit === state.unit) return;

  state.unit = unit;
  localStorage.setItem(STORAGE.unit, unit);

  [...$('#unitToggle').children].forEach((b) => {
    const on = b.dataset.unit === unit;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  });

  if (state.weather) render(state.weather, state.aqi);
});

/* ---------------- animated background ---------------- */

const canvas = $('#fx');
const ctx = canvas.getContext('2d');
const fx = {
  mode: 'none',
  parts: [],
  w: 0,
  h: 0,
  dpr: 1,
  raf: 0,
  last: 0,
  flash: 0,
  nextFlash: 0,
  reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches
};

function sizeCanvas() {
  fx.dpr = Math.min(window.devicePixelRatio || 1, 2);
  fx.w = window.innerWidth;
  fx.h = window.innerHeight;
  canvas.width = Math.floor(fx.w * fx.dpr);
  canvas.height = Math.floor(fx.h * fx.dpr);
  ctx.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0);
}

function seed(count, factory) {
  return Array.from({ length: count }, () => factory());
}

function startFx(mode) {
  if (fx.reduced) return;
  if (fx.mode === mode) return;
  fx.mode = mode;
  fx.parts = [];
  fx.flash = 0;
  fx.nextFlash = performance.now() + rand(1200, 4000);

  const area = (fx.w * fx.h) / 1000000;
  const scale = clamp(area, 0.4, 2.2);

  if (mode === 'rain' || mode === 'storm') {
    fx.parts = seed(Math.round(160 * scale), () => ({
      x: rand(0, fx.w),
      y: rand(-fx.h, fx.h),
      len: rand(9, 22),
      v: rand(430, 820),
      a: rand(0.1, 0.3)
    }));
  } else if (mode === 'snow') {
    fx.parts = seed(Math.round(110 * scale), () => ({
      x: rand(0, fx.w),
      y: rand(0, fx.h),
      r: rand(1.1, 2.8),
      v: rand(18, 52),
      a: rand(0.25, 0.7),
      ph: rand(0, Math.PI * 2),
      dr: rand(8, 26)
    }));
  } else if (mode === 'motes') {
    fx.parts = seed(Math.round(46 * scale), () => ({
      x: rand(0, fx.w),
      y: rand(0, fx.h),
      r: rand(0.7, 2.1),
      v: rand(5, 16),
      a: rand(0.08, 0.26),
      ph: rand(0, Math.PI * 2)
    }));
  }

  if (!fx.raf) {
    fx.last = performance.now();
    fx.raf = requestAnimationFrame(frame);
  }
}

function frame(t) {
  const dt = Math.min(0.05, (t - fx.last) / 1000);
  fx.last = t;

  ctx.clearRect(0, 0, fx.w, fx.h);

  if (fx.mode === 'rain' || fx.mode === 'storm') {
    ctx.lineCap = 'round';
    for (const p of fx.parts) {
      p.y += p.v * dt;
      p.x -= p.v * dt * 0.16;
      if (p.y > fx.h + 30) { p.y = -30; p.x = rand(0, fx.w + 120); }
      ctx.strokeStyle = `rgba(190, 200, 255, ${p.a})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.len * 0.18, p.y + p.len);
      ctx.stroke();
    }

    if (fx.mode === 'storm' && t > fx.nextFlash) {
      fx.flash = 1;
      fx.nextFlash = t + rand(4500, 11000);
    }
  } else if (fx.mode === 'snow') {
    for (const p of fx.parts) {
      p.y += p.v * dt;
      p.ph += dt * 0.8;
      p.x += Math.sin(p.ph) * p.dr * dt;
      if (p.y > fx.h + 8) { p.y = -8; p.x = rand(0, fx.w); }
      ctx.beginPath();
      ctx.fillStyle = `rgba(245, 236, 246, ${p.a})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (fx.mode === 'motes') {
    for (const p of fx.parts) {
      p.y -= p.v * dt;
      p.ph += dt * 0.5;
      p.x += Math.sin(p.ph) * 6 * dt;
      if (p.y < -8) { p.y = fx.h + 8; p.x = rand(0, fx.w); }
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 236, 226, ${p.a})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(226, 214, 255, ${fx.flash * 0.2})`;
    ctx.fillRect(0, 0, fx.w, fx.h);
    fx.flash = Math.max(0, fx.flash - dt * 5.5);
  }

  fx.raf = requestAnimationFrame(frame);
}

/* ---------------- boot ---------------- */

function boot() {
  sizeCanvas();
  window.addEventListener('resize', () => {
    sizeCanvas();
    const mode = fx.mode;
    fx.mode = 'none';
    if (mode !== 'none') startFx(mode);
  });

  [...$('#unitToggle').children].forEach((b) => {
    const on = b.dataset.unit === state.unit;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  });

  renderChips();

  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  const lat = parseFloat(params.get('lat'));
  const lon = parseFloat(params.get('lon'));

  if (q && Number.isFinite(lat) && Number.isFinite(lon)) {
    loadPlace({ name: q, country: params.get('c') || '', admin1: '', latitude: lat, longitude: lon });
  } else if (state.recent.length) {
    loadPlace(state.recent[0]);
  } else {
    $('#intro').hidden = false;
    setTheme('default');
    startFx('motes');
  }

  // keep the data fresh while the tab is open
  setInterval(() => {
    if (document.visibilityState !== 'visible' || !state.place) return;
    Promise.all([
      fetchWeather(state.place),
      fetchAirQuality(state.place).catch(() => null)
    ]).then(([weather, aqi]) => {
      state.weather = weather;
      state.aqi = aqi;
      render(weather, aqi);
    }).catch(() => { /* silent background refresh failure */ });
  }, 10 * 60 * 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.place) loadPlace(state.place);
  });
}

boot();
