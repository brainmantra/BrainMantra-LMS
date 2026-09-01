import pg from 'pg';
const { Pool } = pg;


const SUPABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.adfgdwarqgxyxrlrixdo:Ny4YC%2B8%24xA%23dm3.@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString: SUPABASE_URL,ssl: { rejectUnauthorized: false } });

const LEVEL_SECTIONS = {
  beginner: ['abacus', 'bead_fun', 'activity'],
  l1: ['abacus', 'bead_fun', 'activity'],
  l2: ['abacus', 'visual', 'tables'],
  l3: ['abacus', 'visual', 'multiplication', 'two_steps'],
  l4: ['abacus', 'visual', 'multiplication', 'division'],
  l5: ['abacus', 'visual', 'multiplication', 'division'],
  l6: ['abacus', 'visual', 'multiplication', 'division'],
  l7: ['abacus', 'visual', 'multiplication', 'division', 'two_steps'],
  l8: ['abacus', 'visual', 'multiplication', 'division'],
  alumni: ['abacus'],
  gm: ['abacus'],
};

const MST_LABELS = {
  abacus: 'Abacus',
  bead_fun: 'Bead Fun',
  activity: 'Activity',
  visual: 'Visual',
  multiplication: 'Multiplication',
  division: 'Division',
  tables: 'Tables',
  two_steps: '2 Steps',
  power_exercise: 'Power Exercise',
};

async function markAllDaysForAllStudents() {
  console.log('Starting update for all students...');
  const { rows: students } = await pool.query('SELECT id, name, level FROM students ORDER BY id ASC');
  console.log('Total students found:', students.length);

  for (const st of students) {
    const rawLvl = (st.level || 'l1').toLowerCase().trim();
    const lvl = rawLvl.startsWith('level') ? 'l' + rawLvl.replace(/[^0-9]/g, '') : rawLvl;
    const sections = LEVEL_SECTIONS[lvl] || ['abacus', 'visual', 'multiplication', 'division'];
    
    let studentTotalXp = 0;

    for (let d = 1; d <= 46; d++) {
      const sectionData = {};
      let dayMarks = 0;
      let dayBaseXp = 0;
      
      const daySections = [...sections];
      if (lvl !== 'l1' && lvl !== 'beginner' && d % 5 === 0 && !daySections.includes('power_exercise')) {
        daySections.push('power_exercise');
      }

      for (const sec of daySections) {
        const qCount = 5;
        const marks = qCount * 10;
        const xp = qCount * 10;
        dayMarks += marks;
        dayBaseXp += xp;
        sectionData[sec] = {
          status: 'done',
          label: MST_LABELS[sec] || sec,
          questionCount: qCount,
          correct: qCount,
          marks: marks,
          xpEarned: xp,
          accuracy: 100,
          timeTaken: 120
        };
      }

      const streakBonus = d * 5;
      const totalDayXp = dayBaseXp + streakBonus;
      studentTotalXp += totalDayXp;

      const completedDate = new Date(Date.UTC(2026, 6, 17 + (d - 1), 12, 0, 0));

      await pool.query(
        `INSERT INTO day_records 
          (student_id, day_number, completed, opened, total_marks, accuracy, time_taken_seconds, xp_earned, section_data, answers, opened_at, completed_at, updated_at)
         VALUES ($1, $2, TRUE, TRUE, $3, 100, $4, $5, $6, '[]', $7, $7, $7)
         ON CONFLICT (student_id, day_number)
         DO UPDATE SET
           completed = TRUE,
           opened = TRUE,
           total_marks = EXCLUDED.total_marks,
           accuracy = 100,
           time_taken_seconds = EXCLUDED.time_taken_seconds,
           xp_earned = EXCLUDED.xp_earned,
           section_data = EXCLUDED.section_data,
           completed_at = EXCLUDED.completed_at,
           updated_at = NOW()`,
        [st.id, d, dayMarks, daySections.length * 120, totalDayXp, JSON.stringify(sectionData), completedDate]
      );
    }

    await pool.query(
      `UPDATE students 
       SET streak = 46, 
           longest_streak = 46, 
           xp_total = $1, 
           registration_date = '2026-07-17T00:00:00.000Z', 
           first_login_date = '2026-07-17T00:00:00.000Z', 
           last_streak_check = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [studentTotalXp, st.id]
    );
    console.log(`[Updated] ${st.name} (ID: ${st.id}, Level: ${lvl}) -> Streak: 46, Total XP: ${studentTotalXp}`);
  }

  console.log('🐋 SUCCESS! All students are set to Day 46 COMPLETE with 46 Streaks and Max XP!');
  await pool.end();
}

markAllDaysForAllStudents();
