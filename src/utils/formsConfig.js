/**
 * CONFIGURATION FILE
 * Replace the placeholder URLs with your actual Google Form embed URLs.
 *
 * To get a Google Form embed URL:
 * Open Form → Click Send → Embed tab → copy the src from the iframe code.
 * It looks like: https://docs.google.com/forms/d/e/FORM_ID/viewform?embedded=true
 *
 * Each level can have different forms per day, or one form repeated.
 * If you want a single form per level for all 100 days, set defaultFormUrl.
 * For day-specific forms, populate the `days` object.
 */

export const LEVELS = [
  { id: 'beginner', label: 'Beginner', description: 'Levels 1–2 · Ages 5–7' },
  { id: 'elementary', label: 'Elementary', description: 'Levels 3–4 · Ages 7–9' },
  { id: 'intermediate', label: 'Intermediate', description: 'Levels 5–6 · Ages 9–11' },
  { id: 'advanced', label: 'Advanced', description: 'Levels 7–8 · Ages 11+' },
  { id: 'expert', label: 'Expert', description: 'Levels 9–10 · Masters' },
]

// ─── REPLACE THESE URLS WITH YOUR ACTUAL GOOGLE FORM EMBED URLS ────────────
export const FORM_CONFIG = {
  beginner: {
    defaultFormUrl: 'https://docs.google.com/forms/d/e/YOUR_BEGINNER_FORM_ID/viewform?embedded=true',
    days: {
      // Override for specific days: 1: 'https://...',
    }
  },
  elementary: {
    defaultFormUrl: 'https://docs.google.com/forms/d/e/YOUR_ELEMENTARY_FORM_ID/viewform?embedded=true',
    days: {}
  },
  intermediate: {
    defaultFormUrl: 'https://docs.google.com/forms/d/e/YOUR_INTERMEDIATE_FORM_ID/viewform?embedded=true',
    days: {}
  },
  advanced: {
    defaultFormUrl: 'https://docs.google.com/forms/d/e/YOUR_ADVANCED_FORM_ID/viewform?embedded=true',
    days: {}
  },
  expert: {
    defaultFormUrl: 'https://docs.google.com/forms/d/e/YOUR_EXPERT_FORM_ID/viewform?embedded=true',
    days: {}
  },
}

/**
 * Get the Google Form URL for a specific level and day.
 */
export function getFormUrl(level, dayNumber) {
  const config = FORM_CONFIG[level]
  if (!config) return null
  return config.days[dayNumber] || config.defaultFormUrl
}

// ─── REGISTRATION FORM ───────────────────────────────────────────────────────
// URL of the Google Form used for registration (used as fallback/redirect)
export const REGISTRATION_FORM_URL = 'https://docs.google.com/forms/d/e/YOUR_REGISTRATION_FORM_ID/viewform'

// Spreadsheet published as CSV (File → Share → Publish to web → CSV)
// Used to verify registrations. Format expected: Name, Mobile, Level, Timestamp columns
export const REGISTRATION_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/YOUR_SHEET_ID/pub?output=csv'