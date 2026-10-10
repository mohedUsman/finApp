package com.fintrack.tag;

import com.fintrack.common.exception.ConflictException;
import com.fintrack.common.exception.NotFoundException;
import com.fintrack.tag.dto.CreateTagRequest;
import com.fintrack.tag.dto.TagDto;
import com.fintrack.tag.dto.UpdateTagRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class TagService {

    private final TagRepository tags;

    public TagService(TagRepository tags) {
        this.tags = tags;
    }

    public List<TagDto> list(UUID userId) {
        return tags.findByUserIdOrderByNameAsc(userId).stream().map(this::toDto).toList();
    }

    @Transactional
    public TagDto create(UUID userId, CreateTagRequest req) {
        String name = req.name().trim();
        if (tags.existsByUserIdAndNameIgnoreCase(userId, name)) {
            throw new ConflictException("DUPLICATE_TAG_NAME", "A tag with this name already exists");
        }
        TagEntity t = new TagEntity();
        t.setId(UUID.randomUUID());
        t.setUserId(userId);
        t.setName(name);
        if (req.color() != null) t.setColor(req.color());
        tags.save(t);
        return toDto(t);
    }

    @Transactional
    public TagDto update(UUID id, UUID userId, UpdateTagRequest req) {
        TagEntity t = findOwned(id, userId);
        if (req.name() != null && !req.name().isBlank()) {
            String name = req.name().trim();
            if (!name.equalsIgnoreCase(t.getName()) && tags.existsByUserIdAndNameIgnoreCase(userId, name)) {
                throw new ConflictException("DUPLICATE_TAG_NAME", "A tag with this name already exists");
            }
            t.setName(name);
        }
        if (req.color() != null) t.setColor(req.color());
        return toDto(t);
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        tags.delete(findOwned(id, userId));
    }

    private TagEntity findOwned(UUID id, UUID userId) {
        return tags.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Tag not found"));
    }

    private TagDto toDto(TagEntity t) {
        return new TagDto(t.getId(), t.getName(), t.getColor());
    }
}
