export const LEVELS = [
  { id: 'beginner', label: 'Beginner', description: 'Beginner Level' },
  { id: 'l1',     label: '1',     description: 'Level 1' },
  { id: 'l2',     label: '2',     description: 'Level 2' },
  { id: 'l3',     label: '3',     description: 'Level 3' },
  { id: 'l4',     label: '4',     description: 'Level 4' },
  { id: 'l5',     label: '5',     description: 'Level 5' },
  { id: 'l6',     label: '6',     description: 'Level 6' },
  { id: 'l7',     label: '7',     description: 'Level 7' },
  { id: 'l8',     label: '8',     description: 'Level 8' },
  { id: 'alumni', label: 'Alumni', description: 'Alumni Level' },
  { id: 'gm',     label: 'GM Level', description: 'GM Level' },
]

const FoundationLevel1_FORMS = [
]

const FoundationLevel2_FORMS = [
  "https://docs.google.com/forms/d/e/1FAIpQLSdjl4pPj7iHkV83nI8Cot6CFRDbY7HJQaKY951FV_JtClB89g/viewform?embedded=true",
  "https://docs.google.com/forms/d/e/1FAIpQLSc42_iA-_-CUsEOO3BlV5kCCT_u_4lrUEKg-xo8QVXJEash6Q/viewform?embedded=true",
  "https://docs.google.com/forms/d/e/1FAIpQLSdFrigqXnLAgjlDnKvW9_X1-jbS_00_l9nww8ES3oHzyfMV5Q/viewform?embedded=true",
  "https://docs.google.com/forms/d/e/1FAIpQLSekiGNg_m7RfrIyHTUY8Tbr9_syjz3AEnQoG2Ot-F4BswUUyQ/viewform?embedded=true",
  "https://docs.google.com/forms/d/e/1FAIpQLSfsTrXWCenNogKee-3HBJseXSviNckof7oSJujK4ACV-IQ_bg/viewform?embedded=true",
]

const FoundationLevel3_FORMS = [
  "https://docs.google.com/forms/d/e/1FAIpQLSfrDhixcWG-EHKUK4SlrKAM6dbhGhOGSN7b7dVLWFqCDgZuEw/viewform?embedded=true", 
  "https://docs.google.com/forms/d/e/1FAIpQLSfpTBoLDDj7gTQSQmm8Witsr-rRVRiARYVG6lHagVzuFcuNxA/viewform?embedded=true",
  "https://docs.google.com/forms/d/e/1FAIpQLSc2-ZreGKVPoB_zsvA5YujCr1LXoYXEx_3ZqU-cIYbYtTOejA/viewform?embedded=true",
  "https://docs.google.com/forms/d/e/1FAIpQLSfyicNERAz0K83t8ea_lR1lJDaLIYzBpjqgW3kpAfJhJR68xg/viewform?embedded=true",
  "https://docs.google.com/forms/d/e/1FAIpQLScsLUcVHZHCmSWtI-8LShcu_45IynilZYCqXJ7xp2pGDLgTJA/viewform?embedded=true",
]

const FoundationLevel4_FORMS = [
  "https://docs.google.com/forms/d/e/1FAIpQLSezu3W08Buj_BY3Z-hT6OT4Fz80Z76gCryeq6zOj7BMSSNY4A/viewform?embedded=true",
]

// ─────────────────────────────────────────────────────────────────────────────
//  Master lookup map
// ─────────────────────────────────────────────────────────────────────────────
const FORM_MAP = {
  1:     FoundationLevel1_FORMS,
  2:     FoundationLevel2_FORMS,
  3:     FoundationLevel3_FORMS,
  4:     FoundationLevel4_FORMS,
}

/**
 * Returns the Google Form embed URL for a given level and day number (1-based).
 * Returns null if not yet configured.
 */
export function getFormUrl(level, dayNumber) {
  const forms = FORM_MAP[level]
  if (!forms) return null
  return forms[dayNumber - 1] ?? null 
}

/**
 * Returns true if the form for a given level + day has been configured.
 */
export function isFormConfigured(level, dayNumber) {
  return getFormUrl(level, dayNumber) !== null
}

// URL of the Google Form used for initial registration (linked on the login page).
// Students fill this out once; it populates the Google Sheet used for verification.
export const REGISTRATION_FORM_URL =
  'https://forms.gle/GxKMuifjP6SHzvXi6'
