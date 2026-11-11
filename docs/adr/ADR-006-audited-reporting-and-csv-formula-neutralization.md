# ADR-006: Immutable Audited Corrections & Streaming CSV Formula Neutralization

## Status
Accepted

## Date
2026-11-10

## Context
Enterprise payroll and compliance systems (such as labor department audits or SOX 404 requirements) require complete accountability when timesheet hours are altered by management. Simultaneously, business reporting requires exporting large datasets to spreadsheets (CSV format).

Two critical vulnerabilities arise in standard reporting implementations:
1. **Unaccountable Historical Mutation**: Updating `clockInAt` or `reviewStatus` directly in the attendance session destroys original historical clock records, making wage theft investigation or compliance audits impossible.
2. **CSV Formula Injection (CWE-1236)**: User-provided text (employee names, notes, worksite names, correction reasons) beginning with characters `=`, `+`, `-`, `@`, `\t`, or `\r` can execute arbitrary formulas or commands when opened by managers in Microsoft Excel or Google Sheets (e.g. `=cmd|'/C calc'!A0` or data exfiltration via `=IMPORTXML()`).

## Decision
We enforce **Immutable Audit Logging for Corrections** and **Strict CSV Formula Neutralization**:
1. **Audit Ledger (`attendance_corrections`)**:
   - Any manual edit creates an immutable row capturing: `attendance_session_id`, `adjusted_by_user_id`, `field_adjusted`, `original_value`, `corrected_value`, `reason`, and `created_at`.
   - The original session record maintains reference to all adjustments, ensuring zero loss of raw punch history.
2. **Formula Neutralization in CSV Exports**:
   - Every exported cell is sanitized before serialization. If a string starts with `=, +, -, @, \t, \r`, it is automatically prefixed with a single quote (`'`), rendering it inert plain text in spreadsheet engines.
   - RFC 4180 compliant escaping is enforced for embedded quotes, commas, and line breaks.
3. **Chunked HTTP Streaming**:
   - Large CSV reports stream line-by-line via HTTP Transfer-Encoding: Chunked, avoiding high memory buffering and timeout failures on large employee rosters.

## Consequences
### Positive
- **Tamper-Evident Compliance**: Fully compliant with enterprise labor audit standards; every adjustment records who, what, when, and why.
- **CWE-1236 Protection**: Completely immune to spreadsheet formula execution and outbound data exfiltration exploits.
- **Memory Efficiency**: Streaming architecture generates exports of arbitrary size with constant $O(1)$ memory consumption.

### Negative / Trade-offs
- Users inspecting raw CSV in a plain text editor see leading single quote prefixes on neutralized formula strings.

## Verification
- Verified by `apps/backend/verify-phase9-reports.js` testing CSV injection attack strings (`=SUM(1+1)`, `@DDE(...)`, etc.) and audit correction ledger integrity.
