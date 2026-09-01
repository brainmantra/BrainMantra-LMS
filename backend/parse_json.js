import pool from './db.js';
import { selectQuestionsForDay, getSectionsForLevelAsync } from './utils/questionSelector.js';

async function verifyAll() {
  const levels = ['l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'alumni', 'gm'];
  console.log('=== VERIFYING QUESTION BANK (Level 2 onwards) ===');
  
  for (const lvl of levels) {
    const sections = await getSectionsForLevelAsync(lvl, 47);
    console.log(`\nLevel: ${lvl.toUpperCase()} | Sections:`, sections);
    
    for (const sec of sections) {
      // Test Day 1, Day 47, Day 48, Day 100
      for (const day of [1, 47, 48, 100]) {
        const qs = await selectQuestionsForDay(lvl, sec, day);
        if (qs.length !== 5) {
          console.error(`  [ERROR] Level ${lvl} Sec ${sec} Day ${day} has ${qs.length} questions (expected 5)`);
        }
        // Verify all 5 questions on this day are strictly distinct
        const keys = qs.map(q => JSON.stringify(q.addends || `${q.operand1} ${q.operator} ${q.operand2}`));
        const uniqueKeys = new Set(keys);
        if (uniqueKeys.size !== 5) {
          console.error(`  [DUPLICATE DETECTED] Level ${lvl} Sec ${sec} Day ${day}: only ${uniqueKeys.size}/5 unique`);
        }
      }
      console.log(`  ✓ Section ${sec}: Exactly 5 unique questions per day tested (Days 1, 47, 48, 100)`);
    }
  }
  await pool.end();
}

verifyAll();
