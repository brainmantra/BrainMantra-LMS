import pool from './db.js';
import { selectQuestionsForDay, getSectionsForLevelAsync } from './utils/questionSelector.js';

async function testDay47() {
  for (const lvl of ['beginner', 'l1', 'l2', 'l3', 'l4', 'l7', 'alumni']) {
    const secs = await getSectionsForLevelAsync(lvl, 47);
    console.log(`\nLevel ${lvl} Day 47 sections:`, secs);
    for (const s of secs) {
      const qs = await selectQuestionsForDay(lvl, s, 47);
      console.log(`  - Section ${s}: ${qs.length} questions returned (sample: ${JSON.stringify(qs[0]?.addends || qs[0]?.operand1 + ' ' + (qs[0]?.operator || '') + ' ' + (qs[0]?.operand2 || ''))})`);
    }
  }
  await pool.end();
}

testDay47();
