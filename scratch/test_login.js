import { fetchRegistrationSheet, normaliseLevel } from '../backend/utils/googleSheet.js'
import 'dotenv/config'

async function run() {
  try {
    const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTE24C0rWw5-P9C8r96Fw36qF-XUrt5_6YgG1_9dO5j_qY/pub?output=csv'
    process.env.REGISTRATION_SHEET_CSV_URL = csvUrl
    process.env.SHEET_MOBILE_COLUMN = 'Phone number'
    const rows = await fetchRegistrationSheet()
    const target = rows.find(r => r.mobile === '9831212834')
    console.log(target)
  } catch (err) {
    console.error(err)
  }
}
run()
