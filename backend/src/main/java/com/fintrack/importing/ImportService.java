package com.fintrack.importing;

import com.fintrack.category.CategoryEntity;
import com.fintrack.category.CategoryRepository;
import com.fintrack.common.exception.BadRequestException;
import com.fintrack.common.exception.NotFoundException;
import com.fintrack.importing.dto.*;
import com.fintrack.transaction.TransactionEntity;
import com.fintrack.transaction.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Bank statement CSV import. Plaid-style bank linking needs API credentials
 * and a public callback URL, neither of which this app has, so the import
 * works from the CSV statements banks let you download instead.
 *
 * <p>Nothing is written during preview: the client sends the file, gets back
 * every parsed row with a suggested category and a duplicate flag, and only
 * the rows it sends to {@link #commit} are saved.
 */
@Service
public class ImportService {

    /** Tried in order when the mapping doesn't pin a format down. */
    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d/M/yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("MM/dd/yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("dd-MM-yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d-M-yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("dd-MMM-yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("yyyy/MM/dd", Locale.ENGLISH)
    );

    private static final long MAX_AMOUNT_MINOR = 100_000_000_000_000L;
    private static final int MAX_ROWS = 5_000;

    private final ImportRuleRepository rules;
    private final CategoryRepository categories;
    private final TransactionRepository transactions;

    public ImportService(ImportRuleRepository rules, CategoryRepository categories,
                         TransactionRepository transactions) {
        this.rules = rules;
        this.categories = categories;
        this.transactions = transactions;
    }

    // ─── Rules ────────────────────────────────────────────────────────────────

    public List<ImportRuleDto> listRules(UUID userId) {
        Map<UUID, String> names = categoryNames(userId);
        return rules.findByUserId(userId).stream()
                .map(r -> new ImportRuleDto(r.getId(), r.getKeyword(), r.getCategoryId(),
                        names.getOrDefault(r.getCategoryId(), "")))
                .toList();
    }

    @Transactional
    public ImportRuleDto upsertRule(UUID userId, UpsertImportRuleRequest req) {
        CategoryEntity cat = categories.findByIdAndUserId(req.categoryId(), userId)
                .orElseThrow(() -> new BadRequestException("CATEGORY_NOT_FOUND", "Category not found"));
        String keyword = req.keyword().trim();
        if (keyword.isEmpty()) {
            throw new BadRequestException("INVALID_KEYWORD", "Keyword cannot be blank");
        }

        ImportRuleEntity rule = rules.findByUserIdAndKeywordIgnoreCase(userId, keyword)
                .orElseGet(() -> {
                    ImportRuleEntity e = new ImportRuleEntity();
                    e.setId(UUID.randomUUID());
                    e.setUserId(userId);
                    e.setKeyword(keyword);
                    return e;
                });
        rule.setCategoryId(cat.getId());
        rules.save(rule);
        return new ImportRuleDto(rule.getId(), rule.getKeyword(), cat.getId(), cat.getName());
    }

    @Transactional
    public void deleteRule(UUID userId, UUID id) {
        ImportRuleEntity rule = rules.findById(id)
                .filter(r -> r.getUserId().equals(userId))
                .orElseThrow(() -> new NotFoundException("Import rule not found"));
        rules.delete(rule);
    }

    // ─── Preview ──────────────────────────────────────────────────────────────

    /** Parses the file against the mapping without writing anything. */
    public ImportPreviewDto preview(UUID userId, String csvContent, ColumnMapping mapping) {
        validateMapping(mapping);

        List<List<String>> lines = CsvParser.parse(csvContent);
        if (lines.isEmpty()) {
            throw new BadRequestException("EMPTY_FILE", "The file has no rows");
        }

        List<String> headers = mapping.hasHeaderRow() ? lines.get(0) : List.of();
        List<List<String>> dataLines = mapping.hasHeaderRow() ? lines.subList(1, lines.size()) : lines;
        if (dataLines.size() > MAX_ROWS) {
            throw new BadRequestException("TOO_MANY_ROWS",
                    "The file has " + dataLines.size() + " rows; the limit is " + MAX_ROWS);
        }

        // Longest keyword first so "SWIGGY INSTAMART" beats a broader "SWIGGY".
        List<ImportRuleEntity> userRules = rules.findByUserId(userId).stream()
                .sorted(Comparator.comparingInt((ImportRuleEntity r) -> r.getKeyword().length()).reversed())
                .toList();
        Map<UUID, String> names = categoryNames(userId);

        List<PreviewRowDto> rows = new ArrayList<>();
        int importable = 0, duplicates = 0, errors = 0;

        for (int i = 0; i < dataLines.size(); i++) {
            int lineNumber = i + (mapping.hasHeaderRow() ? 2 : 1);
            PreviewRowDto row = parseRow(userId, lineNumber, dataLines.get(i), mapping, userRules, names);
            rows.add(row);
            if (row.error() != null) errors++;
            else if (row.duplicate()) duplicates++;
            else importable++;
        }

        return new ImportPreviewDto(headers, rows, dataLines.size(), importable, duplicates, errors);
    }

    private PreviewRowDto parseRow(UUID userId, int lineNumber, List<String> cells, ColumnMapping mapping,
                                   List<ImportRuleEntity> userRules, Map<UUID, String> names) {
        LocalDate date;
        try {
            date = parseDate(cell(cells, mapping.dateColumn()), mapping.dateFormat());
        } catch (BadRequestException e) {
            return errorRow(lineNumber, e.getMessage());
        }

        String description = cell(cells, mapping.descriptionColumn());

        SignedAmount signed;
        try {
            signed = resolveAmount(cells, mapping);
        } catch (BadRequestException e) {
            return errorRow(lineNumber, e.getMessage());
        }
        if (signed == null) {
            return errorRow(lineNumber, "No amount on this row");
        }
        if (signed.minor() > MAX_AMOUNT_MINOR) {
            return errorRow(lineNumber, "Amount exceeds the maximum supported value");
        }

        String type = signed.income() ? "INCOME" : "EXPENSE";

        UUID categoryId = null;
        String matchedKeyword = null;
        String upperDesc = description.toUpperCase(Locale.ENGLISH);
        for (ImportRuleEntity r : userRules) {
            if (upperDesc.contains(r.getKeyword().toUpperCase(Locale.ENGLISH))) {
                // A rule pointing at the wrong-typed category would be rejected
                // on commit, so don't suggest it here either.
                CategoryEntity cat = categories.findById(r.getCategoryId()).orElse(null);
                if (cat != null && cat.getType().equals(type) && cat.isActive()) {
                    categoryId = r.getCategoryId();
                    matchedKeyword = r.getKeyword();
                    break;
                }
            }
        }

        boolean duplicate = transactions.existsImported(userId, type, signed.minor(), date, description);

        return new PreviewRowDto(lineNumber, date, description, signed.minor(), type,
                categoryId, categoryId == null ? null : names.getOrDefault(categoryId, ""),
                matchedKeyword, duplicate, null);
    }

    private static PreviewRowDto errorRow(int lineNumber, String message) {
        return new PreviewRowDto(lineNumber, null, null, null, null, null, null, null, false, message);
    }

    // ─── Commit ───────────────────────────────────────────────────────────────

    @Transactional
    public ImportResultDto commit(UUID userId, CommitImportRequest req) {
        int imported = 0, rulesSaved = 0;
        List<String> errors = new ArrayList<>();

        for (CommitRow row : req.rows()) {
            CategoryEntity cat = categories.findByIdAndUserId(row.categoryId(), userId).orElse(null);
            if (cat == null) {
                errors.add(row.date() + " " + row.note() + ": category not found");
                continue;
            }
            if (!cat.getType().equals(row.type())) {
                errors.add(row.date() + " " + row.note() + ": category type must match transaction type");
                continue;
            }
            if (!cat.isActive()) {
                errors.add(row.date() + " " + row.note() + ": category is inactive");
                continue;
            }

            TransactionEntity t = new TransactionEntity();
            t.setId(UUID.randomUUID());
            t.setUserId(userId);
            t.setType(row.type());
            t.setCategoryId(cat.getId());
            t.setCurrencyCode("INR");
            // A bank statement records money that already moved, so imported
            // rows are ACTUAL rather than planned.
            t.setStatus("ACTUAL");
            t.setActualAmountMinor(row.amountMinor());
            t.setActualDate(row.date());
            t.setNote(row.note());
            t.setConfirmedAt(Instant.now());
            transactions.save(t);
            imported++;

            if (row.saveRule() && row.ruleKeyword() != null && !row.ruleKeyword().isBlank()) {
                upsertRule(userId, new UpsertImportRuleRequest(row.ruleKeyword().trim(), cat.getId()));
                rulesSaved++;
            }
        }

        return new ImportResultDto(imported, rulesSaved, errors);
    }

    // ─── Parsing helpers ──────────────────────────────────────────────────────

    private void validateMapping(ColumnMapping mapping) {
        boolean hasSingle = mapping.amountColumn() != null;
        boolean hasSplit = mapping.debitColumn() != null || mapping.creditColumn() != null;
        if (!hasSingle && !hasSplit) {
            throw new BadRequestException("INVALID_MAPPING",
                    "Map either an amount column or a debit/credit column pair");
        }
        if (mapping.typeColumn() != null && !hasSingle) {
            throw new BadRequestException("INVALID_MAPPING",
                    "A type column only makes sense alongside a single amount column");
        }
    }

    private record SignedAmount(long minor, boolean income) {}

    private SignedAmount resolveAmount(List<String> cells, ColumnMapping mapping) {
        if (mapping.debitColumn() != null || mapping.creditColumn() != null) {
            Long debit = mapping.debitColumn() == null ? null : parseAmountOrNull(cell(cells, mapping.debitColumn()));
            Long credit = mapping.creditColumn() == null ? null : parseAmountOrNull(cell(cells, mapping.creditColumn()));
            // Statements leave the unused side blank, so exactly one is populated.
            if (debit != null && debit != 0) return new SignedAmount(Math.abs(debit), false);
            if (credit != null && credit != 0) return new SignedAmount(Math.abs(credit), true);
            return null;
        }

        Long amount = parseAmountOrNull(cell(cells, mapping.amountColumn()));
        if (amount == null || amount == 0) return null;

        if (mapping.typeColumn() != null) {
            String marker = cell(cells, mapping.typeColumn()).toUpperCase(Locale.ENGLISH);
            boolean income = marker.startsWith("C") || marker.contains("CREDIT") || marker.contains("DEPOSIT");
            return new SignedAmount(Math.abs(amount), income);
        }
        // Otherwise the sign carries the direction: negative is money out.
        return new SignedAmount(Math.abs(amount), amount > 0);
    }

    /** Null for a blank cell; throws only when a non-empty cell isn't a number. */
    private Long parseAmountOrNull(String raw) {
        if (raw == null) return null;
        // Strip currency symbols, thousands separators and the trailing
        // Dr/Cr suffix some banks append to the figure itself.
        String cleaned = raw.replaceAll("(?i)\\s*(dr|cr)\\.?$", "")
                .replaceAll("[^0-9.,()\\-+]", "")
                .replace(",", "")
                .trim();
        boolean parenthesised = cleaned.startsWith("(") && cleaned.endsWith(")");
        if (parenthesised) cleaned = "-" + cleaned.substring(1, cleaned.length() - 1);
        if (cleaned.isEmpty() || cleaned.equals("-") || cleaned.equals("+")) return null;

        try {
            return new BigDecimal(cleaned)
                    .movePointRight(2)
                    .setScale(0, RoundingMode.HALF_UP)
                    .longValueExact();
        } catch (ArithmeticException | NumberFormatException e) {
            throw new BadRequestException("INVALID_AMOUNT", "Could not read the amount \"" + raw + "\"");
        }
    }

    private LocalDate parseDate(String raw, String explicitFormat) {
        if (raw == null || raw.isEmpty()) {
            throw new BadRequestException("INVALID_DATE", "Missing date");
        }
        if (explicitFormat != null && !explicitFormat.isBlank()) {
            try {
                return LocalDate.parse(raw, DateTimeFormatter.ofPattern(explicitFormat, Locale.ENGLISH));
            } catch (DateTimeParseException | IllegalArgumentException e) {
                throw new BadRequestException("INVALID_DATE",
                        "Could not read the date \"" + raw + "\" as " + explicitFormat);
            }
        }
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try {
                return LocalDate.parse(raw, fmt);
            } catch (DateTimeParseException ignored) {
                // try the next shape
            }
        }
        throw new BadRequestException("INVALID_DATE", "Could not read the date \"" + raw + "\"");
    }

    private static String cell(List<String> cells, Integer index) {
        if (index == null || index < 0 || index >= cells.size()) return "";
        return cells.get(index);
    }

    private Map<UUID, String> categoryNames(UUID userId) {
        return categories.findByUserId(userId).stream()
                .collect(Collectors.toMap(CategoryEntity::getId, CategoryEntity::getName));
    }
}
