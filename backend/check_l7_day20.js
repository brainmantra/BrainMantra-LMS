import 'dotenv/config';
import pool from './db.js';
import { getSectionsForLevelAsync } from './utils/questionSelector.js';

async function checkL7Day20() {
  try {
    const sections = await getSectionsForLevelAsync('l7', 20);
    console.log("Sections for l7 day 20:", sections);
    const sectionsDay1 = await getSectionsForLevelAsync('l7', 1);
    console.log("Sections for l7 day 1:", sectionsDay1);
  } finally {
    await pool.end();
  }
}
checkL7Day20();
