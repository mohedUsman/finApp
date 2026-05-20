package com.fintrack.category;

import com.fintrack.category.dto.CategoryDto;
import com.fintrack.category.dto.CreateCategoryRequest;
import com.fintrack.category.dto.UpdateCategoryRequest;
import com.fintrack.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/categories")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public ResponseEntity<List<CategoryDto>> list(
            @CurrentUser UUID userId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        return ResponseEntity.ok(categoryService.list(userId, type, includeInactive));
    }

    @PostMapping
    public ResponseEntity<CategoryDto> create(
            @CurrentUser UUID userId,
            @Valid @RequestBody CreateCategoryRequest req) {
        return ResponseEntity.ok(categoryService.create(userId, req));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<CategoryDto> update(
            @CurrentUser UUID userId,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateCategoryRequest req) {
        return ResponseEntity.ok(categoryService.update(id, userId, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @CurrentUser UUID userId,
            @PathVariable UUID id) {
        categoryService.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
