/**
 * OWASP CSV / Excel Formula Injection Sanitizer (CWE-1236).
 * Prepends a single quote to prevent DDE / command execution on spreadsheet software.
 */
export function sanitizeCsvField(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // If cell value begins with formula characters, neutralize with single apostrophe
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }

  // Quote escaping for standard CSV delimiter preservation
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}
