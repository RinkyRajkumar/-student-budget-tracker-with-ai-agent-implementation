# Spendly - Budget Tracker

A functional student budget tracking website built with React, Vite, Tailwind CSS, Supabase-ready persistence, a browser-local fallback database, optional Express/sql.js APIs, and Recharts.

## Features

- Student signup and login with JWT authentication
- Add spending from the dashboard and analyze it in Spending
- Daily, weekly, and monthly summaries
- Category-wise spending charts and monthly trend chart
- Monthly budget limit with near/over-budget alerts
- Savings goal tracker
- Smart advice with highest category, cut-cost suggestions, safe-to-spend amount, and weekly tips
- CSV export for filtered expenses
- Split Bills receipt OCR through Google Gemini
- Vercel-ready Supabase database support with a local browser fallback
- Mobile-first dashboard UI

## Setup

1. Install dependencies:

   ```bash
   npm run install:all
   ```

2. Copy environment values:

   ```bash
   copy .env.example server\.env
   copy client\.env.example client\.env
   ```

   On macOS/Linux use `cp .env.example server/.env` and `cp client/.env.example client/.env`.

   The frontend uses the browser-local database by default. To use Supabase, create a Supabase project, run [supabase/schema.sql](./supabase/schema.sql) in the Supabase SQL editor, then set:

   ```bash
   # client/.env
   VITE_DATA_BACKEND=supabase
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

   Keep `VITE_DATA_BACKEND=local` for the current localStorage database, or use `VITE_USE_BROWSER_STORE=false` only if you intentionally want the Express API.

   Split Bills receipt OCR uses Gemini from the backend. Add your key in `server/.env`:

   ```bash
   GEMINI_API_KEY=your-google-gemini-api-key
   GEMINI_MODEL=gemini-2.5-flash
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open:

   - Frontend: http://localhost:5173
   - Backend health: http://localhost:4000/api/health

The app starts with no spending, budget, subscription, or split-bill data. In Supabase mode, auth and finance data are stored per authenticated user using row-level security. In local mode, browser data is stored per browser in `localStorage` under Spendly keys, so it also works when hosted as a static Vercel app. The optional Express/sql.js database is created at `server/data/student-budget.sqlite` for local API development and no longer seeds demo finance data.

## Useful Scripts

- `npm run dev` - run frontend and backend together
- `npm run build` - build the React app
- `npm run test` - run backend tests and frontend build
- `npm run start` - run the backend server

## API Summary

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/expenses`
- `POST /api/expenses`
- `PUT /api/expenses/:id`
- `DELETE /api/expenses/:id`
- `GET /api/summary`
- `GET /api/budget`
- `PUT /api/budget`
- `GET /api/savings-goal`
- `PUT /api/savings-goal`
- `GET /api/advice`
- `POST /api/receipt-ocr`
- `GET /api/split-bills`
- `GET /api/export.csv`

All protected endpoints require `Authorization: Bearer <token>`.
