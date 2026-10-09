-- Optional per-category monthly budget, compared against actual spend on the
-- Dashboard. NULL means "no budget set" for that category.
ALTER TABLE categories
  ADD COLUMN monthly_budget_minor BIGINT NULL AFTER sort_order,
  ADD CONSTRAINT ck_categories_budget_nonneg CHECK (monthly_budget_minor IS NULL OR monthly_budget_minor >= 0);
