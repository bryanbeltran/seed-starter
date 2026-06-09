# Seed Starter

Frost-aware indoor sow date planner for US gardeners. Enter a ZIP code, pick crops, and get sow dates based on your USDA hardiness zone and estimated last frost date.

## Features

- ZIP code → USDA hardiness zone lookup ([PHZM API](https://phzmapi.org/))
- Last-frost estimates by zone
- Per-crop indoor sow offsets (tomato, pepper, lettuce, carrot, broccoli)
- Rolls dates to next season when frost has already passed
- Export CSV or iCalendar (.ics)

## Requirements

- Node.js 20+
- npm

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command       | Description              |
|---------------|--------------------------|
| `npm run dev` | Start dev server         |
| `npm run build` | Production build       |
| `npm run start` | Serve production build |
| `npm run lint`  | ESLint                 |

## API

### `POST /api/schedules`

```json
{ "zip": "55423", "seeds": ["tomato", "lettuce"] }
```

Response:

```json
{
  "zone": "5a",
  "sowDates": [
    { "seed": "tomato", "date": "2027-02-07T06:00:00.000Z" }
  ]
}
```

## Limitations

- US ZIP codes only (5 digits)
- Zone lookup requires network access to phzmapi.org
- Frost dates are zone-level estimates, not station-specific
- Five crops with fixed offsets; no varieties or risk profiles yet

## Deploy

Works on [Vercel](https://vercel.com) or any Node host that supports Next.js 15.
