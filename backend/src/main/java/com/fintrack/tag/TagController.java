package com.fintrack.tag;

import com.fintrack.security.CurrentUser;
import com.fintrack.tag.dto.CreateTagRequest;
import com.fintrack.tag.dto.TagDto;
import com.fintrack.tag.dto.UpdateTagRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tags")
public class TagController {

    private final TagService tagService;

    public TagController(TagService tagService) {
        this.tagService = tagService;
    }

    @GetMapping
    public ResponseEntity<List<TagDto>> list(@CurrentUser UUID userId) {
        return ResponseEntity.ok(tagService.list(userId));
    }

    @PostMapping
    public ResponseEntity<TagDto> create(@CurrentUser UUID userId, @Valid @RequestBody CreateTagRequest req) {
        return ResponseEntity.ok(tagService.create(userId, req));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<TagDto> update(@CurrentUser UUID userId, @PathVariable UUID id,
                                          @Valid @RequestBody UpdateTagRequest req) {
        return ResponseEntity.ok(tagService.update(id, userId, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@CurrentUser UUID userId, @PathVariable UUID id) {
        tagService.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
