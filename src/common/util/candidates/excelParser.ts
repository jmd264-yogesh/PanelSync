/**
 * Excel/CSV Parser Utility
 *
 * Utilities for parsing candidate data from Excel and CSV files.
 * Handles date parsing, header normalization, and data validation.
 */

import * as XLSX from 'xlsx';
import type { ParsedCandidate } from '@/common/types/candidate';

/**
 * Format date parts into YYYY-MM-DD string with validation
 */
function formatDateParts(
  year: number,
  month: number,
  day: number
): string | undefined {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

/**
 * Parse Excel date value into YYYY-MM-DD string
 *
 * Handles multiple formats:
 * - JavaScript Date objects
 * - Excel serial numbers
 * - ISO date strings (YYYY-MM-DD)
 * - Day-first format (DD/MM/YYYY)
 */
export function parseExcelDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateParts(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate()
    );
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? formatDateParts(parsed.y, parsed.m, parsed.d) : undefined;
  }

  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return formatDateParts(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3])
    );
  }

  // Sheets are authored day-first (DD/MM/YYYY). Match on the leading triplet only
  // (no trailing `$` anchor) so a trailing time component doesn't fall through to
  // the native Date parser below, which assumes the US MM/DD/YYYY convention.
  const dayFirstMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dayFirstMatch) {
    return formatDateParts(
      Number(dayFirstMatch[3]),
      Number(dayFirstMatch[2]),
      Number(dayFirstMatch[1])
    );
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateParts(
      parsed.getFullYear(),
      parsed.getMonth() + 1,
      parsed.getDate()
    );
  }

  return undefined;
}

/**
 * Normalize header string for comparison
 *
 * Removes BOM, parenthetical hints, extra spaces, and standardizes to lowercase
 */
export function normalizeHeader(value: string): string {
  return value
    .replace(/^﻿/, '')
    .replace(/\([^)]*\)/g, '') // strip a trailing format hint, e.g. "Drive Date (YYYY-MM-DD)"
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find a key in an object using normalized header matching
 */
function findKey(obj: any, possibleNames: string[]): string | undefined {
  const keys = Object.keys(obj);
  return keys.find((k) => possibleNames.includes(normalizeHeader(k)));
}

/**
 * Parse Excel/CSV file and extract candidate data
 *
 * @param file - The uploaded file (Excel or CSV)
 * @param defaultCollege - Fallback college name if not in file
 * @param defaultDate - Fallback drive date if not in file
 * @returns Promise resolving to array of parsed candidates
 * @throws Error if file cannot be read or parsed
 */
export async function parseExcelFile(
  file: File,
  defaultCollege?: string,
  defaultDate?: string
): Promise<ParsedCandidate[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error('Could not read file data');

        // cellDates is intentionally omitted: it lets SheetJS auto-convert date-looking
        // cells to JS Date objects using its own heuristics, which can resolve an
        // ambiguous "09-07-2026" as Sep 7 instead of the day-first Jul 9 our recruiters
        // enter. Reading raw values instead and parsing them ourselves in parseExcelDate
        // (day-first-first) keeps that interpretation consistent and under our control.
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet);
        if (json.length === 0) throw new Error('The spreadsheet is empty.');

        const parsedCandidates: ParsedCandidate[] = [];
        for (let i = 0; i < json.length; i++) {
          const row = json[i];
          const keys = Object.keys(row);
          const nameKey = findKey(row, ['name']);
          const emailKey = findKey(row, ['email']);

          if (nameKey && emailKey) {
            const name = String(row[nameKey]).trim();
            const email = String(row[emailKey]).trim();
            if (name === '' || email === '') continue;

            const dateKey = findKey(row, [
              'date',
              'preferred date',
              'interview date',
              'drive date',
              'date of drive',
            ]);
            const rawDate = dateKey ? row[dateKey] : undefined;
            const preferredDate =
              parseExcelDate(rawDate) || (defaultDate ? defaultDate : undefined);

            const driveCollegeKey = findKey(row, [
              'college name of drive',
              'drive college',
              'college of drive',
            ]);
            const rawDriveCollege =
              driveCollegeKey && row[driveCollegeKey] !== undefined
                ? String(row[driveCollegeKey]).trim()
                : undefined;
            const collegeDrive = rawDriveCollege || defaultCollege;

            const candidateCollegeKey = findKey(row, [
              'college name of candidate',
              'candidate college',
              'college',
              'institution',
              'university',
              'college name',
            ]);
            const rawCandidateCollege =
              candidateCollegeKey && row[candidateCollegeKey] !== undefined
                ? String(row[candidateCollegeKey]).trim()
                : undefined;
            const college = rawCandidateCollege || collegeDrive;

            const resumeLinkKey = findKey(row, [
              'resume link',
              'resume url',
              'resume',
              'cv link',
              'cv url',
            ]);
            const resumeLink =
              resumeLinkKey && row[resumeLinkKey] !== undefined
                ? String(row[resumeLinkKey]).trim()
                : undefined;

            if (!preferredDate) {
              throw new Error(
                `Row ${i + 2}: Candidate "${name}" is missing a Drive Date. Please specify a date in the sheet or set a default Drive Date above.`
              );
            }
            if (!college) {
              throw new Error(
                `Row ${i + 2}: Candidate "${name}" is missing a Candidate College Name. Please specify a candidate college name in the sheet or select a default College Name of Drive above.`
              );
            }

            parsedCandidates.push({
              name,
              email,
              preferredDate,
              college,
              collegeDrive,
              resumeLink,
            });
          }
        }

        if (parsedCandidates.length === 0) {
          throw new Error(
            "Could not find any candidates with valid 'Name' and 'Email' columns in the uploaded file."
          );
        }

        resolve(parsedCandidates);
      } catch (err: any) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file.'));
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * Generate a candidate upload template Excel file
 *
 * @returns Blob containing the template Excel file
 */
export function generateCandidateTemplate(): Blob {
  const headers = [
    'Name',
    'Email',
    'College Name of Candidate',
    'College Name of Drive',
    'Drive Date (YYYY-MM-DD)',
    'Resume Link',
  ];
  const rows = [
    [
      'John Doe',
      'john.doe@example.com',
      'IIT Madras',
      'IIT Bombay',
      '2026-06-15',
      'https://example.com/resumes/john-doe.pdf',
    ],
    [
      'Jane Smith',
      'jane.smith@example.com',
      'NIT Trichy',
      'NIT Trichy',
      '2026-06-16',
      '',
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Lock the Drive Date column to Text format (including blank buffer rows below
  // the examples) so Excel never auto-converts typed dates into its own native
  // date type — that auto-conversion is what silently swaps day/month on ambiguous
  // input like "09-07-2026" depending on the machine's locale.
  const DRIVE_DATE_COL = headers.indexOf('Drive Date (YYYY-MM-DD)');
  const TOTAL_ROWS = 200; // header + examples + generous blank buffer for new rows
  for (let r = 0; r < TOTAL_ROWS; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: DRIVE_DATE_COL });
    const existing = worksheet[addr];
    worksheet[addr] = { t: 's', v: existing ? existing.v : '', z: '@' };
  }
  worksheet['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: TOTAL_ROWS - 1, c: headers.length - 1 },
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
  const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

  return new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
