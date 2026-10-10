package com.fintrack.reporting;

import com.fintrack.reporting.dto.MonthlyReportResponse;
import com.fintrack.reporting.dto.QuarterlyReportResponse;
import com.fintrack.reporting.dto.RangeReportResponse;
import com.fintrack.security.DataOwner;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reports")
public class ReportingController {

    private final ReportingService reportingService;

    public ReportingController(ReportingService reportingService) {
        this.reportingService = reportingService;
    }

    @GetMapping("/monthly")
    public ResponseEntity<MonthlyReportResponse> monthly(
            @DataOwner UUID userId,
            @RequestParam int year,
            @RequestParam int month) {
        return ResponseEntity.ok(reportingService.monthly(userId, year, month));
    }

    @GetMapping("/quarterly")
    public ResponseEntity<QuarterlyReportResponse> quarterly(
            @DataOwner UUID userId,
            @RequestParam int year,
            @RequestParam int quarter) {
        return ResponseEntity.ok(reportingService.quarterly(userId, year, quarter));
    }

    @GetMapping("/range")
    public ResponseEntity<RangeReportResponse> range(
            @DataOwner UUID userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(reportingService.range(userId, from, to));
    }
}
