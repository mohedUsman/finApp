package com.fintrack.networth;

import com.fintrack.networth.dto.*;
import com.fintrack.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class NetWorthController {

    private final AssetCategoryService assetCategoryService;
    private final NetWorthService netWorthService;

    public NetWorthController(AssetCategoryService assetCategoryService, NetWorthService netWorthService) {
        this.assetCategoryService = assetCategoryService;
        this.netWorthService = netWorthService;
    }

    @GetMapping("/asset-categories")
    public ResponseEntity<List<AssetCategoryDto>> listAssetCategories(@CurrentUser UUID userId) {
        return ResponseEntity.ok(assetCategoryService.list(userId));
    }

    @PostMapping("/asset-categories")
    public ResponseEntity<AssetCategoryDto> createAssetCategory(
            @CurrentUser UUID userId,
            @Valid @RequestBody CreateAssetCategoryRequest req) {
        return ResponseEntity.ok(assetCategoryService.create(userId, req));
    }

    @PatchMapping("/asset-categories/{id}")
    public ResponseEntity<AssetCategoryDto> updateAssetCategory(
            @CurrentUser UUID userId,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAssetCategoryRequest req) {
        return ResponseEntity.ok(assetCategoryService.update(id, userId, req));
    }

    @DeleteMapping("/asset-categories/{id}")
    public ResponseEntity<Void> deleteAssetCategory(
            @CurrentUser UUID userId,
            @PathVariable UUID id) {
        assetCategoryService.delete(id, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/net-worth-snapshots")
    public ResponseEntity<List<NetWorthSnapshotDto>> listSnapshots(@CurrentUser UUID userId) {
        return ResponseEntity.ok(netWorthService.list(userId));
    }

    @PostMapping("/net-worth-snapshots")
    public ResponseEntity<NetWorthSnapshotDto> createSnapshot(
            @CurrentUser UUID userId,
            @Valid @RequestBody CreateSnapshotRequest req) {
        return ResponseEntity.ok(netWorthService.create(userId, req));
    }

    @PatchMapping("/net-worth-snapshots/{id}")
    public ResponseEntity<NetWorthSnapshotDto> updateSnapshot(
            @CurrentUser UUID userId,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateSnapshotRequest req) {
        return ResponseEntity.ok(netWorthService.update(id, userId, req));
    }

    @DeleteMapping("/net-worth-snapshots/{id}")
    public ResponseEntity<Void> deleteSnapshot(
            @CurrentUser UUID userId,
            @PathVariable UUID id) {
        netWorthService.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
