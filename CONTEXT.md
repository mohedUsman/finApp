# Personal Finance Tracker — Build Context

This document captures all the architectural decisions made before you (Claude Code) joined. **Read this fully before writing any code.** Do not deviate from these decisions without asking.

## Goal
Production-ready personal finance tracker, used by 1 user + a few family members, runs locally on Windows first. Java backend + React frontend + PostgreSQL.

## Stack (locked in)

| Layer | Choice |
|---|---|
| Backend | Java 21 LTS, Spring Boot 3.3.x, Maven |
| ORM | Spring Data JPA + Hibernate |
| Migrations | Flyway |
| DB | MySQL 8 (local install on port 3306) |
| Auth | JWT access (15 min) + refresh (7 days). Refresh stored hashed in `refresh_tokens` table + HttpOnly cookie. Access in `Authorization: Bearer` header. BCrypt for password hashing. |
| Frontend | React 18, Vite, **plain JavaScript (no TypeScript)**, Tailwind CSS, Recharts, TanStack Query, React Hook Form + Zod, axios |
| Money | Store as `bigint` in minor units (paise). Display ₹ INR with 2 decimals. |
| API | REST, JSON, all under `/api/v1` |
| Local dev | Local MySQL (run `db/bootstrap.sql` once); backend via `mvn spring-boot:run`; frontend via `npm run dev` |

## Architectural decisions

1. **NO `ledger` table.** `user_id` lives directly on `categories`, `transactions`, `recurring_rules`, `asset_categories`, `net_worth_snapshots`. Single user = single account.
2. **Package-by-domain** in backend: `auth`, `user`, `category`, `transaction`, `recurring`, `networth`, `reporting`, `common`, `security`. Each module has Controller/Service/Repository/Entity/Dto/Mapper.
3. **Feature-folder** in frontend: `src/features/{transactions,categories,recurring,reports,networth}` + `src/shared/components` + `src/lib`.
4. Standard error model: `{ errorCode, message, fieldErrors?, traceId? }`.
5. CORS: allow `http://localhost:5173` in dev (configurable via `CORS_ALLOWED_ORIGINS`).
6. Default currency: INR. Default timezone: Asia/Kolkata.

## Already-created files (DO NOT overwrite)

These exist in the repo root:
- `README.md` — top-level setup guide
- `db/bootstrap.sql` — one-shot CREATE DATABASE + CREATE USER + GRANT, run once via `mysql -u root -p < db/bootstrap.sql`
- `.env` — local secrets (gitignored): JDBC URL, JWT secret, CORS, frontend API URL
- `.gitignore`

MySQL 8 runs locally on port 3306. Database name `fintrack`, user `fintrack`@`localhost`, password set in `db/bootstrap.sql` and mirrored in `.env`. Default collation `utf8mb4_0900_ai_ci` provides case-insensitive comparisons (replaces Postgres `citext`).

## Domain model

### Tables (use snake_case, plural)

**MySQL-specific conventions**
- UUID PKs stored as `BINARY(16)`; generated in the JPA layer (`UUID.randomUUID()`), exposed as strings in JSON.
- Audit timestamps use `TIMESTAMP` (UTC-stored; JDBC URL pins `serverTimezone=Asia/Kolkata` for app-level reads).
- Enums stored as `VARCHAR(20)` with JPA `@Enumerated(EnumType.STRING)`.
- JSON config columns use the native `JSON` type.
- CHECK constraints use MySQL 8.0.16+ syntax. Multi-column conditional checks (e.g., "if status=EXPECTED then …") are enforced in the service layer.
- Partial unique indexes (e.g., sibling category names by parent) are enforced in the service layer since MySQL has no `WHERE` clause on UNIQUE.

**users**
- id BINARY(16) pk
- email varchar(254) unique not null (utf8mb4_0900_ai_ci → case-insensitive)
- password_hash varchar(72) not null (bcrypt)
- phone varchar(20) null
- timezone varchar(64) not null default 'Asia/Kolkata'
- base_currency_code char(3) not null default 'INR'
- created_at, updated_at timestamp

**refresh_tokens**
- id BINARY(16) pk
- user_id BINARY(16) fk users
- token_hash char(64) not null (hex sha256 of the actual token)
- expires_at timestamp
- revoked_at timestamp null
- created_at, last_used_at
- index on (user_id), (token_hash)

**categories**
- id BINARY(16) pk
- user_id BINARY(16) fk users
- type varchar(20) (INCOME|EXPENSE)
- name varchar(80)
- parent_id BINARY(16) fk categories null
- is_default boolean default false
- is_active boolean default true
- sort_order int default 0
- audit cols
- Constraints: parent must be same user + same type + top-level (depth ≤ 2). Sibling name uniqueness per (user_id, type, parent_id, lower(name)) **enforced in service layer**.
- Indexes: (user_id, type), (user_id, parent_id)

