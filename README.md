# FinTrack — Personal Finance Tracker

Production-ready personal finance tracker. Local-first for 1 user + a few family members.

See `CONTEXT.md` for architectural decisions.

## Stack

| Layer | Choice |
|---|---|
| Backend | Java 21, Spring Boot 3.3.x, Maven |
| ORM | Spring Data JPA + Hibernate |
| Migrations | Flyway |
| DB | MySQL 8 (local install) |
| Auth | JWT access (15m) + refresh (7d, HttpOnly cookie), BCrypt |
| Frontend | React 18, Vite, plain JavaScript, Tailwind CSS, Recharts, TanStack Query, React Hook Form + Zod, axios |
| Money | bigint minor units (paise), display ₹ INR |
| API | REST, JSON, all under `/api/v1` |

## Quickstart

### 1. Set up MySQL

Make sure MySQL 8 is running locally on port 3306. Then run the bootstrap script once as root:

```bash
mysql -u root -p < db/bootstrap.sql
```

This creates database `fintrack` and user `fintrack`@`localhost`. Edit `db/bootstrap.sql` first if you want a different password.

### 2. Configure env

Edit `.env` in the repo root. At minimum, set:

- `DATASOURCE_PASSWORD` — matches the password from `db/bootstrap.sql`
- `JWT_SECRET` — generate with `openssl rand -base64 48`

`.env` is gitignored.

### 3. Run backend

```bash
cd backend
mvn spring-boot:run
```

Backend listens on `http://localhost:8080`. API root is `http://localhost:8080/api/v1`. Flyway runs migrations on startup.

### 4. Run frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend on `http://localhost:5173`.

### 5. Register

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"hunter2hunter2"}'
```

Default income/expense categories and asset buckets are seeded automatically on first registration.

## Repo layout

```
finance-tracker/
├── backend/         Spring Boot app (Maven)
├── frontend/        React + Vite app
├── db/bootstrap.sql One-shot MySQL setup script
├── CONTEXT.md       Architectural decisions
├── prototype.jsx    UX reference (single-file React prototype)
├── .env             Local secrets (gitignored)
└── README.md
```

## Troubleshooting

- **Backend can't connect to MySQL**: confirm `mysqld` is running (`mysqladmin -u root -p ping`) and `.env` `DATASOURCE_*` values match `db/bootstrap.sql`.
- **`Public Key Retrieval is not allowed`**: the JDBC URL in `.env` includes `allowPublicKeyRetrieval=true` to handle this; if you regenerate the URL, keep that flag.
- **Time zone errors**: the JDBC URL pins `serverTimezone=Asia/Kolkata`. If your MySQL server timezone differs, prefer setting the JDBC param rather than changing the server.
- **CORS errors from the frontend**: add the origin to `CORS_ALLOWED_ORIGINS` (comma-separated) and restart the backend.
- **Reset the database**: `DROP DATABASE fintrack;` then re-run `db/bootstrap.sql`. Flyway will rebuild the schema on next backend start.
