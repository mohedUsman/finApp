package com.fintrack.networth;

import com.fintrack.common.BaseEntity;
import com.fintrack.common.UuidBinaryConverter;
import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "asset_categories")
public class AssetCategoryEntity extends BaseEntity {

    @Id
    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID id;

    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "user_id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "name", length = 80, nullable = false)
    private String name;

    @Column(name = "kind", length = 20, nullable = false)
    private String kind;

    @Column(name = "color", length = 20)
    private String color;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault = false;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean isActive) { this.isActive = isActive; }

    public boolean isDefault() { return isDefault; }
    public void setDefault(boolean isDefault) { this.isDefault = isDefault; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