**transactions**
- id BINARY(16) pk
- user_id BINARY(16) fk users
- type varchar(20)
- category_id BINARY(16) fk categories
- currency_code char(3) default 'INR'
- status varchar(20) (EXPECTED|ACTUAL)
- expected_amount_minor bigint check >= 0
- expected_date date
- actual_amount_minor bigint check >= 0
- actual_date date
- note varchar(500)
- recurring_rule_id BINARY(16) fk recurring_rules null
- occurrence_key varchar(120)
- audit cols + confirmed_at
- Constraints (service-layer): if status=EXPECTED then expected_amount_minor and expected_date required; if status=ACTUAL then actual_amount_minor and actual_date required; if recurring_rule_id set then occurrence_key required; category type must match tx type
- Indexes: (user_id, actual_date), (user_id, expected_date), (user_id, category_id), (user_id, status), (user_id, type, actual_date), (user_id, type, expected_date)
- Unique: (recurring_rule_id, occurrence_key) — non-null guaranteed when recurring_rule_id is set

**recurring_rules**
- id BINARY(16) pk
- user_id BINARY(16) fk
- type varchar(20)
- category_id BINARY(16) fk
- currency_code char(3)
- default_expected_amount_minor bigint not null check >= 0
- note_template varchar(500)
- schedule_type varchar(20) (MONTHLY|WEEKLY|YEARLY)
- schedule_config JSON (e.g. {"dayOfMonth": 5} or {"dayOfWeek": 1} or {"month": 4, "day": 15})
- start_date date
- end_date date null
- next_run_date date
- is_active boolean default true
- audit cols
- Constraints: end_date >= start_date if present (CHECK); next_run_date >= start_date (service-layer); category type must match rule type (service-layer)
- Indexes: (user_id, next_run_date), (user_id, is_active, next_run_date)

**asset_categories**
- id BINARY(16) pk
- user_id BINARY(16) fk
- name varchar(80)
- kind varchar(20) (bank|investment|cash|crypto|real_estate|gold|other)
- color varchar(20)
- is_active boolean default true
- is_default boolean default false
- sort_order int
- audit cols
- Unique: (user_id, name) — case-insensitive via collation

**net_worth_snapshots**
- id BINARY(16) pk
- user_id BINARY(16) fk
- snapshot_date date not null
- balances JSON (map of asset_category_id → minor units)
- note varchar(500)
- audit cols
- Unique: (user_id, snapshot_date)

### Auto-seed on signup

Trigger or service that creates these defaults for every new user:

**Income categories** (in order): Salary, Side Hustle Income, Freelance, Investments, Other Income

**Expense categories** (in order): Loan, Housing & Groceries, Dining Out or Food & Drinks, Healthcare, Transport or Commute, Fitness or Recreation, Social or Entertainment, Apparel or Personal Care, Household Expenses, Charity or Giving, Investment Loss, Subscriptions & Media, Miscellaneous Loss, ATM, Fuel & Maintenance, Other Expense

