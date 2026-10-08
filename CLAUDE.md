# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Fully built and running.** The complete backend (9 domain packages) and frontend (7 feature pages) are implemented and committed.

`CONTEXT.md` is a historical design document written before the build — it reads as a forward-looking plan and its "build order" and "already-created files" sections are no longer current. Treat it as design intent only; the code under `backend/src` and `frontend/src` is authoritative.

`prototype.jsx` and `finance-tracker.tsx` at the repo root are legacy ~2650-line single-file prototypes, superseded by `frontend/src/`. They remain as a UX reference only — do not edit them, and do not read them when analyzing current behavior.

## Stack (as built)

| Layer | Choice |
|---|---|
| Backend | Java 21, Spring Boot 3.3.5, Maven |
| ORM | Spring Data JPA + Hibernate (`ddl-auto: validate`) |
| Migrations | Flyway — single `V1__init_schema.sql`, 7 tables |
| DB | MySQL 8, port 3306, db `fintrack` |
| Auth | JWT access (15 min) + refresh (7 days, SHA-256 hashed in DB + HttpOnly cookie), BCrypt passwords |
| Env loading | spring-dotenv 4.0.0 — reads `backend/.env`, falls back to shell env vars |
| Frontend | React 18, Vite 5, plain JavaScript (no TypeScript), Tailwind, Recharts, TanStack Query, React Hook Form + Zod, axios |
| Export | `xlsx` (Excel), `jsPDF` + autoTable (PDF) |
| Money | `BIGINT` paise (minor units) end to end; display ₹ INR with 2 decimals |
| API | REST JSON under `/api/v1` |

## Running locally

Requires JDK 21 specifically — the pom targets 21 and the system default `java` may be newer.

```bash
# 1. MySQL 8 on port 3306. If none is installed locally, run one in a container:
docker run -d --name fintrack-mysql \
  -e MYSQL_ROOT_PASSWORD=fintrack -e MYSQL_DATABASE=fintrack \
  -p 3306:3306 mysql:8.0

# 2. Backend — config via backend/.env or shell env vars (see table below).
#    Flyway creates all tables on first boot.
cd backend
mvn spring-boot:run                  # http://localhost:8080

# 3. Frontend
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

Then register at `/signup` — this seeds 21 categories and 7 asset buckets for the new user.

### Build artifact

`mvn clean package -DskipTests` produces **`target/fintrack-backend.jar`** — the pom sets `<finalName>fintrack-backend</finalName>`, so there is no version suffix in the filename.

### Required environment variables

`DATASOURCE_URL`, `DATASOURCE_USERNAME`, `DATASOURCE_PASSWORD`, `JWT_SECRET` (min 32 chars) are required and have no defaults. Optional: `JWT_ACCESS_MINUTES` (15), `JWT_REFRESH_DAYS` (7), `CORS_ALLOWED_ORIGINS` (`http://localhost:5173`), `SPRING_PROFILES_ACTIVE`, `VITE_API_BASE_URL` (`http://localhost:8080/api/v1`).

The JDBC URL must keep `allowPublicKeyRetrieval=true`; `createDatabaseIfNotExist=true` means the `fintrack` schema is created automatically.

### Available commands

```bash
mvn spring-boot:run                  # backend dev server (8080)
mvn clean package -DskipTests        # build jar
npm run dev / build / preview        # frontend (no lint script configured)
```

There is **no test suite** — tests were explicitly out of scope for v1, and `backend/src/test` does not exist. Do not suggest `mvn test` as a verification step; verify via `curl` or the UI instead.

## Architecture

### Backend: package-by-domain

```
src/main/java/com/fintrack/
  auth/          # JWT issue/refresh/logout, register/login
  user/          # GET/PATCH/DELETE /me
  category/      # CRUD + default seeding on register
  transaction/   # CRUD + POST /{id}/confirm
  recurring/     # rules CRUD + idempotent generation service
  reporting/     # monthly + quarterly, raw SQL via EntityManager
  networth/      # asset_categories + net_worth_snapshots
  common/        # error model, global exception handler, base audit entity
  security/      # JwtAuthenticationFilter, SecurityConfig, @CurrentUser resolver
```

Most domain packages contain `Controller`, `Service`, `Repository`, `Entity`, and a `dto/` subpackage. `reporting` is the exception — it has no entity or repository and queries through `EntityManager` directly.

### Frontend: feature-folder

```
src/
  features/{transactions,categories,recurring,reports,networth}/
  pages/            # AppLayout, LoginPage, SignupPage, ProtectedRoute
  auth/             # AuthContext.jsx — provider + useAuth
  shared/           # Modal, KpiCard, Sidebar, TopBar, ToastContext, DeleteAccountModal
  lib/              # apiClient.js, queryClient.js, format.js
```

Routes: `/login`, `/signup` public; `/dashboard`, `/transactions`, `/categories`, `/recurring`, `/quarterly`, `/networth` behind `ProtectedRoute`. `/` redirects to `/dashboard`.

### Key architectural decisions

