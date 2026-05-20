package com.fintrack.networth;

import com.fintrack.common.exception.ConflictException;
import com.fintrack.common.exception.NotFoundException;
import com.fintrack.networth.dto.AssetCategoryDto;
import com.fintrack.networth.dto.CreateAssetCategoryRequest;
import com.fintrack.networth.dto.UpdateAssetCategoryRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AssetCategoryService {

    private final AssetCategoryRepository assetCategories;

    public AssetCategoryService(AssetCategoryRepository assetCategories) {
        this.assetCategories = assetCategories;
    }

    public List<AssetCategoryDto> list(UUID userId) {
        return assetCategories.findByUserIdOrderBySortOrderAscNameAsc(userId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public AssetCategoryDto create(UUID userId, CreateAssetCategoryRequest req) {
        if (assetCategories.existsByUserIdAndNameIgnoreCase(userId, req.name())) {
            throw new ConflictException("DUPLICATE_NAME", "An asset category with this name already exists");
        }
        AssetCategoryEntity a = new AssetCategoryEntity();
        a.setId(UUID.randomUUID());
        a.setUserId(userId);
        a.setName(req.name().trim());
        a.setKind(req.kind());
        a.setColor(req.color());
        a.setDefault(false);
        a.setActive(true);
        a.setSortOrder(0);
        assetCategories.save(a);
        return toDto(a);
    }

    @Transactional
    public AssetCategoryDto update(UUID id, UUID userId, UpdateAssetCategoryRequest req) {
        AssetCategoryEntity a = findOwned(id, userId);
        if (req.name() != null) a.setName(req.name().trim());
        if (req.kind() != null) a.setKind(req.kind());
        if (req.color() != null) a.setColor(req.color());
        if (req.isActive() != null) a.setActive(req.isActive());
        if (req.sortOrder() != null) a.setSortOrder(req.sortOrder());
        return toDto(a);
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        AssetCategoryEntity a = findOwned(id, userId);
        if (a.isDefault()) {
            throw new ConflictException("DEFAULT_CATEGORY", "Default asset categories cannot be deleted. Deactivate instead.");
        }
        assetCategories.delete(a);
    }

    private AssetCategoryEntity findOwned(UUID id, UUID userId) {
        return assetCategories.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Asset category not found"));
    }

    private AssetCategoryDto toDto(AssetCategoryEntity a) {
        return new AssetCategoryDto(a.getId(), a.getName(), a.getKind(), a.getColor(),
                a.isActive(), a.isDefault(), a.getSortOrder());
    }
}
