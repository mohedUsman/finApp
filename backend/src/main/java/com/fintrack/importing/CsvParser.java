package com.fintrack.importing;

import java.util.ArrayList;
import java.util.List;

/**
 * Minimal RFC 4180 reader — enough for bank statement exports, which routinely
 * put commas inside quoted merchant names. Pulling in a CSV library for this
 * would be the only third-party parser in the backend.
 */
final class CsvParser {

    private CsvParser() {}

    static List<List<String>> parse(String content) {
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean inQuotes = false;

        // Normalise line endings so \r\n inside the file doesn't leak into
        // the last field of every row.
        String text = content.replace("\r\n", "\n").replace('\r', '\n');

        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    field.append(c);
                }
            } else if (c == '"') {
                inQuotes = true;
            } else if (c == ',') {
                row.add(field.toString().trim());
                field.setLength(0);
            } else if (c == '\n') {
                row.add(field.toString().trim());
                field.setLength(0);
                if (!isBlank(row)) rows.add(row);
                row = new ArrayList<>();
            } else {
                field.append(c);
            }
        }

        row.add(field.toString().trim());
        if (!isBlank(row)) rows.add(row);

        return rows;
    }

    private static boolean isBlank(List<String> row) {
        return row.stream().allMatch(s -> s == null || s.isEmpty());
    }
}
