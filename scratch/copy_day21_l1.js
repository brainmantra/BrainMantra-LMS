import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('backend/.env') });

const db = await import('../backend/db.js');
const pool = db.default;

async function run() {
  try {
    const day = 21;
    const sections = ['bead_fun', 'activity'];
    
    for (const section of sections) {
      // Get from beginner
      const { rows } = await pool.query(
        `SELECT question, answer FROM teacher_questions WHERE level = 'beginner' AND day_number = $1 AND section = $2`,
        [day, section]
      );
      
      if (rows.length > 0) {
        const questionData = rows[0].question;
        const answerData = rows[0].answer;
        
        // Insert into l1
        await pool.query(
          `INSERT INTO teacher_questions (level, day_number, section, question, answer)
           VALUES ('l1', $1, $2, $3, $4)
           ON CONFLICT (level, day_number, section) 
           DO UPDATE SET question = $3, answer = $4`,
          [
            day, 
            section, 
            typeof questionData === 'string' ? questionData : JSON.stringify(questionData),
            typeof answerData === 'string' ? answerData : JSON.stringify(answerData)
          ]
        );
        console.log(`Replicated ${section} for day ${day} to level l1`);
      } else {
        console.log(`No ${section} found for day ${day} in beginner level`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
