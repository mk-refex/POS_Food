## Backend (Express + TypeScript + Sequelize + MySQL)

### Prerequisites
- Node.js 18+
- MySQL 8+

### Setup
1. Copy `env.example` to `.env` and adjust values.
2. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Ensure the database exists (e.g., `CREATE DATABASE app_db CHARACTER SET utf8mb4;`).

### Development
```bash
npm run dev
```
Server runs at `http://localhost:4000`.

### Build & Start
```bash
npm run build && npm start
```

### API Overview
- Auth
  - POST `/api/auth/register` { email, password, name }
  - POST `/api/auth/login` { email, password }
- Users (JWT required)
  - GET `/api/users/me`
  - GET `/api/users` (admin)
  - PATCH `/api/users/:id` (admin)
- Billing (JWT required)
  - GET `/api/billing`
  - POST `/api/billing` (admin)
  - PATCH `/api/billing/:id` (admin)
- Reports (JWT required)
  - GET `/api/reports`
  - POST `/api/reports` (admin)
- Dashboard (JWT required)
  - GET `/api/dashboard/stats`

### Notes
- Sequelize `sync({ alter: true })` is enabled during startup for convenience. For production, use migrations.


