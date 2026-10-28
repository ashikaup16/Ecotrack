# EcoTrack

EcoTrack is a personal carbon-footprint awareness app. A user can create a local account, estimate emissions from everyday travel, household electricity, diet, and clothing, explore an interactive reduction scenario, and save monthly check-ins, a reduction goal, and a practical action checklist.

**Live app:** [https://ecotrack-jet.vercel.app](https://ecotrack-jet.vercel.app)

> **Scope:** EcoTrack is an educational prototype, not a carbon-audit service. Emission factors are illustrative constants in the source code, not a bundled regional dataset, a live lookup, or a formally verified inventory.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Run in development](#run-in-development)
- [Production build and run](#production-build-and-run)
- [Backend deployment status](#backend-deployment-status)
- [Configuration](#configuration)
- [Account data and persistence](#account-data-and-persistence)
- [Footprint calculation](#footprint-calculation)
- [Monthly check-ins and journey tracking](#monthly-check-ins-and-journey-tracking)
- [HTTP API](#http-api)
- [Validation and tests](#validation-and-tests)
- [Security and deployment notes](#security-and-deployment-notes)
- [Project structure](#project-structure)
- [Known limitations](#known-limitations)

## Features

- Email/password sign-up, sign-in, session restoration, and sign-out.
- Responsive React dashboard with accessible form labels, charts, and small-screen navigation.
- Annual CO2e estimate split into travel, home energy, food, and shopping.
- Annual source breakdown visualized with a bar chart and donut chart.
- Interactive what-if controls for reduced car travel and plant-forward meals.
- One saved footprint check-in per account per calendar month; recalculating updates that month's value rather than creating duplicate points.
- Check-in trend chart, consecutive-month streak, configurable 5–25% reduction goal, and five saved eco-action checklist items.
- Recommendations ordered by each user's largest estimated emission categories.

## Architecture

```text
Browser
  React 19 + Vite
  Recharts visualizations
       │ same-origin /api requests
       ▼
Express 5 API (Node.js)
  ├─ Local SQLite user/session/profile/journey data
  └─ Python subprocess for footprint calculations
       │ JSON via stdin/stdout
       ▼
Python 3 calculator
```

- **Frontend:** React, Vite, Recharts, and Lucide icons. In development, the Vite server proxies `/api` requests to Express.
- **API and storage:** Express runs on port `3001` by default. Node's built-in `node:sqlite` module stores accounts, sessions, the latest profile, monthly check-ins, personal goals, and completed actions in SQLite.
- **Calculator:** The API starts `calculator/footprint.py` as a child process for each estimate, sends JSON on stdin, and parses the JSON result from stdout. Python diagnostics go to stderr.
- **Production serving:** `npm start` serves `dist/` from Express when a production build exists, as well as the API.

## Backend deployment status

The backend included in this repository is a **Node.js/Express service**, not a hosted API automatically provided by the Vercel frontend deployment:

- `server/index.js` implements authentication, session handling, calculation orchestration, and the `/api/*` routes.
- Node's built-in SQLite database stores accounts and user data on the server filesystem.
- The server starts `calculator/footprint.py` as a Python subprocess for each calculation.
- The local `npm run dev` command starts both the Vite frontend and this API. In development, Vite forwards `/api` requests to `http://localhost:3001`.

The live frontend is [https://ecotrack-jet.vercel.app](https://ecotrack-jet.vercel.app). **The API is not currently deployed at that URL:** a live check of `https://ecotrack-jet.vercel.app/api/health` returned HTTP 404. The repository has no Vercel API-function or rewrite configuration. Consequently, the live page alone does not provide the Express backend, Python calculator, persistent SQLite storage, or working account sign-in/calculation routes. Use `npm run dev` locally to use the complete application.

To make the app fully available online, deploy the Express service to a Node.js host that provides a persistent writable disk and Python 3, set `ECOTRACK_DB_PATH` to persistent storage, configure the Python executable if needed, and deploy the frontend with a same-origin `/api` reverse proxy/rewrite to that service. The browser currently uses relative `/api` URLs and same-origin session cookies; a separately hosted API needs a correctly configured proxy or a deliberate frontend/API CORS and cookie configuration. A static frontend deployment alone is not sufficient. For a single-host deployment, build with `npm run build` and run `npm start` on the same host as Node.js, Python, and the persistent SQLite file.

## Requirements

- Node.js **22.13 or later**. The project uses Node's built-in `node:sqlite`.
- Python 3.
- npm, included with Node.js.

On Windows PowerShell, use `npm.cmd` if your execution policy prevents running `npm.ps1`.

## Run in development

From the project directory:

```powershell
npm install
npm run dev
```

The command starts both the Vite frontend (normally `http://localhost:5173`) and the API (`http://localhost:3001`). Keep the terminal process running while using the app. Create an account in the browser to get started.

Run either process separately if needed:

```powershell
npm run dev:api
npm run dev:web
```

## Production build and run

Build the frontend, then run the combined Express server:

```powershell
npm run build
npm start
```

Express listens on port `3001` unless `PORT` is set. When `dist/index.html` exists, Express serves the built app and API from the same origin. Deploy behind HTTPS and use persistent storage for the SQLite file.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Express listening port. |
| `PYTHON` | `python` on Windows; `python3` elsewhere | Python executable used to run the calculator. Set this when Python is not on `PATH`. |
| `ECOTRACK_DB_PATH` | `data/ecotrack.sqlite` in the project directory | SQLite database location. Parent directories are created automatically. Back up this file to preserve local accounts and data. |
| `API_URL` | `http://localhost:3001` | Full upstream API URL used by the Vite `/api` development proxy. Set this when running the API on a different port. |
| `NODE_ENV` | unset | When set to `production`, the session cookie receives the `Secure` attribute. HTTPS is required in that mode for the browser to send the cookie. |

Example PowerShell configuration for development:

```powershell
$env:PYTHON = "C:\Path\To\python.exe"
$env:ECOTRACK_DB_PATH = "C:\Path\To\ecotrack.sqlite"
$env:PORT = "3001"
npm run dev
```

If the API is on another port, set `API_URL` before starting Vite:

```powershell
$env:API_URL = "http://localhost:3010"
npm run dev:web
```

## Account data and persistence

Accounts are **local to this installation**. There is no hosted identity service, email verification, password reset, cross-device synchronization, or remote backup.

The SQLite database contains these tables:

| Table | Purpose |
|---|---|
| `users` | Display name, normalized unique email, password salt/hash, and creation time. |
| `sessions` | SHA-256 hash of a random session token, its account, and expiration time. Raw session tokens are only sent in an HTTP-only cookie. |
| `profiles` | Most recently submitted input values and the corresponding calculation result for each account. |
| `footprint_checkins` | Annual estimate and category totals keyed by account and `YYYY-MM` month. Recalculation within one month updates that month's row. |
| `user_journeys` | Selected reduction goal and completed action IDs, stored per account. |

Deleting the database deletes the accounts and all associated data. A backup should be made while the server is stopped, or using a SQLite-aware backup procedure.

## Footprint calculation

The calculator accepts weekly car distance, annual flight hours, monthly home electricity use, household size, monthly new clothing items, and one of three diet patterns.

All returned emissions are estimated in **kilograms of CO2-equivalent (kg CO2e)**. The application uses these fixed, illustrative factors from `calculator/footprint.py`:

| Input | Factor |
|---|---:|
| Car travel | `0.192 kg CO2e / km` |
| Air travel | `90 kg CO2e / flight hour` |
| Electricity | `0.42 kg CO2e / kWh` |
| New clothing | `25 kg CO2e / item` |
| Plant-forward diet | `1.5 kg CO2e / person / day` |
| Balanced diet | `2.5 kg CO2e / person / day` |
| Meat-heavy diet | `3.3 kg CO2e / person / day` |

The annual category calculations are:

```text
Travel      = weekly_car_km × 52 × 0.192
              + annual_flight_hours × 90
Home energy = monthly_kWh × 12 × 0.42 ÷ household_size
Food        = selected_diet_factor × 365
Shopping    = monthly_clothing_items × 12 × 25
Annual total = sum of the rounded category totals
```

Each category is rounded to a whole kilogram before the annual total is summed. The result also contains a rounded monthly average, a one-decimal daily average, per-category values, and the factors used for the selected diet.

Input constraints: values cannot be negative or non-finite; household size must be an integer from 1 to 30. Maximums are 3,000 km of car travel per week, 1,000 flight hours per year, 10,000 kWh of electricity per month, and 100 clothing items per month. Diet must match one of the supported patterns.

The factors are broad assumptions, not a packaged dataset. They are not adjusted for country, grid mix, vehicle type, flight class, household heating, food sourcing, or garment type. The current model does not cover every source of personal or consumption-based emissions. Use it for learning and rough comparisons, not financial, regulatory, scientific, or organizational reporting.

## Monthly check-ins and journey tracking

- A successful calculation saves the current inputs and result as the account's latest profile.
- It also upserts that estimate for the current UTC calendar month. Recalculating again in the same month updates the existing check-in.
- The history chart plots saved annual estimates for each recorded month; it does not interpolate, fabricate, or backfill missing months.
- The monthly streak counts adjacent calendar months that have a saved check-in.
- Goal progress compares the first recorded monthly total to the latest: reduction is `max(0, first_total - latest_total)`. Progress is capped at 100% of the selected target.
- The action checklist is a saved list of action IDs. It is not a carbon offset or a verified reduction measurement.
- The what-if lab is an independent scenario estimate, not a saved check-in and not a promise of actual savings.

## HTTP API

Except for health and authentication endpoints, API routes require a valid EcoTrack session cookie. JSON request and response bodies use `Content-Type: application/json`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Check whether the API is running. |
| `POST` | `/api/auth/signup` | Create an account and establish a session. Requires `name`, `email`, and `password` (10–128 characters). |
| `POST` | `/api/auth/login` | Verify email/password and establish a session. |
| `POST` | `/api/auth/logout` | Revoke the current session and clear the cookie. |
| `GET` | `/api/auth/me` | Return the current user, saved profile, and journey; unauthenticated callers receive null user/profile. |
| `POST` | `/api/calculate` | Validate and calculate inputs, save the latest profile and this month's check-in. Requires a session. |
| `GET` | `/api/journey` | Return saved monthly history, reduction goal, and completed actions. Requires a session. |
| `PUT` | `/api/journey` | Save `goalPercent` and `completedActions`. Goal must be 5, 10, 15, 20, or 25; action IDs must be unique supported IDs. Requires a session. |

Example estimate request:

```json
{
  "commuteKmPerWeek": 120,
  "flightHoursPerYear": 12,
  "electricityKwhPerMonth": 280,
  "householdSize": 2,
  "clothingItemsPerMonth": 2,
  "diet": "balanced"
}
```

The estimate endpoint returns an object shaped like:

```json
{
  "result": {
    "totalKg": 4496,
    "monthlyKg": 375,
    "dailyKg": 12.3,
    "categories": {
      "Travel": 2278,
      "Home energy": 706,
      "Food": 912,
      "Shopping": 600
    },
    "factors": {}
  },
  "history": [
    { "month": "2026-10", "totalKg": 4496 }
  ]
}
```

The values above illustrate the response shape; actual totals depend on the submitted inputs. The factors object is populated by the calculator.

## Validation and tests

Run the production frontend build and Python calculator unit tests:

```powershell
npm run build
npm test
```

The test suite checks annual/monthly/category output, household allocation of electricity emissions, and rejection of invalid input. The API also validates journey goals and action IDs before persisting them.

## Security and deployment notes

- Passwords are stored using per-account random salts and Node's `scrypt`; passwords are not stored in plaintext.
- Sessions use cryptographically random tokens. The database stores a SHA-256 token hash; the browser receives an `HttpOnly`, `SameSite=Lax` cookie with a 30-day expiry. The `Secure` cookie attribute is enabled when `NODE_ENV=production`.
- Keep production traffic on HTTPS, restrict filesystem access to the SQLite file and backups, and keep the database on persistent storage.
- The application has no built-in email verification, password recovery, rate limiting, account lockout, administrator interface, or multi-factor authentication. Add and test these controls before using it as a public, multi-user service.
- The default development server is intended for local use. Do not expose it directly to the public internet.

## Project structure

```text
calculator/
  footprint.py          Input validation and annual emissions calculations
  test_footprint.py     Python unit tests
server/
  index.js              Express API, authentication, SQLite, calculator process
src/
  App.jsx               React views, forms, charts, and account interactions
  main.jsx              React entry point
  styles.css            Dashboard, account, and responsive styles
index.html               Vite HTML entry
vite.config.js           React plugin, API proxy, and build chunking
package.json             Commands and JavaScript dependencies
package-lock.json        Locked npm dependency graph
```

## Known limitations

- User accounts and data are local to the configured SQLite database; there is no hosted service or synchronization.
- Emission factors are hard-coded illustrative values, not an external dataset. Their sources and geographic applicability are not verified in this prototype.
- Monthly history only begins when a user saves check-ins. There is no historical import or automatic scheduled collection.
- The baseline measures only the selected simplified categories and should not be interpreted as a complete personal carbon footprint.
- What-if scenarios and eco-action checklist items are educational prompts, not verified or audited emissions reductions.
