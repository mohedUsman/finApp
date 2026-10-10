package com.fintrack.recurring;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fintrack.category.CategoryEntity;
import com.fintrack.category.CategoryRepository;
import com.fintrack.common.exception.BadRequestException;
import com.fintrack.common.exception.ConflictException;
import com.fintrack.common.exception.NotFoundException;
import com.fintrack.recurring.dto.*;
import com.fintrack.transaction.TransactionEntity;
import com.fintrack.transaction.TransactionRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RecurringRuleService {

    private final RecurringRuleRepository rules;
    private final TransactionRepository transactions;
    private final CategoryRepository categories;
    private final ObjectMapper objectMapper;

    public RecurringRuleService(RecurringRuleRepository rules,
                                 TransactionRepository transactions,
                                 CategoryRepository categories,
                                 ObjectMapper objectMapper) {
        this.rules = rules;
        this.transactions = transactions;
        this.categories = categories;
        this.objectMapper = objectMapper;
    }

    public List<RecurringRuleDto> list(UUID userId) {
        return rules.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(r -> toDto(r, resolveCategoryName(r.getCategoryId())))
                .collect(Collectors.toList());
    }

    @Transactional
    public RecurringRuleDto create(UUID userId, CreateRecurringRuleRequest req) {
        validateScheduleConfig(req.scheduleType(), req.scheduleConfig());
        CategoryEntity cat = requireCategory(userId, req.categoryId(), req.type());
        if (req.endDate() != null && req.endDate().isBefore(req.startDate())) {
            throw new BadRequestException("INVALID_DATES", "endDate must be on or after startDate");
        }

        LocalDate nextRunDate = computeFirstRunDate(req.scheduleType(), req.scheduleConfig(), req.startDate());

        RecurringRuleEntity r = new RecurringRuleEntity();
        r.setId(UUID.randomUUID());
        r.setUserId(userId);
        r.setType(req.type());
        r.setCategoryId(req.categoryId());
        if (req.currencyCode() != null) r.setCurrencyCode(req.currencyCode());
        r.setDefaultExpectedAmountMinor(req.defaultExpectedAmountMinor());
        r.setNoteTemplate(req.noteTemplate());
        r.setScheduleType(req.scheduleType());
        r.setScheduleConfig(req.scheduleConfig());
        r.setStartDate(req.startDate());
        r.setEndDate(req.endDate());
        r.setNextRunDate(nextRunDate);
        r.setActive(true);
        rules.save(r);
        return toDto(r, cat.getName());
    }

    @Transactional
    public RecurringRuleDto update(UUID id, UUID userId, UpdateRecurringRuleRequest req) {
        RecurringRuleEntity r = findOwned(id, userId);

        if (req.categoryId() != null) {
            requireCategory(userId, req.categoryId(), r.getType());
            r.setCategoryId(req.categoryId());
        }
        if (req.currencyCode() != null) r.setCurrencyCode(req.currencyCode());
        if (req.defaultExpectedAmountMinor() != null) r.setDefaultExpectedAmountMinor(req.defaultExpectedAmountMinor());
        if (req.noteTemplate() != null) r.setNoteTemplate(req.noteTemplate());
        if (req.scheduleType() != null && req.scheduleConfig() != null) {
            validateScheduleConfig(req.scheduleType(), req.scheduleConfig());
            r.setScheduleType(req.scheduleType());
            r.setScheduleConfig(req.scheduleConfig());
        }
        if (req.endDate() != null) {
            if (req.endDate().isBefore(r.getStartDate())) {
                throw new BadRequestException("INVALID_DATES", "endDate must be on or after startDate");
            }
            r.setEndDate(req.endDate());
        }
        if (req.isActive() != null) r.setActive(req.isActive());

        return toDto(r, resolveCategoryName(r.getCategoryId()));
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        rules.delete(findOwned(id, userId));
    }

    @Transactional
    public GenerateResult generate(UUID userId, LocalDate throughDate) {
        ZoneId userZone = ZoneId.of("Asia/Kolkata");
        LocalDate now = LocalDate.now(userZone);
        // throughDate only ever means "backfill up to this point"; never let it
        // run past today, or a single request can generate decades of occurrences
        // (a WEEKLY rule with throughDate=9999-12-31 inserts ~400k rows).
        LocalDate today = throughDate != null && throughDate.isBefore(now) ? throughDate : now;

        List<RecurringRuleEntity> dueRules = rules.findDueRulesWithLock(userId, today);

        int generated = 0;
        int skipped = 0;
        int advanced = 0;

        for (RecurringRuleEntity rule : dueRules) {
            LocalDate ceiling = rule.getEndDate() != null ? rule.getEndDate().isBefore(today) ? rule.getEndDate() : today : today;
            LocalDate current = rule.getNextRunDate();

            while (!current.isAfter(ceiling)) {
                String occurrenceKey = current.toString();
                if (transactions.existsByRecurringRuleIdAndOccurrenceKey(rule.getId(), occurrenceKey)) {
                    skipped++;
                } else {
                    try {
                        TransactionEntity tx = new TransactionEntity();
                        tx.setId(UUID.randomUUID());
                        tx.setUserId(userId);
                        tx.setType(rule.getType());
                        tx.setCategoryId(rule.getCategoryId());
                        tx.setCurrencyCode(rule.getCurrencyCode());
                        tx.setStatus("EXPECTED");
                        tx.setExpectedAmountMinor(rule.getDefaultExpectedAmountMinor());
                        tx.setExpectedDate(current);
                        tx.setNote(rule.getNoteTemplate());
                        tx.setRecurringRuleId(rule.getId());
                        tx.setOccurrenceKey(occurrenceKey);
                        transactions.save(tx);
                        generated++;
                    } catch (DataIntegrityViolationException e) {
                        skipped++;
                    }
                }
                current = nextOccurrence(current, rule.getScheduleType(), rule.getScheduleConfig());
            }

            rule.setNextRunDate(current);
            advanced++;
        }

        return new GenerateResult(generated, skipped, advanced);
    }

    /** Upcoming occurrence dates for a not-yet-saved schedule, for preview before committing. */
    public List<LocalDate> previewOccurrences(String scheduleType, String scheduleConfig,
                                               LocalDate startDate, LocalDate endDate, int count) {
        validateScheduleConfig(scheduleType, scheduleConfig);
        List<LocalDate> occurrences = new java.util.ArrayList<>();
        LocalDate current = computeFirstRunDate(scheduleType, scheduleConfig, startDate);
        while (occurrences.size() < count && (endDate == null || !current.isAfter(endDate))) {
            occurrences.add(current);
            current = nextOccurrence(current, scheduleType, scheduleConfig);
        }
        return occurrences;
    }

    private LocalDate computeFirstRunDate(String scheduleType, String scheduleConfig, LocalDate startDate) {
        try {
            JsonNode config = objectMapper.readTree(scheduleConfig);
            return switch (scheduleType) {
                case "MONTHLY" -> {
                    int dom = config.get("dayOfMonth").asInt();
                    int maxDay = startDate.lengthOfMonth();
                    yield startDate.withDayOfMonth(Math.min(dom, maxDay));
                }
                case "WEEKLY" -> {
                    // dayOfWeek is required by validateScheduleConfig, so honour it:
                    // the first occurrence is startDate itself only when startDate
                    // already falls on that weekday.
                    int dow = config.get("dayOfWeek").asInt();
                    yield startDate.with(TemporalAdjusters.nextOrSame(DayOfWeek.of(dow)));
                }
                case "YEARLY" -> {
                    int month = config.get("month").asInt();
                    int day = config.get("day").asInt();
                    LocalDate candidate = startDate.withMonth(month);
                    int maxDay = candidate.lengthOfMonth();
                    yield candidate.withDayOfMonth(Math.min(day, maxDay));
                }
                default -> startDate;
            };
        } catch (Exception e) {
            return startDate;
        }
    }

    private LocalDate nextOccurrence(LocalDate current, String scheduleType, String scheduleConfig) {
        try {
            JsonNode config = objectMapper.readTree(scheduleConfig);
            return switch (scheduleType) {
                case "MONTHLY" -> {
                    int dom = config.get("dayOfMonth").asInt();
                    LocalDate next = current.plusMonths(1);
                    yield next.withDayOfMonth(Math.min(dom, next.lengthOfMonth()));
                }
                case "WEEKLY" -> current.plusWeeks(1);
                case "YEARLY" -> {
                    int month = config.get("month").asInt();
                    int day = config.get("day").asInt();
                    LocalDate next = current.plusYears(1).withMonth(month);
                    yield next.withDayOfMonth(Math.min(day, next.lengthOfMonth()));
                }
                default -> current.plusMonths(1);
            };
        } catch (Exception e) {
            return current.plusMonths(1);
        }
    }

    private void validateScheduleConfig(String scheduleType, String scheduleConfig) {
        try {
            JsonNode config = objectMapper.readTree(scheduleConfig);
            switch (scheduleType) {
                case "MONTHLY" -> {
                    if (!config.has("dayOfMonth")) throw new BadRequestException("INVALID_CONFIG", "MONTHLY requires dayOfMonth");
                    int dom = config.get("dayOfMonth").asInt();
                    if (dom < 1 || dom > 31) throw new BadRequestException("INVALID_CONFIG", "dayOfMonth must be 1-31");
                }
                case "WEEKLY" -> {
                    if (!config.has("dayOfWeek")) throw new BadRequestException("INVALID_CONFIG", "WEEKLY requires dayOfWeek");
                    int dow = config.get("dayOfWeek").asInt();
                    if (dow < 1 || dow > 7) throw new BadRequestException("INVALID_CONFIG", "dayOfWeek must be 1-7");
                }
                case "YEARLY" -> {
                    if (!config.has("month") || !config.has("day")) throw new BadRequestException("INVALID_CONFIG", "YEARLY requires month and day");
                    int month = config.get("month").asInt();
                    int day = config.get("day").asInt();
                    if (month < 1 || month > 12) throw new BadRequestException("INVALID_CONFIG", "month must be 1-12");
                    if (day < 1 || day > 31) throw new BadRequestException("INVALID_CONFIG", "day must be 1-31");
                }
            }
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            throw new BadRequestException("INVALID_CONFIG", "scheduleConfig must be valid JSON");
        }
    }

    private CategoryEntity requireCategory(UUID userId, UUID categoryId, String type) {
        CategoryEntity cat = categories.findByIdAndUserId(categoryId, userId)
                .orElseThrow(() -> new BadRequestException("CATEGORY_NOT_FOUND", "Category not found"));
        if (!cat.getType().equals(type)) {
            throw new BadRequestException("CATEGORY_TYPE_MISMATCH", "Category type must match rule type");
        }
        return cat;
    }

    private RecurringRuleEntity findOwned(UUID id, UUID userId) {
        return rules.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Recurring rule not found"));
    }

    private String resolveCategoryName(UUID categoryId) {
        return categories.findById(categoryId).map(CategoryEntity::getName).orElse("");
    }

    private RecurringRuleDto toDto(RecurringRuleEntity r, String categoryName) {
        return new RecurringRuleDto(r.getId(), r.getType(), r.getCategoryId(), categoryName,
                r.getCurrencyCode(), r.getDefaultExpectedAmountMinor(), r.getNoteTemplate(),
                r.getScheduleType(), r.getScheduleConfig(), r.getStartDate(), r.getEndDate(),
                r.getNextRunDate(), r.isActive());
    }
}
