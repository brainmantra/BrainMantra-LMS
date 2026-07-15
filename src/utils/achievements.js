export function calculateAchievements(days = [], streak = 0, longestStreak = 0) {
  let totalCorrect = 0
  let perfectDays = 0
  let highAccuracyDays = 0
  let demoCompleted = false
  let day1Completed = false
  
  days.forEach(d => {
    const dayN = parseInt(d.day_number, 10)
    if (d.completed) {
      if (dayN === 0) demoCompleted = true
      if (dayN === 1) day1Completed = true
      if (parseFloat(d.accuracy || 0) === 100) perfectDays++
      if (parseFloat(d.accuracy || 0) >= 90) highAccuracyDays++
    }
    
    if (d.section_data) {
      try {
        const parsed = typeof d.section_data === 'string' ? JSON.parse(d.section_data) : d.section_data
        if (parsed && typeof parsed === 'object') {
          Object.values(parsed).forEach(sec => {
            if (sec && typeof sec === 'object') {
              totalCorrect += parseInt(sec.correct || 0, 10)
            }
          })
        }
      } catch (e) {}
    }
  })
  
  const completedCount = days.filter(d => d.completed && parseInt(d.day_number, 10) > 0).length
  
  const badgeDefinitions = [
    {
      id: 'demo_explorer',
      title: 'Demo Explorer',
      icon: '🎮',
      desc: 'Complete Demo Day practice session',
      target: 1,
      current: demoCompleted ? 1 : 0,
      unit: '',
      earned: demoCompleted
    },
    {
      id: 'first_step',
      title: 'First Step',
      icon: '🌱',
      desc: 'Complete Day 1 challenge paper',
      target: 1,
      current: day1Completed ? 1 : 0,
      unit: '',
      earned: day1Completed
    },
    {
      id: 'streak_5',
      title: '5-Day Streak',
      icon: '🔥',
      desc: 'Maintain a 5-day streak of consecutive completion',
      target: 5,
      current: Math.max(streak, longestStreak),
      unit: 'days',
      earned: streak >= 5 || longestStreak >= 5
    },
    {
      id: 'streak_15',
      title: '15-Day Streak',
      icon: '⚡',
      desc: 'Maintain a 15-day streak of consecutive completion',
      target: 15,
      current: Math.max(streak, longestStreak),
      unit: 'days',
      earned: streak >= 15 || longestStreak >= 15
    },
    {
      id: 'streak_30',
      title: '30-Day Streak',
      icon: '☄️',
      desc: 'Maintain a 30-day streak of consecutive completion',
      target: 30,
      current: Math.max(streak, longestStreak),
      unit: 'days',
      earned: streak >= 30 || longestStreak >= 30
    },
    {
      id: 'streak_50',
      title: '50-Day Milestone',
      icon: '👑',
      desc: 'Complete 50 days in a row (50-day streak)',
      target: 50,
      current: Math.max(streak, longestStreak),
      unit: 'days',
      earned: streak >= 50 || longestStreak >= 50
    },
    {
      id: 'correct_50',
      title: 'Apprentice (50 Correct)',
      icon: '🎯',
      desc: 'Get 50 correct answers in total',
      target: 50,
      current: totalCorrect,
      unit: 'answers',
      earned: totalCorrect >= 50
    },
    {
      id: 'correct_100',
      title: 'Specialist (100 Correct)',
      icon: '🎖️',
      desc: 'Get 100 correct answers in total',
      target: 100,
      current: totalCorrect,
      unit: 'answers',
      earned: totalCorrect >= 100
    },
    {
      id: 'correct_200',
      title: 'Artisan (200 Correct)',
      icon: '🔮',
      desc: 'Get 200 correct answers in total',
      target: 200,
      current: totalCorrect,
      unit: 'answers',
      earned: totalCorrect >= 200
    },
    {
      id: 'correct_400',
      title: 'Grand Master (400 Correct)',
      icon: '🏆',
      desc: 'Get 400 correct answers in total',
      target: 400,
      current: totalCorrect,
      unit: 'answers',
      earned: totalCorrect >= 400
    },
    {
      id: 'perfect_day',
      title: 'Perfect Day',
      icon: '💎',
      desc: 'Complete any day with 100% accuracy',
      target: 1,
      current: perfectDays,
      unit: 'perfect days',
      earned: perfectDays >= 1
    },
    {
      id: 'sharpshooter',
      title: 'Sharpshooter',
      icon: '🏹',
      desc: 'Complete 5 days with >= 90% accuracy',
      target: 5,
      current: highAccuracyDays,
      unit: 'high acc days',
      earned: highAccuracyDays >= 5
    },
    {
      id: 'halfway_hero',
      title: 'Halfway Hero',
      icon: '🏔️',
      desc: 'Complete 50 days of the challenge',
      target: 50,
      current: completedCount,
      unit: 'days complete',
      earned: completedCount >= 50
    },
    {
      id: 'centurion',
      title: 'Centurion',
      icon: '🌌',
      desc: 'Complete all 100 days of the challenge',
      target: 100,
      current: completedCount,
      unit: 'days complete',
      earned: completedCount >= 100
    }
  ]
  
  return badgeDefinitions
}
