import './StreakCorner.css'

export default function StreakCorner({ streak, longestStreak }) {
  const isActive = streak > 0
  return (
    <div className={`streak-corner ${isActive ? 'streak-active' : 'streak-broken'} animate-pop`}>
      <div className="streak-flame">
        {isActive ? '🔥' : '💤'}
      </div>
      <div className="streak-info">
        <span className="streak-num">{streak}</span>
        <span className="streak-label">day streak</span>
      </div>
      {longestStreak > streak && (
        <div className="streak-best">
          Best: {longestStreak} days
        </div>
      )}
      {!isActive && (
        <div className="streak-best streak-best--broken">
          Streak broken — start fresh today!
        </div>
      )}
    </div>
  )
}
