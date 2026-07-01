import { parse } from 'csv-parse/sync'

/**
 * Fetches the published-as-CSV Google Sheet that backs the registration
 * Google Form and returns parsed rows.
 *
 * Column names are read from env vars so you don't have to hard-code them:
 *   SHEET_MOBILE_COLUMN  (default: "Mobile Number")
 *   SHEET_NAME_COLUMN    (default: "Full Name")
 *   SHEET_LEVEL_COLUMN   (default: "Level")
 */
export async function fetchRegistrationSheet() {
  const csvUrl = process.env.REGISTRATION_SHEET_CSV_URL
  if (!csvUrl) {
    throw new Error('REGISTRATION_SHEET_CSV_URL is not set in api/.env')
  }

  const res = await fetch(csvUrl, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Sheet fetch failed: HTTP ${res.status}`)

  const text = await res.text()
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true })

  const mobileCol = process.env.SHEET_MOBILE_COLUMN || 'Mobile Number'
  const nameCol   = process.env.SHEET_NAME_COLUMN   || 'Full Name'
  const levelCol  = process.env.SHEET_LEVEL_COLUMN  || 'Level'

  return records.map(row => ({
    name:   (row[nameCol]   || '').trim(),
    mobile: (row[mobileCol] || '').replace(/\D/g, '').slice(-10),
    level:  (row[levelCol]  || '').trim().toLowerCase(),
    raw:    row,
  })).filter(r => r.mobile.length === 10)
}

/**
 * Looks up a single mobile number in the sheet.
 * Returns the matching row or null.
 */
export async function findInSheet(mobile) {
  const rows = await fetchRegistrationSheet()
  return rows.find(r => r.mobile === mobile) ?? null
}

const VALID_LEVELS = ['beginner', 'elementary', 'intermediate', 'advanced', 'expert']

/**
 * Normalises a level string from the sheet to one of the 5 valid IDs.
 * Handles common variations ("Beginner Level", "Level 1-2", etc.).
 */
export function normaliseLevel(raw = '') {
  const s = raw.toLowerCase()
  if (s.includes('expert'))       return 'expert'
  if (s.includes('advanced'))     return 'advanced'
  if (s.includes('intermediate')) return 'intermediate'
  if (s.includes('elementary'))   return 'elementary'
  if (s.includes('beginner'))     return 'beginner'
  // Also accept exact IDs
  if (VALID_LEVELS.includes(s))   return s
  return null
}
