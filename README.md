# Skyline — Weather Web App

A polished web version of `weather_app.py` (the Python CLI in the parent folder).
Same data source, no API keys, no backend — just static files.

## Run it

**Option 1 — double click**

```
start-weather-web.bat
```

**Option 2 — terminal**

```bash
cd weather-web
python -m http.server 5500 --bind 127.0.0.1
```

Then open <http://127.0.0.1:5500/>

## Features

**Weather**
- Live conditions: temperature, feels-like, dew point, humidity, wind + gusts, pressure, cloud cover, visibility
- 24-hour temperature chart (smooth SVG line + area, rain-probability bars)
- 24-hour icon strip with rain chance
- 7-day forecast with a temperature range bar per day
- Sun path arc: sunrise, sunset, daylight length, % of daylight elapsed, UV max
- Air quality: US AQI gauge with category colours + PM2.5 / PM10 / O₃ / NO₂ readings
- Wind compass: needle, cardinal ticks, speed, gusts, Beaufort-style "feel"

**UX**
- Installable PWA: add to home screen, standalone window, works offline (cached shell)
- Search with debounced autocomplete (↑ ↓ Enter Esc), Indian cities nudged up
- "Use my location" (browser geolocation + reverse geocoding)
- °C / °F toggle, remembered between visits, re-renders every chart
- Recent searches as quick chips (localStorage)
- Weather-aware "sunset warm" theme: the whole sky shifts with conditions
- Animated canvas background (rain, snow, drifting motes, lightning)
- Responsive: 2-column desktop grid → single column mobile
- Loading / empty / error states, auto refresh every 10 minutes
- Accessible: aria labels, live regions, reduced-motion support

## Data

| Purpose | API |
| --- | --- |
| City search | `geocoding-api.open-meteo.com/v1/search` |
| Forecast | `api.open-meteo.com/v1/forecast` |
| Air quality | `air-quality-api.open-meteo.com/v1/air-quality` |
| Reverse geocoding | `api.bigdatacloud.net/data/reverse-geocode-client` |

All are free, keyless and CORS-enabled, so this runs entirely in the browser.
Please keep the "Data from Open-Meteo" credit if you publish it.

## Structure

```
weather-web/
├── index.html
├── css/style.css
├── js/app.js
├── manifest.webmanifest
├── sw.js
├── icons/            (192, 512, maskable, svg)
├── start-weather-web.bat
└── README.md
```

## Install as an app (PWA)

The site is a full PWA — no app store needed.

- **Android / Chrome / Edge:** open the site → browser menu → **"Install app"** / **"Add to Home screen"**
  (desktop Chrome/Edge also shows an install icon in the address bar)
- **iPhone / Safari:** Share → **"Add to Home Screen"**

Once installed it opens in its own window (no address bar), keeps the sunset theme in the
status bar, supports long-press shortcuts (Mumbai / Delhi / Bengaluru), and still opens when
you are offline (cached shell — live weather obviously needs internet).

When you change any file, bump the version in two places so users get the update:
`CACHE_VERSION` in `sw.js` and the `?v=` query on the CSS/JS links in `index.html`.

## Make it public (free)

**Netlify Drop (easiest, no account needed to start)**
1. Go to <https://app.netlify.com/drop>
2. Drag `skyline-weather.zip` (or the whole `weather-web` folder) onto the page
3. You instantly get a URL like `https://sunny-skyline-12345.netlify.app`
4. Sign in only if you want to keep it permanently / rename it

**GitHub Pages**
Push this folder to a repo → Settings → Pages → deploy from `main` / root.

**Vercel**
`npx vercel` inside this folder.

## Notes

- The Python CLI restricted search to Indian cities (`countryCode=IN`). The web app searches
  globally but nudges Indian cities up in the results, matching the original intent.
- Hourly "Now", the sun path and the hero clock all use the city's own timezone.
- Charts are pure SVG — no chart library, nothing to install.
