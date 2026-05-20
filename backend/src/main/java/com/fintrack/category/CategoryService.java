package com.fintrack.category;

import com.fintrack.category.dto.CategoryDto;
import com.fintrack.category.dto.CreateCategoryRequest;
import com.fintrack.category.dto.UpdateCategoryRequest;
import com.fintrack.common.exception.BadRequestException;
import com.fintrack.common.exception.ConflictException;
import com.fintrack.common.exception.NotFoundException;
import com.fintrack.transaction.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CategoryService {

    private final CategoryRepository categories;
    private final TransactionRepository transactions;

    public CategoryService(CategoryRepository categories, TransactionRepository transactions) {
        this.categories = categories;
        this.transactions = transactions;
    }

    public List<CategoryDto> list(UUID userId, String type, boolean includeInactive) {
        return categories.findByFilters(userId, type, includeInactive)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public CategoryDto create(UUID userId, CreateCategoryRequest req) {
        validateParent(userId, req.type(), req.parentId());
        checkSiblingUniqueness(userId, req.type(), req.parentId(), req.name().trim(), null);

        CategoryEntity c = new CategoryEntity();
        c.setId(UUID.randomUUID());
        c.setUserId(userId);
        c.setType(req.type());
        c.setName(req.name().trim());
        c.setParentId(req.parentId());
        c.setDefault(false);
        c.setActive(true);
        c.setSortOrder(0);
        categories.save(c);
        return toDto(c);
    }

    @Transactional
    public CategoryDto update(UUID id, UUID userId, UpdateCategoryRequest req) {
        CategoryEntity c = findOwned(id, userId);

        if (req.name() != null && !req.name().isBlank()) {
            checkSiblingUniqueness(userId, c.getType(), c.getParentId(), req.name().trim(), id);
            c.setName(req.name().trim());
        }
        if (req.isActive() != null) {
            c.setActive(req.isActive());
        }
        if (req.sortOrder() != null) {
            c.setSortOrder(req.sortOrder());
        }
        if (req.parentId() != null) {
            if (c.isDefault()) {
                throw new BadRequestException("CANNOT_REPARENT_DEFAULT", "Default categories cannot be reparented");
            }
            validateParent(userId, c.getType(), req.parentId());
            checkSiblingUniqueness(userId, c.getType(), req.parentId(), c.getName(), id);
            c.setParentId(req.parentId());
        }
        return toDto(c);
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        CategoryEntity c = findOwned(id, userId);
        if (c.isDefault()) {
            throw new ConflictException("DEFAULT_CATEGORY", "Default categories cannot be deleted. Deactivate instead.");
        }
        if (categories.existsByParentIdAndUserId(id, userId)) {
            throw new BadRequestException("HAS_CHILDREN", "Delete or move subcategories first.");
        }
        if (transactions.existsByCategoryId(id)) {
            throw new ConflictException("CATEGORY_IN_USE", "Category has transactions. Deactivate it instead.");
        }
        categories.delete(c);
    }

    private void validateParent(UUID userId, String type, UUID parentId) {
        if (parentId == null) return;
        CategoryEntity parent = categories.findByIdAndUserId(parentId, userId)
                .orElseThrow(() -> new BadRequestException("PARENT_NOT_FOUND", "Parent category not found"));
        if (!parent.getType().equals(type)) {
            throw new BadRequestException("TYPE_MISMATCH", "Parent category must have the same type");
        }
        if (parent.getParentId() != null) {
            throw new BadRequestException("TOO_DEEP", "Category nesting is limited to 2 levels");
        }
    }

    private void checkSiblingUniqueness(UUID userId, String type, UUID parentId, String name, UUID excludeId) {
        boolean exists;
        if (excludeId == null) {
            exists = parentId == null
                    ? categories.existsByUserIdAndTypeAndParentIdIsNullAndNameIgnoreCase(userId, type, name)
                    : categories.existsByUserIdAndTypeAndParentIdAndNameIgnoreCase(userId, type, parentId, name);
        } else {
            exists = parentId == null
                    ? categories.existsSiblingWithNullParentExcluding(userId, type, name, excludeId)
                    : categories.existsSiblingWithParentExcluding(userId, type, parentId, name, excludeId);
        }
        if (exists) {
            throw new ConflictException("DUPLICATE_CATEGORY_NAME", "A category with this name already exists at this level");
        }
    }

    private CategoryEntity findOwned(UUID id, UUID userId) {
        return categories.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Category not found"));
    }

    private CategoryDto toDto(CategoryEntity c) {
        return new CategoryDto(c.getId(), c.getUserId(), c.getType(), c.getName(),
                c.getParentId(), c.isDefault(), c.isActive(), c.getSortOrder());
    }
}
