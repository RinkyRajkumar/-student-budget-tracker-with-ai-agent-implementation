# Spendly - Budget Tracker

A functional student budget tracking website built with React, Vite, Tailwind CSS, Express, SQLite, and Recharts.

## Features

- Student signup and login with JWT authentication
- Add, edit, delete, search, and filter expenses
- Daily, weekly, and monthly summaries
- Category-wise spending charts and monthly trend chart
- Monthly budget limit with near/over-budget alerts
- Savings goal tracker
- Smart advice with highest category, cut-cost suggestions, safe-to-spend amount, and weekly tips
- CSV export for filtered expenses
- Split Bills receipt OCR through Google Gemini
- Seeded demo account and data
- Mobile-first dashboard UI

## Demo Login

- Email: `demo@student.edu`
- Password: `Student123!`

## Setup

1. Install dependencies:

   ```bash
   npm run install:all
   ```

2. Copy environment values:

   ```bash
   copy .env.example server\.env
   ```

   On macOS/Linux use `cp .env.example server/.env`.

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

The SQLite database is created automatically at `server/data/student-budget.sqlite` and seeded with demo data.

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
