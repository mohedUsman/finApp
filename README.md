# FinTrack — Personal Finance Tracker

A full-stack personal finance management application built with Java Spring Boot and React. Track income and expenses, manage recurring rules, analyze quarterly trends, and monitor your net worth across multiple asset categories — all in a clean dark-themed UI designed for Indian Rupee (INR) finances.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Key Business Logic](#key-business-logic)
- [Project Structure](#project-structure)
- [Common Commands](#common-commands)
- [Troubleshooting](#troubleshooting)

---

## Features

### Dashboard
- Monthly KPI cards: Cash Income, Cash Expense, Net Cash, Open Planned count
- Daily income vs expense line chart with lens toggle (Both / Planned / Cash)
- Expense breakdown donut chart by category
- Per-category variance table (planned vs actual)
- One-click button to generate all pending recurring transactions

### Transactions
- Full CRUD for income and expense transactions
- Two statuses: **EXPECTED** (planned) and **ACTUAL** (confirmed)
- Confirm flow: flip EXPECTED → ACTUAL with actual amount and date
- Month-chip navigation with transaction count badges per month
- Filter by type (Income / Expense) and status (Expected / Actual)
- Recurring badge on transactions auto-generated from recurring rules

### Categories
- User-defined income and expense categories
- Optional parent–child hierarchy for subcategories
- 21 default categories seeded on registration (cannot be deleted, only deactivated)

### Recurring Rules
- Define recurring income/expense rules with three schedule types: **Monthly**, **Weekly**, **Yearly**
- Day-31 monthly rules auto-clamp to actual month-end (Feb 28/29, Apr 30, etc.)
- Idempotent generation — running twice never creates duplicates
- Backfill: generates all missed occurrences from start date through today

### Quarterly Reports
- Quarter-level aggregation for any year and quarter
- Month-by-month grouped bar chart (planned vs actual side by side)
- Per-category breakdown for the full quarter
- Variance analysis: planned vs actual per category

### Net Worth
- Manual snapshots recording per-asset balances on any chosen date
- Hero KPIs: latest total net worth, surplus since last snapshot, stock portfolio delta
- Multi-line trend chart: total net worth line + individual per-asset category lines
- Asset allocation donut chart showing percentage per category
- By-kind subtotals grouping assets into bank, investment, cash, and other buckets
- Balance bars comparing current vs previous snapshot per asset
- Full snapshot table with one column per active asset, plus Total / Surplus / Stock Δ columns
- Inline asset category manager: add, edit, or deactivate asset buckets without leaving the page
- 7 default asset categories seeded on registration (HDFC Bank, Union Bank, SBI Bank, Stock, Mutual Funds, Others, Cash)

---

## Tech Stack

### Backend

| Layer | Choice |
|---|---|
| Language | Java 21 LTS |
| Framework | Spring Boot 3.3.5 |
| Build Tool | Maven |
| ORM | Spring Data JPA + Hibernate |
| Migrations | Flyway |
| Database | MySQL 8 |
| Auth | JWT (JJWT 0.12.5) — 15-min access token + 7-day HttpOnly refresh cookie |
| Password Hashing | BCrypt (12 rounds) |
| Env Loading | spring-dotenv 4.0.0 |

### Frontend

| Layer | Choice |
|---|---|
| UI Framework | React 18.3.1 |
| Build Tool | Vite 5.3.5 |
| Routing | React Router 6.25.1 |
| Server State | TanStack Query 5.51.1 |
| Forms | React Hook Form 7.52.1 + Zod 3.23.8 |
| HTTP Client | Axios 1.7.2 |
| Charts | Recharts 2.12.7 |
| Icons | Lucide React |
| Styling | Tailwind CSS 3.4.7 |
| Language | JavaScript (no TypeScript) |

---

## Architecture

### Backend — Package by Domain

```
com.fintrack/
  auth/          # JWT issuance, refresh tokens, register/login/logout endpoints
  user/          # GET /me, PATCH /me
  category/      # CRUD + default seeding on user registration
  transaction/   # CRUD + confirm endpoint (EXPECTED → ACTUAL)
  recurring/     # Rules CRUD + idempotent generation service
  reporting/     # Monthly + quarterly SQL aggregation endpoints
  networth/      # Asset categories CRUD + net worth snapshots CRUD
  common/        # ErrorResponse, GlobalExceptionHandler, BaseAuditEntity
  security/      # JwtAuthenticationFilter, SecurityConfig, CurrentUser resolver
```

Each domain package follows the layered pattern: `Controller → Service → Repository → Entity → Dto → Mapper`.

### Frontend — Feature Folder

```
src/
  features/
    transactions/    # TransactionsPage, TransactionForm, ConfirmForm
    categories/      # CategoriesPage, CategoryForm
    recurring/       # RecurringPage, RecurringForm
    reports/         # DashboardPage, QuarterlyPage
    networth/        # NetWorthPage, SnapshotForm, AssetCategoryForm
  shared/
    Modal.jsx        # Generic modal (sm/md/lg/xl sizes, Escape key to close)
    KpiCard.jsx      # KPI tile with icon, label, value, color variants
    Sidebar.jsx      # Navigation sidebar with active route indicator
    TopBar.jsx       # Header showing live monthly KPIs
    ToastContext.jsx # Global toast notification system
  lib/
    apiClient.js     # Axios instance with JWT injection + 401 auto-refresh queue
    auth.jsx         # useAuth hook
    queryClient.js   # TanStack Query config (30s stale time, 1 retry, no focus refetch)
    format.js        # formatCurrency, formatDate, fmtCompact, month utilities
  auth/
    AuthContext.jsx  # Global auth state, silent refresh on app load, login/logout
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| No ledger table | `user_id` lives directly on every domain table. Single-user-per-account model keeps queries simple. |
| Reporting is pure SQL | All aggregation via `SUM(CASE WHEN ...)` and `GROUP BY`. No in-Java aggregation for report endpoints. |
| Net worth derived metrics are frontend-computed | Surplus and stock delta come from snapshot deltas; never stored or computed server-side. |
| Recurring generation is idempotent | `UNIQUE(recurring_rule_id, occurrence_key)` catches duplicates at the DB level — safe to run multiple times. |
| Access token in memory only | Stored in a React module variable, never in localStorage. Mitigates XSS token theft. Refresh token lives only in an HttpOnly cookie. |
| Money as paise (bigint) | All amounts stored as `BIGINT` minor units. No floating-point rounding errors. UI converts: user enters ₹ → ×100 for API → ÷100 for display. |
| UUIDs as `BINARY(16)` | Compact storage, faster index lookups vs `VARCHAR(36)`. Converted to/from `UUID` in Java via Hibernate. |

---

## Getting Started

### Prerequisites

- Java 21+
- Maven 3.8+
- MySQL 8 (running on port 3306)
- Node.js 18+ and npm

### 1. Configure environment

The `.env` file in `backend/` is read automatically by spring-dotenv. Fill in your values:

```bash
# Edit backend/.env
DATASOURCE_URL=jdbc:mysql://localhost:3306/fintrack?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Kolkata&useUnicode=true&characterEncoding=utf8
DATASOURCE_USERNAME=root
DATASOURCE_PASSWORD=your_mysql_root_password
JWT_SECRET=generate-with-openssl-rand-base64-48
SPRING_PROFILES_ACTIVE=dev
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

The JDBC URL includes `createDatabaseIfNotExist=true`, so the `fintrack` database is created automatically on first start.

### 2. Run the backend

Flyway migrations run on startup and create all 7 tables.

```bash
cd backend
mvn spring-boot:run
# Backend starts on http://localhost:8080
```

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
# Frontend starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser and register an account.

### 4. Register your account

Via the UI at `/signup`, or directly via API:

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}'
```

On registration, 21 default income/expense categories and 7 asset category buckets are seeded automatically.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATASOURCE_URL` | Yes | — | Full JDBC connection URL for MySQL 8 |
| `DATASOURCE_USERNAME` | Yes | — | MySQL username |
| `DATASOURCE_PASSWORD` | Yes | — | MySQL password |
| `JWT_SECRET` | Yes | — | JWT signing key — minimum 32 characters. Generate: `openssl rand -base64 48` |
| `JWT_ACCESS_MINUTES` | No | `15` | Access token lifetime in minutes |
| `JWT_REFRESH_DAYS` | No | `7` | Refresh token lifetime in days |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:5173` | Comma-separated list of allowed frontend origins |
| `SPRING_PROFILES_ACTIVE` | No | — | Set to `dev` to enable debug logging |
| `VITE_API_BASE_URL` | No | `http://localhost:8080/api/v1` | API base URL consumed by the frontend |

---

## API Reference

All endpoints are under `/api/v1`. Protected endpoints require `Authorization: Bearer <access_token>`.

### Authentication — `/api/v1/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register new user; seeds default categories and assets |
| POST | `/auth/login` | Public | Login; sets HttpOnly `refresh_token` cookie |
| POST | `/auth/refresh` | Cookie | Issue new access token from refresh cookie |
| POST | `/auth/logout` | Cookie | Revoke refresh token in DB and clear cookie |

**Login / Register response:**
```json
{
  "user": { "id": "...", "email": "you@example.com", "timezone": "Asia/Kolkata", "baseCurrencyCode": "INR" },
  "accessToken": "eyJ...",
  "expiresInSeconds": 900
}
```

### User — `/api/v1/me`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/me` | Yes | Get current user profile |
| PATCH | `/me` | Yes | Update `phone`, `timezone`, or `baseCurrencyCode` |

### Categories — `/api/v1/categories`

| Method | Endpoint | Auth | Query Params | Description |
|--------|----------|------|--------------|-------------|
| GET | `/categories` | Yes | `type` (INCOME\|EXPENSE), `includeInactive` | List categories |
| POST | `/categories` | Yes | — | Create category (`type`, `name`, optional `parentId`) |
| PATCH | `/categories/{id}` | Yes | — | Update `name`, `parentId`, or `isActive` |
| DELETE | `/categories/{id}` | Yes | — | Delete (blocked for `is_default` rows) |

### Transactions — `/api/v1/transactions`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/transactions` | Yes | Paginated list. Filters: `from`, `to`, `type`, `categoryId`, `status`, `page`, `size`, `sort` |
| POST | `/transactions` | Yes | Create EXPECTED or ACTUAL transaction |
| PATCH | `/transactions/{id}` | Yes | Update any field |
| POST | `/transactions/{id}/confirm` | Yes | Flip EXPECTED → ACTUAL with `actualAmountMinor` and `actualDate` |
| DELETE | `/transactions/{id}` | Yes | Delete transaction |

**Transaction status rules:**
- `EXPECTED` requires `expectedAmountMinor` + `expectedDate`
- `ACTUAL` requires `actualAmountMinor` + `actualDate`
- Confirm preserves the original expected fields; sets `confirmedAt` timestamp

### Recurring Rules — `/api/v1/recurring-rules`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/recurring-rules` | Yes | List all rules |
| POST | `/recurring-rules` | Yes | Create rule |
| PATCH | `/recurring-rules/{id}` | Yes | Update rule |
| DELETE | `/recurring-rules/{id}` | Yes | Delete rule |
| POST | `/recurring/generate` | Yes | Generate pending transactions up to `throughDate` (default: today) |

**`scheduleType` and `scheduleConfig` examples:**
```json
MONTHLY: { "dayOfMonth": 15 }
WEEKLY:  { "dayOfWeek": 2 }         // 1=Sunday, 2=Monday, ...
YEARLY:  { "month": 3, "day": 31 }
```

### Reports — `/api/v1/reports`

| Method | Endpoint | Auth | Query Params | Description |
|--------|----------|------|--------------|-------------|
| GET | `/reports/monthly` | Yes | `year`, `month` (1–12) | Monthly KPIs, daily trend, category variance |
| GET | `/reports/quarterly` | Yes | `year`, `quarter` (1–4) | Quarterly KPIs, month breakdown, by-category totals |

### Net Worth — `/api/v1/asset-categories` and `/api/v1/net-worth-snapshots`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/asset-categories` | Yes | List asset categories ordered by `sort_order` |
| POST | `/asset-categories` | Yes | Create asset category (`name`, `kind`, optional `color`) |
| PATCH | `/asset-categories/{id}` | Yes | Update `name`, `kind`, `color`, or `isActive` |
| DELETE | `/asset-categories/{id}` | Yes | Delete (blocked for defaults) |
| GET | `/net-worth-snapshots` | Yes | List snapshots ordered by date DESC |
| POST | `/net-worth-snapshots` | Yes | Create snapshot with per-asset balances |
| PATCH | `/net-worth-snapshots/{id}` | Yes | Update snapshot date, balances, or note |
| DELETE | `/net-worth-snapshots/{id}` | Yes | Delete snapshot |

**Snapshot `balances` payload** (values in paise):
```json
{
  "asset-category-uuid-1": 500000,
  "asset-category-uuid-2": 1000000
}
```

---

## Database Schema

### Tables

```
users                  — Accounts (email, password_hash, timezone, base_currency_code)
refresh_tokens         — Hashed refresh tokens with expiry and revocation timestamp
categories             — Income/expense categories with optional parent and default flag
transactions           — All financial events (EXPECTED + ACTUAL statuses)
recurring_rules        — Templates for auto-generated recurring transactions
asset_categories       — Named asset buckets (bank, investment, cash, etc.) per user
net_worth_snapshots    — Point-in-time net worth records keyed by user + date
```

### Entity Relationships

```
users ──< categories      ──< transactions
users ──< recurring_rules ──< transactions (via recurring_rule_id)
users ──< asset_categories
users ──< net_worth_snapshots
```

### Important Constraints

| Table | Constraint | Enforcement Purpose |
|-------|-----------|---------------------|
| `users` | `UNIQUE(email)` | One account per email address |
| `transactions` | `UNIQUE(recurring_rule_id, occurrence_key)` | Idempotent recurring generation |
| `asset_categories` | `UNIQUE(user_id, name)` | No duplicate asset bucket names per user |
| `net_worth_snapshots` | `UNIQUE(user_id, snapshot_date)` | One snapshot per day per user |

### Money Columns

All monetary columns are `BIGINT` storing **paise** (100 paise = ₹1.00). Example: ₹1,500.50 → stored as `150050`. The frontend multiplies user input by 100 before sending to the API, and divides by 100 for display.

---

## Key Business Logic

### Authentication Flow

```
Register / Login
  ↓ Backend issues JWT access token (15 min) + sets HttpOnly refresh cookie (7 days)
  ↓ Frontend stores access token in module-level variable (never localStorage)

App load (AuthContext.jsx)
  ↓ POST /auth/refresh (browser sends refresh cookie automatically)
  ↓ Success → GET /me to restore user state → show app
  ↓ Failure → user lands on /login

Any API call returns 401
  ↓ Axios interceptor queues the failing request
  ↓ Calls POST /auth/refresh once (all subsequent 401s wait in queue)
  ↓ Success → updates Authorization header → retries all queued requests
  ↓ Failure → clears token → redirects to /login
```

### Recurring Generation Algorithm

1. **Acquire locks** — `SELECT FOR UPDATE` all active rules where `next_run_date <= today`
2. **Generate occurrences** — one EXPECTED transaction per date from `next_run_date` through `min(today, end_date)`
3. **Idempotent insert** — `occurrence_key` is the ISO date string (`YYYY-MM-DD`); the DB unique constraint on `(recurring_rule_id, occurrence_key)` silently skips duplicates
4. **Day-31 clamping** — monthly rules clamp day 31 to the actual last day of each month (Feb → 28/29, Apr/Jun/Sep/Nov → 30)
5. **Advance pointer** — after generation, `next_run_date` is moved to the next future occurrence
6. **Timezone** — "today" is resolved in the user's timezone (default `Asia/Kolkata`)

### Reporting Math

**Cash lens** — `ACTUAL` transactions where `actual_date` falls in the reporting period.
**Plan lens** — all transactions (any status) where `expected_date` falls in the reporting period.

```
variance per category = actual_amount_minor - expected_amount_minor
```

Positive variance on income = exceeded target. Negative on expense = overspent.

### Net Worth Derived Metrics (Client-Side)

Snapshots store only raw per-asset balances. `computeDerived()` in `NetWorthPage.jsx` attaches:

```javascript
total       = sum of all asset values in this snapshot
surplus     = total(current) - total(previous snapshot)    // null for first snapshot
stockDelta  = stock(current) - stock(previous snapshot)    // null for first snapshot
```

The Stock asset category is identified at runtime by `name.toLowerCase() === 'stock'` — not a hardcoded ID.

### Default Seeds on Registration

**Income categories (5):** Salary, Side Hustle Income, Freelance, Investments, Other Income

**Expense categories (16):** Loan, Housing & Groceries, Dining Out or Food & Drinks, Healthcare, Transport or Commute, Fitness or Recreation, Social or Entertainment, Apparel or Personal Care, Household Expenses, Charity or Giving, Investment Loss, Subscriptions & Media, Miscellaneous Loss, ATM, Fuel & Maintenance, Other Expense

**Asset categories (7):**

| Name | Kind | Color |
|------|------|-------|
| HDFC Bank | bank | #3b82f6 |
| Union Bank | bank | #06b6d4 |
| SBI Bank | bank | #14b8a6 |
| Stock | investment | #10b981 |
| Mutual Funds | investment | #84cc16 |
| Others | other | #a78bfa |
| Cash | cash | #f59e0b |

All defaults are flagged `is_default = true` — they cannot be deleted, only deactivated.

---

## Project Structure

```
finance-tracker/
├── backend/
│   ├── pom.xml
│   ├── .env                              # Gitignored — local secrets
│   └── src/
│       └── main/
│           ├── java/com/fintrack/
│           │   ├── FinTrackApplication.java
│           │   ├── auth/                 # AuthController, AuthService, JwtUtil, RefreshTokenService
│           │   ├── user/                 # UserController, UserService, UserEntity, UserDto
│           │   ├── category/             # CategoryController, CategoryService, DefaultCategorySeeder
│           │   ├── transaction/          # TransactionController, TransactionService
│           │   ├── recurring/            # RecurringRuleController, RecurringGenerationService
│           │   ├── reporting/            # ReportingController, ReportingService (pure SQL)
│           │   ├── networth/             # AssetCategoryController, NetWorthController, NetWorthService
│           │   ├── common/               # ErrorResponse, GlobalExceptionHandler, BaseAuditEntity
│           │   └── security/             # JwtAuthenticationFilter, SecurityConfig, CurrentUser
│           └── resources/
│               ├── application.yml       # Spring config (MySQL, JWT, CORS, cookie settings)
│               ├── application-dev.yml   # Dev overrides (debug logging)
│               └── db/migration/
│                   └── V1__init_schema.sql  # All 7 tables + indexes + constraints
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx                      # App root — wraps Router, QueryClient, Auth, Toast providers
│       ├── App.jsx                       # Route definitions + ProtectedRoute component
│       ├── auth/
│       │   └── AuthContext.jsx           # Global auth state, silent refresh on load
│       ├── lib/
│       │   ├── apiClient.js              # Axios with Bearer inject + 401 refresh queue
│       │   ├── auth.jsx                  # useAuth hook
│       │   ├── queryClient.js            # TanStack Query configuration
│       │   └── format.js                 # formatCurrency, formatDate, fmtCompact, month helpers
│       ├── shared/
│       │   ├── Modal.jsx
│       │   ├── KpiCard.jsx
│       │   ├── Sidebar.jsx
│       │   ├── TopBar.jsx
│       │   └── ToastContext.jsx
│       └── features/
│           ├── transactions/             # TransactionsPage.jsx, TransactionForm.jsx, ConfirmForm.jsx
│           ├── categories/               # CategoriesPage.jsx, CategoryForm.jsx
│           ├── recurring/                # RecurringPage.jsx, RecurringForm.jsx
│           ├── reports/                  # DashboardPage.jsx, QuarterlyPage.jsx
│           └── networth/                 # NetWorthPage.jsx, SnapshotForm.jsx, AssetCategoryForm.jsx
│
├── .env                                  # Gitignored — same vars as backend/.env
├── CLAUDE.md                             # AI coding assistant project guidance
└── README.md
```

---

## Common Commands

```bash
# Backend
cd backend
mvn spring-boot:run                        # Start dev server on :8080
mvn test                                   # Run all tests
mvn test -Dtest=ClassName#methodName       # Run a single test method
mvn clean package                          # Build production JAR

# Frontend
cd frontend
npm run dev                                # Start Vite dev server on :5173
npm run build                              # Build for production
npm run preview                            # Preview production build locally
npm run lint                               # Run ESLint
```

---

## Troubleshooting

**MySQL connection refused**
- Verify MySQL is running: `Get-Service -Name "*mysql*"` (Windows) or `systemctl status mysql` (Linux/Mac)
- Confirm `DATASOURCE_USERNAME` and `DATASOURCE_PASSWORD` in `.env` match your MySQL setup

**`Public Key Retrieval is not allowed`**
- The JDBC URL in `.env` must include `allowPublicKeyRetrieval=true` — do not remove this flag

**Flyway migration failed on startup**
- Drop and recreate the database: `DROP DATABASE fintrack;` — Flyway will re-run V1 on the next start
- Verify the MySQL user has `CREATE`, `ALTER`, `INDEX`, and `DROP` privileges

**JWT errors / 401 on every API call**
- `JWT_SECRET` must be at least 32 characters
- Ensure `VITE_API_BASE_URL` in the frontend `.env` matches the backend port (default 8080)

**CORS errors in the browser**
- `CORS_ALLOWED_ORIGINS` must exactly match the frontend URL — no trailing slash
- Restart the backend after changing this value

**Timezone or date mismatch**
- The JDBC URL pins `serverTimezone=Asia/Kolkata`; recurring rule generation also uses `Asia/Kolkata` by default
- Change the user's `timezone` field via `PATCH /me` if needed

**Frontend shows blank page**
- Run `npm install` inside the `frontend/` folder before `npm run dev`
- Check the browser console for the specific error
