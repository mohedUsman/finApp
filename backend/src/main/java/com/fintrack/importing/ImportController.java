package com.fintrack.importing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fintrack.common.exception.BadRequestException;
import com.fintrack.importing.dto.*;
import com.fintrack.security.DataOwner;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/import")
public class ImportController {

    private static final long MAX_FILE_BYTES = 5L * 1024 * 1024;

    private final ImportService service;
    private final ObjectMapper objectMapper;

    public ImportController(ImportService service, ObjectMapper objectMapper) {
        this.service = service;
        this.objectMapper = objectMapper;
    }

    /**
     * The mapping rides along as a JSON part rather than a body, because the
     * request also carries the file.
     */
    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportPreviewDto> preview(@DataOwner UUID userId,
                                                    @RequestPart("file") MultipartFile file,
                                                    @RequestPart("mapping") String mappingJson) {
        if (file.isEmpty()) {
            throw new BadRequestException("EMPTY_FILE", "No file was uploaded");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new BadRequestException("FILE_TOO_LARGE", "The file is larger than 5 MB");
        }

        ColumnMapping mapping;
        try {
            mapping = objectMapper.readValue(mappingJson, ColumnMapping.class);
        } catch (IOException e) {
            throw new BadRequestException("INVALID_MAPPING", "Column mapping could not be parsed");
        }

        String content;
        try {
            content = new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new BadRequestException("UNREADABLE_FILE", "The file could not be read");
        }

        return ResponseEntity.ok(service.preview(userId, content, mapping));
    }

    @PostMapping("/commit")
    public ResponseEntity<ImportResultDto> commit(@DataOwner UUID userId,
                                                  @Valid @RequestBody CommitImportRequest req) {
        return ResponseEntity.ok(service.commit(userId, req));
    }

    @GetMapping("/rules")
    public ResponseEntity<List<ImportRuleDto>> listRules(@DataOwner UUID userId) {
        return ResponseEntity.ok(service.listRules(userId));
    }

    @PutMapping("/rules")
    public ResponseEntity<ImportRuleDto> upsertRule(@DataOwner UUID userId,
                                                    @Valid @RequestBody UpsertImportRuleRequest req) {
        return ResponseEntity.ok(service.upsertRule(userId, req));
    }

    @DeleteMapping("/rules/{id}")
    public ResponseEntity<Void> deleteRule(@DataOwner UUID userId, @PathVariable UUID id) {
        service.deleteRule(userId, id);
        return ResponseEntity.noContent().build();
    }
}