**Asset categories** (in order, with colors):
- HDFC Bank (bank, #3b82f6)
- Union Bank (bank, #06b6d4)
- SBI Bank (bank, #14b8a6)
- Stock (investment, #10b981)
- Mutual Funds (investment, #84cc16)
- Others (other, #a78bfa)
- Cash (cash, #f59e0b)

All seeded categories should be `is_default=true` (cannot be deleted, can be deactivated).

## API endpoints (all under /api/v1)

### Auth
- `POST /auth/register` { email, password, phone? } → { user, accessToken, expiresInSeconds } + sets refresh_token cookie
- `POST /auth/login` { email, password } → same response shape
- `POST /auth/refresh` (cookie) → new access token
- `POST /auth/logout` → revokes refresh, clears cookie

### Profile
- `GET /me` → { id, email, phone, baseCurrencyCode, timezone }
- `PATCH /me` { phone?, timezone?, baseCurrencyCode? }

### Categories
- `GET /categories?type=&includeInactive=`
- `POST /categories` { name, type, parentId? }
- `PATCH /categories/{id}` { name?, parentId?, isActive?, sortOrder? }
- `DELETE /categories/{id}` — hard delete if unused; 409 with suggestion to deactivate if used; defaults can only be deactivated

### Transactions
- `GET /transactions?from=&to=&type=&categoryId=&status=&page=&size=&sort=`
- `POST /transactions` (status EXPECTED or ACTUAL)
- `PATCH /transactions/{id}`
- `POST /transactions/{id}/confirm` { actualAmountMinor, actualDate, note? } — only valid if EXPECTED; flips status to ACTUAL, preserves expected fields
- `DELETE /transactions/{id}`

### Recurring rules
- `GET /recurring-rules`
- `POST /recurring-rules`
- `PATCH /recurring-rules/{id}`
- `DELETE /recurring-rules/{id}`
- `POST /recurring/generate` { throughDate? } → { generatedCount, skippedExistingCount, advancedRuleCount }

### Reports
- `GET /reports/monthly?year=&month=` → totals, by_category[], dailyActualTrend[], dailyExpectedTrend[], statusSummary, varianceSummary
- `GET /reports/quarterly?year=&quarter=` → quarter totals, monthBreakdown[3], byCategoryQTD[], varianceSummary

### Net worth
- `GET /asset-categories` / `POST` / `PATCH /{id}` / `DELETE /{id}` (defaults deactivate-only)
- `GET /net-worth-snapshots` / `POST` / `PATCH /{id}` / `DELETE /{id}`
- Note: Surplus and Stock Returns are **computed in the frontend** from snapshot deltas, NOT stored. Backend just stores the raw balances per snapshot.

## Recurring generation algorithm

Triggered on login/app-open by frontend (calling `POST /recurring/generate`), or anytime by user via "Generate now" button.

1. Open a transaction.
2. `SELECT ... FOR UPDATE` active rules where `next_run_date <= today` for current user (MySQL InnoDB supports row-level locking).
3. For each rule: generate occurrences from `next_run_date` through `min(today, end_date)`.
4. For each occurrence date:
   - `occurrence_key` = the date as ISO string (e.g. "2026-05-01")
   - Insert EXPECTED transaction with expected_date = occurrence date, expected_amount_minor = rule.default_expected_amount_minor, recurring_rule_id, occurrence_key
   - Use unique(recurring_rule_id, occurrence_key) constraint as duplicate guard — catch `DuplicateKeyException` and skip
5. Advance next_run_date to the next future occurrence.
6. Commit.

### Edge cases
- **MONTHLY day 31**: clamp to last day of month (Feb 28/29, Apr 30)
- **YEARLY Feb 29**: in non-leap years, generate on Feb 28
- **Rule edited**: only future occurrences use new values; never rewrite history
- **Rule deactivated/deleted**: stop generation; keep already-generated transactions
- **Generated EXPECTED deleted manually**: MVP allows regeneration (skip key only exists if tx exists)
- **Start date in past**: backfill from start_date through today
- **End date past**: generate only through end_date
- **Timezone**: use user's timezone for "today", not server's

## Reporting semantics

**Two lenses, both displayed:**
- **Cash lens**: ACTUAL rows grouped by actual_date
- **Plan lens**: any row with expected_date in period (regardless of status)

**Variance computation per category for the month:**
- For transactions with expected_date in month:
  - if status=EXPECTED: actual contribution = 0
  - if status=ACTUAL: actual contribution = actual_amount_minor
- variance = actual_contribution - expected_amount_minor

All aggregation in SQL via `SUM(CASE WHEN ...)` and `GROUP BY`. Return compact DTOs.

## Frontend UX

Match the existing prototype in this conversation:
- Dense, data-rich, dark theme (slate-900/950 backgrounds, slate-800 borders)
- Sidebar nav: Dashboard, Net Worth, Transactions, Recurring, Quarterly, Categories
- Top bar with current month KPIs
- KPI tiles in grid layout
- Charts via Recharts: line (cumulative cash flow, net worth trend), bar (variance by category, quarterly), pie/donut (expense mix, asset allocation)
- Tabular numbers everywhere (`tabular-nums`)
- Status pills, lens toggles (Both/Planned/Cash)
- Month chip buttons (Jan, Feb, Mar, Apr, May) with transaction counts as badges
- Toast notifications for success/error
- All modals via a shared `<Modal>` component

The prototype is a single-file React artifact ~2500 lines; you'll split it into proper feature folders as you rebuild.

## Tests

**Out of scope for v1.** No `@Test` classes. Manual verification via `curl` and the frontend UI after each module.

## Out of scope (do NOT build)
- Multi-currency conversion (just store currency_code, all INR for now)
- Account/wallet sub-dimension within transactions
- Email sending (no password reset emails yet — out of scope for v1)
- Background scheduler / cron jobs (generate-on-login is enough)
- Budgeting feature
- Mobile app
- Public deployment / CI-CD pipelines (local-first for v1)

## Build order

1. Backend skeleton: pom.xml, application.yml + application-dev.yml, FinTrackApplication.java
2. Flyway migrations: V1__init_schema.sql (all tables, indexes, constraints)
3. common module: error model, global exception handler, custom exceptions, base entity with audit cols
4. security + auth modules: JWT util, JwtAuthenticationFilter, SecurityConfig (allowlist /auth/**, /actuator/health), CurrentUser resolver, AuthController, AuthService, RefreshTokenService, BCrypt config
5. user module: UserController (GET/PATCH /me), UserService, UserEntity
6. category module: full CRUD + default seeding service (called from AuthService on register)
7. transaction module: full CRUD + confirm endpoint
8. recurring module: rules CRUD + generation service (with the algorithm above)
9. reporting module: monthly + quarterly endpoints with SQL aggregation
10. networth module: asset_categories CRUD + snapshots CRUD
11. Frontend skeleton: package.json, vite.config.js, tailwind.config.js, postcss.config.js, index.html, main.jsx, App.jsx with routing, index.css
12. Frontend lib: apiClient.js (axios with interceptors for access token + 401 refresh), auth.jsx (provider + useAuth hook), queryClient.js, format.js
13. Frontend routes: LoginPage, SignupPage, AppLayout, ProtectedRoute
14. Frontend shared components: Modal, KPI, Sidebar, TopBar, Toast
15. Frontend features (in order): transactions, categories, recurring, reports (dashboard + quarterly), networth
16. Final README updates with troubleshooting

Don't generate everything in one go — work module by module, commit frequently if I'm using git.