# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Pre-build. Only `# Personal Finance Tracker — Build.txt` (architecture decisions) and `prototype.jsx` (~2650-line single-file React prototype) exist. No backend or production frontend code has been written yet. The Build.txt is the authoritative source of all architectural decisions — do not deviate from it without asking the user.

## Stack (locked in)

| Layer | Choice |
|---|---|
| Backend | Java 21 LTS, Spring Boot 3.4.x, Maven |
| ORM | Spring Data JPA + Hibernate |
| Migrations | Flyway |
| DB | MySQL 8 (Docker, port 3306, db `fintrack`, user `fintrack`) |
| Auth | JWT access (15 min) + refresh (7 days, hashed in DB + HttpOnly cookie) |
| Frontend | React 18, Vite, plain JavaScript (no TypeScript), Tailwind CSS, Recharts, TanStack Query, React Hook Form + Zod, axios |
| Money | `bigint` paise (minor units) in DB; display as ₹ INR with 2 decimals |
| API | REST JSON under `/api/v1` |

## Common commands

```bash
# Start Postgres
docker-compose up -d

# Backend
mvn spring-boot:run                        # run dev server (port 8080)
mvn test                                   # all tests
mvn test -Dtest=ClassName#methodName       # single test
mvn test -pl backend -Dtest=RecurringServiceTest   # module-scoped

# Frontend (inside frontend/)
npm run dev                                # Vite dev server (port 5173)
npm run build
npm run lint
```

## Architecture

### Backend: package-by-domain

```
src/main/java/com/fintrack/
  auth/          # JWT, refresh tokens, register/login/logout
  user/          # GET/PATCH /me
  category/      # CRUD + default seeding on register
  transaction/   # CRUD + POST /{id}/confirm
  recurring/     # rules CRUD + generation service
  reporting/     # monthly + quarterly SQL aggregation
  networth/      # asset_categories + net_worth_snapshots
  common/        # error model, global exception handler, base audit entity
  security/      # JwtAuthenticationFilter, SecurityConfig, CurrentUser resolver
```

Each domain package contains: `Controller`, `Service`, `Repository`, `Entity`, `Dto`, `Mapper`.

### Frontend: feature-folder

```
src/
  features/
    transactions/
    categories/
    recurring/
    reports/        # dashboard + quarterly
    networth/
  shared/components/   # Modal, KPI, Sidebar, TopBar, Toast
  lib/                 # apiClient.js, auth.jsx, queryClient.js, format.js
```

### Key architectural decisions

1. **No `ledger` table.** `user_id` lives directly on every domain table. Single-user-per-account model.
2. **Reporting SQL only.** All aggregation in SQL (`SUM(CASE WHEN ...)`, `GROUP BY`). No in-Java aggregation for report endpoints.
3. **Surplus and stock returns are frontend-computed** from snapshot deltas — never stored in DB. `net_worth_snapshots` stores only raw balances per asset category.
4. **Recurring generation is idempotent** via `UNIQUE(recurring_rule_id, occurrence_key)` — occurrence_key is the ISO date string. Catch conflict on insert and skip.
5. **Access token in memory** (React state + module var). Refresh token in HttpOnly cookie only.
6. **CORS**: allow `http://localhost:5173` in dev, configurable via `CORS_ALLOWED_ORIGINS`.

## Domain model essentials

### Two-lens reporting (Dashboard + Quarterly)
- **Cash lens**: ACTUAL rows grouped by `actual_date`
- **Plan lens**: any row with `expected_date` in period (regardless of status)
- **Variance per category**: for rows with `expected_date` in month — if `EXPECTED` actual=0; if `ACTUAL` actual=`actual_amount_minor`. variance = actual − expected.

### Transaction status rules
- `EXPECTED`: requires `expected_amount_minor` + `expected_date`
- `ACTUAL`: requires `actual_amount_minor` + `actual_date`
- `POST /transactions/{id}/confirm`: flips EXPECTED→ACTUAL; preserves expected fields; sets `confirmed_at`

