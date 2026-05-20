package com.fintrack.reporting;

import com.fintrack.reporting.dto.MonthlyReportResponse;
import com.fintrack.reporting.dto.QuarterlyReportResponse;
import com.fintrack.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
            @CurrentUser UUID userId,
            @RequestParam int year,
            @RequestParam int month) {
        return ResponseEntity.ok(reportingService.monthly(userId, year, month));
    }

    @GetMapping("/quarterly")
    public ResponseEntity<QuarterlyReportResponse> quarterly(
            @CurrentUser UUID userId,
            @RequestParam int year,
            @RequestParam int quarter) {
        return ResponseEntity.ok(reportingService.quarterly(userId, year, quarter));
    }
}
