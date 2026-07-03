import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LEVELS } from '../utils/formsConfig'
import api from '../utils/api'
import toast from 'react-hot-toast'
import './LeaderboardPage.css'

export default function LeaderboardPage() {
  const navigate = useNavigate()
  const { student } = useAuth()
  const [levelFilter, setLevelFilter] = useState(student?.level || 'all')
  const [leaders, setLeaders] = useState([])
  const [weekLabel, setWeekLabel] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const res = await api.get('/leaderboard/weekly', {
          params: { level: levelFilter === 'all' ? undefined : levelFilter }
        })
        if (!mounted) return
        setLeaders(res.data.leaders || [])
        setWeekLabel(res.data.weekLabel || '')
      } catch (err) {
        toast.error('Could not load the leaderboard.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [levelFilter])

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="page-wrapper">
      <header className="lb-header">
        <div className="container lb-header-inner">
          <button className="btn btn-ghost lb-back" onClick={() => navigate(student ? '/challenge' : '/')}>
            ← {student ? 'Back to Challenge' : 'Home'}
          </button>
          <h1 className="lb-title">Weekly Leaderboard</h1>
          <p className="lb-subtitle">{weekLabel || 'This week'} · Ranked by accuracy, then speed</p>
        </div>
      </header>

      <div className="container lb-body">
        <div className="lb-filters">
          <button
            className={`lb-filter-chip ${levelFilter === 'all' ? 'active' : ''}`}
            onClick={() => setLevelFilter('all')}
          >All Levels</button>
          {LEVELS.map(l => (
            <button
              key={l.id}
              className={`lb-filter-chip ${levelFilter === l.id ? 'active' : ''}`}
              onClick={() => setLevelFilter(l.id)}
            >{l.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : leaders.length === 0 ? (
          <div className="lb-empty">
            <p>No completed challenges yet this week. Be the first on the board!</p>
          </div>
        ) : (
          <div className="lb-podium-wrap">
            {/* Top 3 podium */}
            <div className="lb-podium animate-fade">
              {top3.map((leader, i) => (
                <div key={leader.id} className={`lb-podium-slot lb-podium-slot--${i + 1}`}>
                  <div className="lb-medal">{medals[i]}</div>
                  <div className="lb-podium-avatar">{leader.name.charAt(0).toUpperCase()}</div>
                  <span className="lb-podium-name">{leader.name}</span>
                  <span className="lb-podium-stats">{leader.accuracy}% · {leader.avgTime}s avg</span>
                </div>
              ))}
            </div>

            {/* Full list */}
            {leaders.length > 3 && (
              <div className="lb-list animate-fade" style={{ animationDelay: '0.1s' }}>
                {rest.map((leader, index) => (
                  <div key={leader.id} className="lb-row">
                    <span className="lb-row-rank">{index + 4}</span>
                    <span className="lb-row-name">{leader.name}</span>
                    <span className="lb-row-stat">{leader.accuracy}% accuracy</span>
                    <span className="lb-row-stat">{leader.avgTime}s avg</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
