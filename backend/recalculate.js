import pool from './db.js';

function normalizeStudentLevel(raw) {
  if (!raw) return 'l1';
  const low = raw.toLowerCase().trim();
  if (low === 'beginner') return 'beginner';
  if (low === 'alumni') return 'alumni';
  if (low === 'gm' || low.includes('grandmaster')) return 'gm';
  if (/^l[1-8]$/.test(low)) return low;
  if (/^[1-8]$/.test(low)) return `l${low}`;
  const match = low.match(/\d+/);
  if (match && ['1', '2', '3', '4', '5', '6', '7', '8'].includes(match[0])) {
    return `l${match[0]}`;
  }
  const map = { elementary: 'l2', intermediate: 'l3', advanced: 'l4', expert: 'l5' };
  return map[low] || low;
}


async function recalculate() {
  console.log('Starting recalculation to restore day_records...');
  try {
    const { rows: students } = await pool.query('SELECT * FROM students');
    console.log(`Found ${students.length} students.`);

    for (const student of students) {
      const level = normalizeStudentLevel(student.level) || student.level;
      let tableName = `responses_l${level.replace('l', '')}`;
      if (level === 'alumni') tableName = 'responses_alumni';
      else if (level === 'beginner') tableName = 'responses_beginner';
      else if (level === 'gm') tableName = 'responses_gm';

      // Find all unique days for this student in responses
      let uniqueDays = [];
      try {
        const res = await pool.query(`SELECT DISTINCT day_number FROM ${tableName} WHERE student_id = $1`, [student.id]);
        uniqueDays = res.rows.map(r => r.day_number);
      } catch(e) {
        console.error(`Error querying unique days for student ${student.id}:`, e.message);
        continue;
      }

      let totalStudentXp = 0;

      for (const dayNumber of uniqueDays) {
        // We will sum up stats from responses table
        let responses = [];
        try {
            const res = await pool.query(
              `SELECT section_name, is_correct, time_taken_seconds, xp_earned, student_answer, correct_answer 
               FROM ${tableName} 
               WHERE student_id = $1 AND day_number = $2`,
              [student.id, dayNumber]
            );
            responses = res.rows;
        } catch(e) {}

        let totalMarks = 0;
        let totalXp = 0;
        let totalTime = 0;
        let totalCorrect = 0;
        let totalQs = 0;

        // Group responses by section
        const sectionData = {};

        for (const r of responses) {
          const sec = r.section_name;
          if (!sectionData[sec]) {
            sectionData[sec] = { status: 'done', correct: 0, questionCount: 0, timeTaken: 0, xpEarned: 0, marks: 0, accuracy: 0 };
          }

          if (sec === 'power_exercise') {
             try {
                const sAns = JSON.parse(r.student_answer || '[]');
                const cAns = JSON.parse(r.correct_answer || '[]');
                if (Array.isArray(sAns) && Array.isArray(cAns)) {
                   const normalize = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
                   let correctSteps = 0;
                   cAns.forEach((cStep, idx) => {
                     if (normalize(sAns[idx]) === normalize(cStep)) correctSteps++;
                   });
                   sectionData[sec].correct += correctSteps;
                   sectionData[sec].questionCount += cAns.length;
                   sectionData[sec].xpEarned += correctSteps * 10;
                   sectionData[sec].timeTaken += parseFloat(r.time_taken_seconds || 0);
                }
             } catch(e) {}
          } else {
             if (r.is_correct) sectionData[sec].correct += 1;
             sectionData[sec].questionCount += 1;
             sectionData[sec].xpEarned += parseInt(r.xp_earned || (r.is_correct ? 10 : 0), 10);
             sectionData[sec].timeTaken += parseFloat(r.time_taken_seconds || 0);
          }
        }

        // Apply aggregation back to section_data and day total
        for (const sec of Object.keys(sectionData)) {
          sectionData[sec].timeTaken = Math.round(sectionData[sec].timeTaken); // round to integer seconds
          sectionData[sec].marks = sectionData[sec].xpEarned;
          sectionData[sec].accuracy = sectionData[sec].questionCount > 0 ? Math.round((sectionData[sec].correct / sectionData[sec].questionCount) * 100) : 0;
          
          totalCorrect += sectionData[sec].correct;
          totalQs += sectionData[sec].questionCount;
          totalTime += sectionData[sec].timeTaken;
          totalXp += sectionData[sec].xpEarned;
          totalMarks += sectionData[sec].marks;
        }

        const accuracy = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;

        // Ensure row exists in day_records
        await pool.query(
          `INSERT INTO day_records (student_id, day_number, opened, opened_at, completed, completed_at, total_marks, accuracy, time_taken_seconds, xp_earned, section_data, updated_at)
           VALUES ($1, $2, TRUE, NOW(), FALSE, NULL, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (student_id, day_number)
           DO UPDATE SET total_marks = $3, accuracy = $4, time_taken_seconds = $5, xp_earned = $6, section_data = $7, updated_at = NOW()`,
          [student.id, dayNumber, totalMarks, accuracy, totalTime, totalXp, sectionData]
        );
      }

      // Update students table xp_total
      const { rows: xpRows } = await pool.query(
        'SELECT SUM(xp_earned) as total FROM day_records WHERE student_id = $1',
        [student.id]
      );
      const computedXp = parseInt(xpRows[0]?.total || 0, 10);
      
      await pool.query('UPDATE students SET xp_total = $1 WHERE id = $2', [computedXp, student.id]);
      if (computedXp > 0) {
        console.log(`Updated student ${student.id} (${student.name}) - Total XP: ${computedXp}`);
      }
    }

    console.log('Recalculation complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

recalculate();
