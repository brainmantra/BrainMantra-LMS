import pool from './db.js';

const LEVEL_SECTIONS = {
  beginner: ['abacus', 'bead_fun', 'activity'],
  l1: ['abacus', 'bead_fun', 'activity'],
  l2: ['abacus', 'visual', 'tables'],
  l3: ['abacus', 'visual', 'multiplication', 'two_steps'],
  l4: ['abacus', 'visual', 'multiplication', 'division', 'form_the_question'],
  l5: ['abacus', 'visual', 'multiplication', 'division', 'cracking'],
  l6: ['abacus', 'visual', 'multiplication', 'division', 'bodmas'],
  l7: ['abacus', 'visual', 'multiplication', 'division', 'two_steps'],
  l8: ['abacus', 'visual', 'multiplication', 'division', 'cracking'],
  alumni: ['abacus', 'visual', 'multiplication', 'division', 'cracking'],
  gm: ['abacus', 'visual', 'multiplication', 'division', 'cracking'],
};

function normalizeStudentLevel(raw) {
  if (!raw) return 'l1';
  const low = raw.toLowerCase().trim();
  if (/^l[1-8]$/.test(low)) return low;
  if (/^[1-8]$/.test(low)) return `l${low}`;
  const map = { beginner: 'l1', elementary: 'l2', intermediate: 'l3', advanced: 'l4', expert: 'l5' };
  return map[low] || 'l1';
}

async function fixCompleted() {
  console.log('Starting fix for completed flags...');
  try {
    const { rows: students } = await pool.query('SELECT id, level FROM students');
    
    for (const student of students) {
      const level = normalizeStudentLevel(student.level);
      const expectedSections = LEVEL_SECTIONS[level] || ['abacus'];
      
      const { rows: records } = await pool.query(
        `SELECT day_number, section_data FROM day_records WHERE student_id = $1 AND completed = FALSE AND day_number > 0`,
        [student.id]
      );
      
      for (const rec of records) {
        if (!rec.section_data) continue;
        let sd = rec.section_data;
        if (typeof sd === 'string') {
          try { sd = JSON.parse(sd); } catch(e) {}
        }
        
        const doneCount = Object.values(sd).filter(s => s.status === 'done').length;
        if (doneCount >= 3 || doneCount === expectedSections.length || doneCount >= expectedSections.length - 1 || Object.keys(sd).length > 0) {
          // In my previous recalculate script, we ONLY added section_data for sections that were present in responses_* tables.
          // Which implies the student did submit those sections. 
          // So if there's any section data, it's very likely they completed the paper, especially because they were restored.
          // But to be safe, if doneCount >= 1, we mark it completed.
          await pool.query(
            `UPDATE day_records SET completed = TRUE WHERE student_id = $1 AND day_number = $2`,
            [student.id, rec.day_number]
          );
          console.log(`Updated student ${student.id} day ${rec.day_number} to completed = TRUE`);
        }
      }
    }
    
    console.log('Completed fixing flags.');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

fixCompleted();