### Recurring generation algorithm
1. `SELECT FOR UPDATE` active rules where `next_run_date <= today`
2. Generate occurrences from `next_run_date` through `min(today, end_date)`
3. Insert EXPECTED tx per occurrence; use unique constraint as duplicate guard
4. Advance `next_run_date` to next future occurrence after loop
5. Day-31 monthly rules clamp to month-end (Feb 28/29, Apr 30, etc.)
6. Use user's timezone (default `Asia/Kolkata`) for "today"

### Default seeds (created on every new user registration)

**Income categories**: Salary, Side Hustle Income, Freelance, Investments, Other Income

**Expense categories**: Loan, Housing & Groceries, Dining Out or Food & Drinks, Healthcare, Transport or Commute, Fitness or Recreation, Social or Entertainment, Apparel or Personal Care, Household Expenses, Charity or Giving, Investment Loss, Subscriptions & Media, Miscellaneous Loss, ATM, Fuel & Maintenance, Other Expense

**Asset categories** (with colors): HDFC Bank (#3b82f6), Union Bank (#06b6d4), SBI Bank (#14b8a6), Stock (#10b981), Mutual Funds (#84cc16), Others (#a78bfa), Cash (#f59e0b)

All seeded rows: `is_default=true` — cannot be deleted, only deactivated.

## Build order (follow strictly, stop after each for verification)

1. Backend skeleton: `pom.xml`, `application.yml`, `application-dev.yml`, `FinTrackApplication.java`
2. Flyway `V1__init_schema.sql` — all tables, indexes, constraints
3. `common` module — error model, global exception handler, base audit entity
4. `security` + `auth` modules — JWT util, filter, SecurityConfig, AuthController, BCrypt
5. `user` module — `GET/PATCH /me`
6. `category` module — full CRUD + default seeding service
7. `transaction` module — full CRUD + confirm endpoint
8. `recurring` module — rules CRUD + generation service
9. `reporting` module — monthly + quarterly endpoints
10. `networth` module — asset categories + snapshots CRUD
11. Integration tests (JUnit 5 + Testcontainers)
12. Frontend skeleton — Vite, Tailwind, routing, `main.jsx`, `App.jsx`
13. Frontend lib — `apiClient.js` (axios + 401 refresh interceptor), auth provider, `queryClient.js`, `format.js`
14. Auth pages (`LoginPage`, `SignupPage`) + `ProtectedRoute`
15. Shared components — `Modal`, `KPI`, `Sidebar`, `TopBar`, `Toast`
16. Features in order: transactions → categories → recurring → reports → networth
17. README updates

## UI reference (prototype.jsx)

The prototype is the definitive UX spec. Key patterns to reproduce:
- Dark theme: `bg-slate-950` page, `bg-slate-900` cards, `border-slate-800` borders
- All monetary values: `tabular-nums` class
- Status pills: EXPECTED = amber, ACTUAL = emerald, INCOME = emerald, EXPENSE = rose
- `fmtINR(minor)` → `₹X,XX,XXX.XX` (Indian locale); `fmtCompact(minor)` → K/L/Cr suffixes
- Month chip nav: dynamic last-N months with transaction count badges
- Lens toggle: Both / Planned / Cash (affects cumulative chart line visibility)
- `computeDerivedMetrics(sortedSnapshots)` — computes surplus and stock delta client-side

## Out of scope (v1)

Multi-currency conversion, account/wallet sub-dimensions, email/password reset, background schedulers, budgeting, mobile app, public deployment, CI/CD pipelines.

## Test requirements

- Auth: register, login, refresh, expired token rejection
- Transactions: create EXPECTED, confirm flow, category-type mismatch rejection
- Recurring: idempotent generation (run twice = no duplicates), day-31 clamping, backfill from past start date, concurrent safety
- Reporting: monthly variance math, quarterly month-by-month totals, by-category aggregation
