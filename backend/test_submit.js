import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
import fs from 'fs';

async function run() {
  try {
    const studentId = 20; // pick a student, maybe Samriddhi Saha (20) or anyone
    const dayNumber = 2;
    // mock the submit logic
    // fetch student
    const { rows: stRows } = await pool.query('SELECT level FROM students WHERE id = $1', [studentId]);
    const level = stRows[0].level;
    let normLevel = level ? level.toLowerCase().trim() : 'l1';
    
    const map = { elementary: 'l2', intermediate: 'l3', advanced: 'l4', expert: 'l5' }
    if (map[normLevel]) normLevel = map[normLevel];

    await pool.query('BEGIN');
    
    // Aggregate totals
    let totalMarks = 100, totalXp = 100, totalTime = 120, totalCorrect = 10, totalQs = 10;
    const accuracy = 100;
    
    // Simulate streak calculation
    const runningStreak = 1, longest = 1;
    const streakBonus = runningStreak * 5;
    totalXp += streakBonus;

    let tableName = `responses_l${normLevel.replace('l', '')}`;
    if (normLevel === 'alumni') tableName = 'responses_alumni';
    else if (normLevel === 'beginner') tableName = 'responses_beginner';
    else if (normLevel === 'gm') tableName = 'responses_gm';
    
    const { rows: studentResponses } = await pool.query(
      `SELECT section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, xp_earned, answered_at 
       FROM ${tableName} 
       WHERE student_id = $1 AND day_number = $2
       ORDER BY answered_at ASC`,
      [studentId, dayNumber]
    );

    // Mock section data
    const sectionData = { abacus: { status: 'done' } };

    await pool.query(
      `INSERT INTO day_records (student_id, day_number, opened, opened_at, completed, completed_at, total_marks, accuracy, time_taken_seconds, xp_earned, answers, section_data, updated_at)
       VALUES ($6, $7, TRUE, NOW(), TRUE, NOW(), $1, $2, $3, $4, $5, $8, NOW())
       ON CONFLICT (student_id, day_number)
       DO UPDATE SET 
         opened = TRUE,
         completed = TRUE, 
         completed_at = NOW(), 
         total_marks = $1, 
         accuracy = $2,
         time_taken_seconds = $3, 
         xp_earned = $4, 
         answers = $5, 
         section_data = $8, 
         updated_at = NOW()`,
      [totalMarks, accuracy, totalTime, totalXp, JSON.stringify(studentResponses), studentId, dayNumber, JSON.stringify(sectionData)]
    );

    await pool.query(
      `UPDATE students SET xp_total = xp_total + $1, streak = $2, longest_streak = GREATEST(longest_streak, $3), updated_at = NOW()
       WHERE id = $4`,
      [streakBonus, runningStreak, longest, studentId]
    );
    
    await pool.query('ROLLBACK');
    console.log('Simulated submit successfully');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}
run();
