import { parse } from 'csv-parse/sync'

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

export async function findInSheet(mobile) {
  const rows = await fetchRegistrationSheet()
  return rows.find(r => r.mobile === mobile) ?? null
}

const VALID_LEVELS = [
  'beginner', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'alumni', 'gm',
  '1', '2', '3', '4', '5', '6', '7', '8', 'elementary', 'intermediate', 'advanced', 'expert'
]

export function normaliseLevel(raw = '') {
  const s = raw.toLowerCase().trim()
  
  if (s.includes('grandmaster') || s.includes('gm')) return 'gm'
  if (s.includes('alumni')) return 'alumni'
  if (s.includes('beginner')) return 'beginner'

  // Extract number if it exists (e.g. "foundation level 3" -> "3" -> "l3")
  const match = s.match(/\d+/)
  if (match) {
    const num = match[0]
    if (['1', '2', '3', '4', '5', '6', '7', '8'].includes(num)) return `l${num}`
  }

  // Fallback for legacy named levels
  if (s.includes('expert'))       return 'l5'
  if (s.includes('advanced'))     return 'l4'
  if (s.includes('intermediate')) return 'l3'
  if (s.includes('elementary'))   return 'l2'
  
  // Also accept exact IDs
  if (VALID_LEVELS.includes(s)) {
    if (/^[1-8]$/.test(s)) return `l${s}`
    return s
  }
  return null
}