package com.fintrack.category;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class DefaultCategorySeeder {

    private final CategoryRepository categories;

    public DefaultCategorySeeder(CategoryRepository categories) {
        this.categories = categories;
    }

    @Transactional
    public void seedForUser(UUID userId) {
        String[] incomeNames = {
            "Salary", "Side Hustle Income", "Freelance", "Investments", "Other Income"
        };
        for (int i = 0; i < incomeNames.length; i++) {
            save(userId, "INCOME", incomeNames[i], i);
        }

        String[] expenseNames = {
            "Loan", "Housing & Groceries", "Dining Out or Food & Drinks", "Healthcare",
            "Transport or Commute", "Fitness or Recreation", "Social or Entertainment",
            "Apparel or Personal Care", "Household Expenses", "Charity or Giving",
            "Investment Loss", "Subscriptions & Media", "Miscellaneous Loss", "ATM",
            "Fuel & Maintenance", "Other Expense"
        };
        for (int i = 0; i < expenseNames.length; i++) {
            save(userId, "EXPENSE", expenseNames[i], i);
        }
    }

    private void save(UUID userId, String type, String name, int sortOrder) {
        CategoryEntity c = new CategoryEntity();
        c.setId(UUID.randomUUID());
        c.setUserId(userId);
        c.setType(type);
        c.setName(name);
        c.setDefault(true);
        c.setActive(true);
        c.setSortOrder(sortOrder);
        categories.save(c);
    }
}
