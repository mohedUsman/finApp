# New Features — October 2026

Nine features added on top of the v1 app, listed newest first. Each entry says what it does, what it deliberately does *not* do, and exactly how to try it locally.

`README.md` documents the original v1 application. This file covers only what changed since.

> **Three of these were explicitly out of scope in `CLAUDE.md`** — password reset, multi-currency, and shared accounts. They were built anyway on request. The "Out of scope (v1)" list in `CLAUDE.md` is now stale for those three items; everything else on it still stands.

---

## Contents

| # | Feature | Commit | Needs a rebuild? |
|---|---|---|---|
| 9 | [Bank statement CSV import](#9-bank-statement-csv-import) | `bb99440` | Yes — migration V8 |
| 8 | [Household sharing](#8-household-sharing) | `478f990` | Yes — migration V7 |
| 7 | [Multi-currency support](#7-multi-currency-support) | `9843a82` | Yes — migration V6 |
| 6 | [Password reset](#6-password-reset) | `1f272b1` | Yes — migration V5 |
| 5 | [Year-over-year comparison](#5-year-over-year-comparison) | `1634568` | Frontend only |
| 4 | [Bulk select / delete / recategorize](#4-bulk-select--delete--recategorize) | `2559de9` | Frontend only |
| 3 | [Dashboard customization](#3-dashboard-customization) | `502477c` | Frontend only |
| 2 | [Tags](#2-tags) | `4933c0b` | Yes — migration V4 |
| 1 | [Budget alerts, savings goals, search, recurring preview, range reports](#1-budget-alerts-savings-goals-search-recurring-preview-range-reports) | `9a6943f` | Yes — migration V3 |

---

## Before you start

The steps below assume the app is running. If it isn't, see **[Running it locally](#running-it-locally)** at the bottom — this machine needs a few things the README doesn't mention (containerised MySQL, JDK 21 specifically, env vars instead of `.env`).

Migrations V3–V8 apply automatically on the next backend boot. Nothing needs to be run by hand.

A note on the curl examples: they all need a token. Grab one once and reuse it:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"yourpassword"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
```

Then pass `-H "Authorization: Bearer $TOKEN"` on each request. Tokens last 15 minutes.

---

## 9. Bank statement CSV import

**Where:** sidebar → **Bank Import** (`/import`)

Upload the CSV your bank lets you download, map its columns, review every parsed row, then import. Nothing is written to the database until you press Import — the preview step is read-only.

**This is not Plaid.** Real bank linking needs API credentials and a publicly reachable callback URL, neither of which this app has. This works from downloaded statement files instead, which is the closest equivalent that actually runs here.

What it handles:

- **Three amount layouts**, because banks disagree: one signed column (negative = expense), separate debit/credit columns, or an amount column plus a `DR`/`CR` marker column.
- **Messy real-world values** — quoted commas inside merchant names, `1,299.00` thousands separators, `(500.00)` parenthesised negatives, and a trailing `Dr`/`Cr` stuck onto the figure itself.
- **Dates** in nine common formats, auto-detected, or pin one down explicitly if your bank is ambiguous (`03/04/2026` could be March or April).
- **Duplicate detection** — matching date + amount + type + description. Matching rows are flagged and left unticked, so re-importing an overlapping statement won't double up.
- **Auto-categorization** from keyword rules. Longer keywords win, so `SWIGGY INSTAMART → Household` beats `SWIGGY → Dining`.
- **Unreadable rows** are reported individually with a reason, rather than failing the whole file.

Imported rows are saved as **ACTUAL** in **INR** (a statement records money that already moved).

Limits: 5 MB and 5,000 rows per file.

### Try it in the UI

1. Save this as `statement.csv` anywhere:

   ```csv
   Txn Date,Narration,Withdrawal,Deposit,Balance
   05/10/2026,"SWIGGY ORDER, BANGALORE",480.00,,52000.00
   06/10/2026,SALARY CREDIT OCT,,85000.00,137000.00
   07/10/2026,UBER TRIP 4412,220.50,,136779.50
   08/10/2026,"AMAZON RETAIL (INDIA)","1,299.00",,135480.50
   09/10/2026,SWIGGY INSTAMART,650.00,,134830.50
   notadate,BROKEN ROW,100.00,,0
   ```

   That last row is deliberately broken — it's there so you can see the error handling.

2. Go to **Bank Import**. Before uploading, add a couple of rules in the **Category rules** panel: `SWIGGY` → *Dining Out*, `SALARY` → *Salary*.

3. Upload the file. Set **Separate debit / credit**, Date = col 1, Description = col 2, Debit = col 3, Credit = col 4, format `dd/MM/yyyy`. Press **Preview rows**.

4. What you should see:
   - 5 readable rows, 1 error (`Could not read the date "notadate"`)
   - SWIGGY and SALARY rows pre-filled with categories, tagged `auto`
   - AMAZON has no suggestion — pick one manually, and tick **Remember** next to it
   - The salary row is green/`+`, the rest red/`−`

5. Press **Import**. Then upload the *same file again* — the rows you just imported now show **already imported** and are unticked. The AMAZON row is now auto-categorized from the rule you saved.

### Try it with curl

```bash
# Preview (writes nothing)
echo '{"dateColumn":0,"descriptionColumn":1,"debitColumn":2,"creditColumn":3,"dateFormat":"dd/MM/yyyy","hasHeaderRow":true}' > mapping.json

curl -s -X POST http://localhost:8080/api/v1/import/preview \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@statement.csv;type=text/csv" \
  -F "mapping=@mapping.json;type=application/json"
```

Run curl from the directory containing the files — `-F "file=@..."` resolves relative to the working directory, not to the paths in this doc.

```bash
# Keyword rules
curl -s http://localhost:8080/api/v1/import/rules -H "Authorization: Bearer $TOKEN"

curl -s -X PUT http://localhost:8080/api/v1/import/rules \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"keyword":"SWIGGY","categoryId":"<a-category-uuid>"}'
```

### Worth checking

| Try this | Expected |
|---|---|
| Map neither an amount nor a debit/credit column | `400 INVALID_MAPPING` |
| Send a row with an INCOME type but an expense category | Row reported in `errors[]`, the rest still import |
| Delete a category that a keyword rule points at | `409` with "Remove the rule first" |
| Upload a file over 5,000 rows | `400 TOO_MANY_ROWS` naming the actual count |

### Not the same as the old CSV import

The **Import** button on the Transactions page (now labelled *Re-import a FinTrack export*) is a different, pre-existing thing: it only reads FinTrack's **own** export format, matching categories by exact name. It can't read an arbitrary bank file. Both were kept; use **Bank Import** for statements.

---

## 8. Household sharing

**Where:** sidebar → **Settings** → *Household*

Invite someone to see and work on your financial data. Two roles:

- **MEMBER** — reads and edits everything: transactions, categories, recurring rules, net worth, reports.
- **VIEWER** — reads the same data, but every write is refused with `403`.

There's no email provider in this app, so **the invite token is written to the backend log instead of emailed**. That's the only shortcut — the token itself is hashed, single-use, expires in 7 days, and is bound to the invited email address.

**Design note:** `CLAUDE.md`'s architectural decision #1 is "no ledger table, `user_id` on every domain table". That still holds — no domain table changed shape. A new `@DataOwner` resolver widens *who may act as* a given `user_id`. The alternative (a full multi-tenant `household_id` migration) would have touched every query in the app.

Households don't nest. An owner who already has members can't join someone else's household, and a joined member can't invite others.

### Try it

You need two accounts. Register a second one at `/signup` in a private window.

1. As the **owner**, go to Settings → Household → invite the second account's email, role **MEMBER**.

2. Grab the token from the backend log:

   ```bash
   grep "Household invite" /tmp/fintrack-backend.log | tail -1
   ```

   (If you started the backend some other way, look wherever its output goes.)

3. As the **member**, go to Settings → Household → paste the token under *Join a household* → **Join**.

4. The member's Transactions page now shows the **owner's** transactions. Add one as the member — the owner sees it, and it counts toward the owner's Dashboard totals.

5. Back as the owner, invite a third account as **VIEWER**. That account can read everything but any add/edit/delete returns *"You have view-only access to this household"*.

6. **Leave household** (as a member) or the owner removing them both restore that account's own separate data immediately.

### Try it with curl

```bash
curl -s http://localhost:8080/api/v1/household -H "Authorization: Bearer $TOKEN"

curl -s -X POST http://localhost:8080/api/v1/household/invites \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"email":"partner@example.com","role":"MEMBER"}'

curl -s -X POST http://localhost:8080/api/v1/household/invites/accept \
  -H "Authorization: Bearer $MEMBER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"token":"<token-from-the-log>"}'
```

### Worth checking

| Try this | Expected |
|---|---|
| Accept an invite sent to a different email | `400` "sent to a different email" |
| Accept the same invite twice | `400 INVALID_INVITE` (single-use) |
| A joined member tries to invite someone | `400 ALREADY_MEMBER` |
| An owner with members tries to join another household | `400 OWNS_HOUSEHOLD` |
| A VIEWER tries any write | `403 FORBIDDEN` |

---

## 7. Multi-currency support

**Where:** sidebar → **Settings**; currency dropdowns in the transaction and recurring-rule forms

Record transactions in any of 11 currencies, with reports converting everything into your base currency.

**There is no live FX feed.** Rates are entered by hand in Settings and are yours alone. Update them when they move.

How conversion works: reports join your `exchange_rates` table in SQL and convert inline, which keeps `CLAUDE.md`'s "reporting is pure SQL" rule intact. A currency with **no rate on file is treated as 1:1** rather than being dropped — so nothing silently disappears from your totals, but an unconverted figure will look wrong until you add its rate.

### Try it

1. **Settings → Exchange Rates** → add `USD` at `83.25`.

2. **Transactions → New** → set Currency to **USD**, amount `100.00`, status ACTUAL, today's date.

3. The Transactions table shows it as **$100.00**. The Dashboard and the TopBar KPIs show it converted — ₹8,325 — because reports work in your base currency.

4. **Settings → Base Currency** → switch to USD → Save. Reports now total in dollars, and the TopBar's symbol follows.

5. With both an INR and a USD transaction on screen, the Transactions page summary tiles are replaced by an amber notice. That's deliberate: those tiles add raw minor units client-side, so mixing currencies there would silently add incompatible numbers. Converted totals live on the Dashboard.

### Try it with curl

```bash
curl -s -X PUT http://localhost:8080/api/v1/exchange-rates \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"currencyCode":"USD","rateToBase":83.0}'

curl -s http://localhost:8080/api/v1/exchange-rates -H "Authorization: Bearer $TOKEN"

# 100 USD -> reports should show 830000 minor units (8300 INR)
curl -s "http://localhost:8080/api/v1/reports/monthly?year=2026&month=10" \
  -H "Authorization: Bearer $TOKEN" | grep -o '"totalActualIncomeMinor":[0-9]*'
```

### Worth checking

| Try this | Expected |
|---|---|
| Add a rate for your own base currency | `400 BASE_CURRENCY` |
| Delete the USD rate, then re-check the report | USD amounts revert to 1:1, not dropped |
| Create a recurring rule in EUR, then Generate now | Generated transactions inherit EUR |

---

## 6. Password reset

**Where:** `/login` → **Forgot password?**

Standard reset flow. **No email is sent** — there's no mail provider in this project, so the reset link is written to the backend log. Everything else is real: the token is SHA-256 hashed in the database, expires in 30 minutes, and works exactly once.

`/forgot-password` always returns `204`, whether or not the email exists. That's intentional — a different response for unknown emails would let someone enumerate which addresses have accounts.

### Try it

1. Go to `/login` → **Forgot password?** → enter a registered email → submit.

2. Find the token in the backend log:

   ```bash
   grep "Password reset requested" /tmp/fintrack-backend.log | tail -1
   ```

3. Visit `http://localhost:5173/reset-password?token=<token>` → set a new password.

4. Log in with it. Then try the same link again — it's rejected as already used.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/v1/auth/forgot-password \
  -H 'Content-Type: application/json' -d '{"email":"you@example.com"}'
# 204, and also 204 for an address that doesn't exist
```

Note that `/auth/forgot-password` and `/auth/reset-password` are rate-limited alongside login and register, so hammering them in a loop will start returning `429`.

---

## 5. Year-over-year comparison

**Where:** sidebar → **Year over Year** (`/reports/yoy`)

The same month this year against last year, side by side: KPI deltas with percent-change badges, a top-10-by-change bar chart, and a full category table showing both years plus the swing.

No backend changes — it calls the existing `/reports/monthly` endpoint twice.

**Try it:** you need transactions in the same month across two different years, otherwise one side is all zeros. Add a couple dated last year, then open the page and pick that month. Categories active in only one of the two years still appear, with zero on the other side, instead of vanishing from the comparison.

---

## 4. Bulk select / delete / recategorize

**Where:** Transactions page

Checkboxes on each row plus a select-all in the header. Once anything is selected, an action bar offers bulk delete and bulk recategorize.

No backend changes — it reuses the existing per-transaction endpoints, and failures are reported per row rather than aborting the batch.

**Try it:** tick several transactions → **Recategorize** → pick a category. Then select a mix of income *and* expense rows — the category list comes up empty, because a category can only belong to one type and the server would reject the mismatch anyway. Changing a filter clears the selection, since it only ever applies to the rows currently on screen.

---

## 3. Dashboard customization

**Where:** Dashboard → **Customize**

Reorder or hide any of the six dashboard sections (KPIs, Monthly Summary, Daily Cash Flow, Planned vs Actual, Budgets, Category Breakdown).

Saved to **localStorage**, not your account — it's a per-device display preference. So it won't follow you to another browser, and clearing site data resets it. That also means there's no migration or API behind it.

**Try it:** hide a couple of sections, reorder the rest, reload the page — the layout sticks. Open the app in a different browser and it's back to default, which is expected.

---

## 2. Tags

**Where:** sidebar → **Tags**; tag chips in the transaction form

Free-form labels that cut across categories. A transaction has exactly one category but any number of tags, so things like `vacation` or `work-trip` can group spending that spans several categories.

Each tag has a name (unique per user) and a colour.

### Try it

1. **Tags** → create `vacation` with a colour.
2. **Transactions → New** → fill in the form and toggle the `vacation` chip.
3. The tag now shows next to the category in both the Transactions table and Search results.
4. Editing a transaction's tags replaces the whole set — untick to remove.

```bash
curl -s http://localhost:8080/api/v1/tags -H "Authorization: Bearer $TOKEN"

curl -s -X POST http://localhost:8080/api/v1/tags \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"vacation","color":"#10b981"}'
```

Duplicate names and malformed colours (anything not `#rrggbb`) are both rejected.

---

## 1. Budget alerts, savings goals, search, recurring preview, range reports

Five smaller features committed together.

### Budget alerts

Set a monthly budget on a category (**Categories** page). When an ACTUAL expense pushes that category over its budget, a warning toast appears — after a manual add, after confirming a planned transaction, and after a CSV import.

It's a client-side check that re-reads the existing monthly report, so there's no new backend logic and no stored alert state.

**Try it:** give a category a small budget like ₹100, then add a ₹500 expense to it.

### Savings goals

**Where:** sidebar → **Savings Goals**

Named goals with a target amount and a progress bar. Contribute or withdraw through a modal.

**Try it:** create a goal with a ₹10,000 target, contribute ₹2,500, watch the bar move. Then try withdrawing more than the balance — it's refused rather than going negative.

```bash
curl -s http://localhost:8080/api/v1/savings-goals -H "Authorization: Bearer $TOKEN"
```

### Global search

**Where:** sidebar → **Search**

Unlike the Transactions page, this isn't scoped to a month. Search note text and filter by amount range across your whole history.

**Try it:** search for a word in a note, then narrow with a min/max amount.

### Recurring rule preview

**Where:** the recurring rule form

Shows the next 5 dates a schedule would generate, before you save it. Nothing is persisted by the preview.

**Try it:** create a monthly rule on day 31 and look at the preview — February clamps to the 28th (or 29th in a leap year), April to the 30th.

### Custom range reports

**Where:** sidebar → **Custom Range**

Reports over an arbitrary date range instead of a calendar month, with presets for 30/90/180 days and year-to-date, plus a daily net trend chart.

**Try it:** pick *Last 90 days*, then set a custom start and end date spanning two months — something the monthly and quarterly views can't do.

---

## Running it locally

This machine's setup differs from the README's assumptions in three ways.

**1. MySQL runs in a container** (none is installed locally):

```bash
docker run -d --name fintrack-mysql \
  -e MYSQL_ROOT_PASSWORD=fintrack -e MYSQL_DATABASE=fintrack \
  -p 3306:3306 mysql:8.0
```

Docker here is **Rancher Desktop**, and its daemon is often stopped — launch `C:\Program Files\Rancher Desktop\Rancher Desktop.exe` and give it ~10s before any `docker` command works.

**2. JDK 21 specifically.** The system default `java` is JDK 25; the pom targets 21.

**3. Pass config as shell env vars** rather than `backend/.env`.

```bash
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot"
export PATH="$JAVA_HOME/bin:$PATH"
export DATASOURCE_URL="jdbc:mysql://localhost:3306/fintrack?createDatabaseIfNotExist=true&allowPublicKeyRetrieval=true&useSSL=false"
export DATASOURCE_USERNAME=root
export DATASOURCE_PASSWORD=fintrack
export JWT_SECRET="this_is_a_local_dev_jwt_secret_key_32chars_min"

cd backend
mvn clean package -DskipTests
java -jar target/fintrack-backend.jar > /tmp/fintrack-backend.log 2>&1 &
```

The jar is `target/fintrack-backend.jar` — the pom overrides `finalName`, so there's no version suffix. **Stop any running instance before rebuilding**, or Maven fails on the locked jar:

```bash
PID=$(netstat -ano | grep ':8080' | grep LISTENING | head -1 | awk '{print $NF}')
powershell -Command "Stop-Process -Id $PID -Force"
```

Frontend:

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Watch for `Started FinTrackApplication` and the Flyway lines in the log on first boot — migrations V3–V8 apply themselves.

### There is no test suite

`backend/src/test` doesn't exist and `mvn test` won't verify anything. Everything above was checked by curl and through the UI. That's the intended verification path for this project.

### Cleaning up test data

Register throwaway accounts for testing and remove them through the app, not with SQL:

```bash
curl -s -X DELETE http://localhost:8080/api/v1/me \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"TestPass123!"}'
```

A direct `DELETE FROM users` fails — several foreign keys are `RESTRICT`. The endpoint deletes things in the right order.

---

## Schema changes

| Migration | Adds |
|---|---|
| `V3__add_savings_goals.sql` | `savings_goals` |
| `V4__add_tags.sql` | `tags`, `transaction_tags` |
| `V5__add_password_reset_tokens.sql` | `password_reset_tokens` |
| `V6__add_exchange_rates.sql` | `exchange_rates` |
| `V7__add_household_sharing.sql` | `household_members`, `household_invites` |
| `V8__add_import_rules.sql` | `import_rules` |

`V2__add_category_budget.sql` (category budgets) predates this batch.

Hibernate runs with `ddl-auto: validate`, so any new entity field without a matching migration stops the app at boot rather than silently drifting.

## New API endpoints

```
POST   /api/v1/auth/forgot-password        (public, rate-limited)
POST   /api/v1/auth/reset-password         (public, rate-limited)

GET    /api/v1/exchange-rates
PUT    /api/v1/exchange-rates
DELETE /api/v1/exchange-rates/{id}

GET    /api/v1/household
POST   /api/v1/household/invites
POST   /api/v1/household/invites/accept
DELETE /api/v1/household/invites/{id}
DELETE /api/v1/household/members/{id}
POST   /api/v1/household/leave

POST   /api/v1/import/preview              (multipart; writes nothing)
POST   /api/v1/import/commit
GET    /api/v1/import/rules
PUT    /api/v1/import/rules
DELETE /api/v1/import/rules/{id}

GET    /api/v1/tags
POST   /api/v1/tags
PATCH  /api/v1/tags/{id}
DELETE /api/v1/tags/{id}

GET    /api/v1/savings-goals               (plus POST / PATCH / DELETE)
POST   /api/v1/savings-goals/{id}/contribute

GET    /api/v1/transactions/search
POST   /api/v1/recurring-rules/preview
GET    /api/v1/reports/range
```

## Known gaps

- **No emails are sent.** Password reset links and household invite tokens are written to the backend log. Wiring an SMTP provider is the only thing standing between this and a working email flow.
- **Exchange rates are manual.** No FX feed. A currency with no rate is treated as 1:1, so a missing rate shows an unconverted figure rather than an error.
- **Bank import is file-based, not linked.** Plaid-style account linking needs credentials and a public callback URL.
- **Dashboard layout is per-browser**, since it lives in localStorage.
- **Still no automated tests.**