1. **No `ledger` table.** `user_id` lives directly on every domain table. Single-user-per-account.
2. **Reporting is pure SQL.** The monthly report assembles six native queries (`SUM(CASE WHEN ...)`, `GROUP BY`). Never aggregate in Java for report endpoints.
3. **Surplus and stock returns are frontend-computed** from snapshot deltas, never stored. `net_worth_snapshots` holds only raw balances per asset category in a JSON column.
4. **Recurring generation is idempotent** via `UNIQUE(recurring_rule_id, occurrence_key)`, where occurrence_key is the ISO date string. Catch the duplicate-key conflict and skip.
5. **Access token lives in a module variable** in `apiClient.js` — never localStorage, to limit XSS exposure. Refresh token is HttpOnly-cookie-only.
6. **Concurrent 401s queue behind one in-flight refresh** (`waitQueue` in `apiClient.js`) rather than firing duplicate refresh calls.
7. **UUIDs are `BINARY(16)`** in MySQL, generated in the JPA layer, exposed as strings in JSON (`UuidBinaryConverter`).

## Domain model essentials

### Two-lens reporting (Dashboard + Quarterly)
- **Cash lens**: ACTUAL rows grouped by `actual_date`
- **Plan lens**: any row with `expected_date` in period, regardless of status
- **Variance per category**: for rows with `expected_date` in month — if `EXPECTED` actual=0; if `ACTUAL` actual=`actual_amount_minor`. variance = actual − expected.

### Transaction status rules
- `EXPECTED`: requires `expected_amount_minor` + `expected_date`
- `ACTUAL`: requires `actual_amount_minor` + `actual_date`
- `POST /transactions/{id}/confirm`: flips EXPECTED→ACTUAL, preserves expected fields, sets `confirmed_at`

Multi-column conditional constraints are enforced in the service layer, not the DB — MySQL CHECK constraints can't express them cleanly, and partial unique indexes (sibling category names) have no MySQL equivalent.

### Recurring generation algorithm
1. `SELECT FOR UPDATE` active rules where `next_run_date <= today`
2. Generate occurrences from `next_run_date` through `min(today, end_date)`
3. Insert EXPECTED tx per occurrence; unique constraint is the duplicate guard
4. Advance `next_run_date` to the next future occurrence after the loop
5. Day-31 monthly rules clamp to month-end (Feb 28/29, Apr 30); yearly Feb 29 → Feb 28 in non-leap years
6. Use the user's timezone (default `Asia/Kolkata`) for "today"

Triggered by the frontend on app open and by a manual "Generate now" button — there is no background scheduler.

### Default seeds (on every new user registration)

**Income** (5): Salary, Side Hustle Income, Freelance, Investments, Other Income

**Expense** (16): Loan, Housing & Groceries, Dining Out or Food & Drinks, Healthcare, Transport or Commute, Fitness or Recreation, Social or Entertainment, Apparel or Personal Care, Household Expenses, Charity or Giving, Investment Loss, Subscriptions & Media, Miscellaneous Loss, ATM, Fuel & Maintenance, Other Expense

**Asset categories** (7): HDFC Bank (#3b82f6), Union Bank (#06b6d4), SBI Bank (#14b8a6), Stock (#10b981), Mutual Funds (#84cc16), Others (#a78bfa), Cash (#f59e0b)

All seeded rows are `is_default=true` — cannot be deleted, only deactivated.

## API surface

All under `/api/v1`. Protected endpoints require `Authorization: Bearer <token>`.

- **auth**: `POST /auth/{register,login,refresh,logout}`
- **me**: `GET /me`, `PATCH /me`, `DELETE /me` (requires email + password re-confirmation)
- **categories**: `GET`, `POST`, `PATCH /{id}`, `DELETE /{id}`
- **transactions**: `GET`, `POST`, `PATCH /{id}`, `POST /{id}/confirm`, `DELETE /{id}`
- **recurring**: `GET|POST /recurring-rules`, `PATCH|DELETE /recurring-rules/{id}`, `POST /recurring/generate`
- **reports**: `GET /reports/monthly?year=&month=`, `GET /reports/quarterly?year=&quarter=`
- **networth**: `GET|POST /asset-categories`, `PATCH|DELETE /asset-categories/{id}`, same shape for `/net-worth-snapshots`

Error model: `{ errorCode, message, fieldErrors?, traceId? }` via `GlobalExceptionHandler`.

## UI conventions

- Dark theme: `bg-slate-950` page, `bg-slate-900` cards, `border-slate-800` borders
- All monetary values use the `tabular-nums` class
- Status pills: EXPECTED = amber, ACTUAL = emerald; INCOME = emerald, EXPENSE = rose
- `fmtINR(minor)` → `₹X,XX,XXX.XX` (Indian locale); `fmtCompact(minor)` → K/L/Cr suffixes
- Month chip nav with transaction count badges; lens toggle Both / Planned / Cash
- All modals go through the shared `<Modal>` component; feedback via `ToastContext`

## Features beyond the original spec

- **Excel + PDF export** of transactions (`features/transactions/exportUtils.js`) — styled headers, totals row, frozen panes, multi-page landscape PDF
- **Account self-deletion** (`UserService.deleteMe`) — ordered cascading deletes to satisfy FK RESTRICT constraints
- **TopBar live monthly KPIs**, shown app-wide independent of the Dashboard

## Out of scope (v1)

Multi-currency conversion, account/wallet sub-dimensions, email/password reset, background schedulers, budgeting, mobile app, public deployment, CI/CD, automated tests.
