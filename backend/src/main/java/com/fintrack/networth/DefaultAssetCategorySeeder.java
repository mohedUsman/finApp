package com.fintrack.networth;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class DefaultAssetCategorySeeder {

    private final AssetCategoryRepository assetCategories;

    public DefaultAssetCategorySeeder(AssetCategoryRepository assetCategories) {
        this.assetCategories = assetCategories;
    }

    @Transactional
    public void seedForUser(UUID userId) {
        save(userId, "HDFC Bank",     "bank",       "#3b82f6", 0);
        save(userId, "Union Bank",    "bank",       "#06b6d4", 1);
        save(userId, "SBI Bank",      "bank",       "#14b8a6", 2);
        save(userId, "Stock",         "investment", "#10b981", 3);
        save(userId, "Mutual Funds",  "investment", "#84cc16", 4);
        save(userId, "Others",        "other",      "#a78bfa", 5);
        save(userId, "Cash",          "cash",       "#f59e0b", 6);
    }

    private void save(UUID userId, String name, String kind, String color, int sortOrder) {
        AssetCategoryEntity a = new AssetCategoryEntity();
        a.setId(UUID.randomUUID());
        a.setUserId(userId);
        a.setName(name);
        a.setKind(kind);
        a.setColor(color);
        a.setDefault(true);
        a.setActive(true);
        a.setSortOrder(sortOrder);
        assetCategories.save(a);
    }
}
