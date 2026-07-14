import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import StudentLayout from '../components/StudentLayout'
import { getChallengeDay } from '../utils/dateUtils'
import { LEVELS } from '../utils/formsConfig'
import api from '../utils/api'
import DayCard from '../components/DayCard'
import StreakCorner from '../components/StreakCorner'
import toast from 'react-hot-toast'
import { calculateAchievements } from '../utils/achievements'
import './ChallengePage.css'

export default function ChallengePage() {
  const { student } = useAuth()
  const [days, setDays] = useState([])
  const [streak, setStreak] = useState(0)
  const [longestStreak, setLongestStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedBadge, setSelectedBadge] = useState(null)

  // Gamification tab states
  const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard' | 'league' | 'shop'
  const [quests, setQuests] = useState([])
  const [spentXp, setSpentXp] = useState(0)
  const [unlockedItems, setUnlockedItems] = useState([])
  const [equippedFrame, setEquippedFrame] = useState(null)
  const [equippedTheme, setEquippedTheme] = useState(null)
  const [leagueData, setLeagueData] = useState({ tier: 'Bronze', standings: [] })
  const [questsLoading, setQuestsLoading] = useState(true)
  const [leagueLoading, setLeagueLoading] = useState(true)

  const achievements = useMemo(() => calculateAchievements(days, streak, longestStreak), [days, streak, longestStreak])

  const LEVEL_LABELS = {
    beginner: 'Beginner',
    l1: 'Level 1', l2: 'Level 2', l3: 'Level 3', l4: 'Level 4',
    l5: 'Level 5', l6: 'Level 6', l7: 'Level 7', l8: 'Level 8',
    alumni: 'Alumni', gm: 'Grand Master (GM)'
  }

  const currentDay = useMemo(() => getChallengeDay(student?.first_login_date || student?.registration_date), [student])
  const clampedCurrentDay = Math.min(currentDay, 100)
  const maxRenderDay = Math.min(currentDay, 100)

  const stats = useMemo(() => {
    const completedDaysList = days.filter(d => d.completed)
    const totalAccuracy = completedDaysList.reduce((acc, d) => acc + parseFloat(d.accuracy || 0), 0)
    const avgAccuracy = completedDaysList.length > 0 ? Math.round(totalAccuracy / completedDaysList.length) : 0
    
    const totalTime = completedDaysList.reduce((acc, d) => acc + (d.time_taken_seconds || 0), 0)
    const avgTime = completedDaysList.length > 0 ? Math.round(totalTime / completedDaysList.length) : 0

    return {
      completedCount: completedDaysList.length,
      avgAccuracy,
      totalTime,
      avgTime,
    }
  }, [days])



  const loadQuestsAndShop = async () => {
    try {
      const res = await api.get(`/students/${student.id}/quests`)
      setQuests(res.data.quests || [])
      setSpentXp(res.data.spent_xp || 0)
      setUnlockedItems(JSON.parse(res.data.unlocked_items || '[]'))
      setEquippedFrame(res.data.equipped_frame || null)
      setEquippedTheme(res.data.equipped_theme || null)
    } catch (e) {
      console.error(e)
    } finally {
      setQuestsLoading(false)
    }
  }

  const loadLeague = async () => {
    setLeagueLoading(true)
    try {
      const res = await api.get(`/students/${student.id}/league`)
      setLeagueData(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLeagueLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const res = await api.get(`/students/${student.id}/progress`)
        if (!mounted) return
        setDays(res.data.days || [])
        setStreak(res.data.streak ?? 0)
        setLongestStreak(res.data.longestStreak ?? 0)
      } catch (err) {
        toast.error('Could not load your progress. Showing offline view.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    if (student?.id) {
      load()
      loadQuestsAndShop()
    }
    return () => { mounted = false }
  }, [student])

  useEffect(() => {
    if (activeTab === 'league' && student?.id) {
      loadLeague()
    }
  }, [activeTab, student])

  const dayMap = useMemo(() => {
    const m = {}
    days.forEach(d => { m[d.day_number] = d })
    return m
  }, [days])

  const completedCount = days.filter(d => d.completed).length

  if (currentDay > 100) {
    return (
      <div className="page-wrapper">
        <div className="container" style={{ paddingTop: 80, textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: 12 }}>🎉 Challenge Complete!</h1>
          <p style={{ color: 'var(--slate)' }}>You've finished all 100 days. Incredible work, {student.name.split(' ')[0]}!</p>
        </div>
      </div>
    )
  }

  return (
    <StudentLayout>

      <div className="container challenge-body" style={{ padding: 0, maxWidth: '100%' }}>
        <section className="dash-hero animate-fade" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 className="challenge-title" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Hey {student.name.split(' ')[0]} 👋
            </h1>
            <p className="challenge-subtitle" style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge badge-primary badge-3d">{LEVEL_LABELS[student?.level] || student?.level}</span>
              <span style={{ color: 'var(--text-secondary)' }}>You're on Day <strong>{clampedCurrentDay}</strong> of 100.</span>
            </p>
          </div>
          <div className="challenge-progress-ring" style={{ position: 'relative' }}>
            <svg width="74" height="74" viewBox="0 0 74 74" style={{ filter: 'drop-shadow(0 4px 12px rgba(255,122,0,0.25))' }}>
              <circle cx="37" cy="37" r="32" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
              <circle
                cx="37" cy="37" r="32" fill="none" stroke="var(--primary)" strokeWidth="6"
                strokeDasharray={2 * Math.PI * 32}
                strokeDashoffset={2 * Math.PI * 32 * (1 - completedCount / 100)}
                strokeLinecap="round"
                transform="rotate(-90 37 37)"
              />
            </svg>
            <span className="challenge-progress-label" style={{ fontWeight: 800, color: 'var(--text-primary)', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{completedCount}/100</span>
          </div>
        </section>

        {/* Streak Counter Header */}
        <section className="animate-fade" style={{ marginBottom: '2rem' }}>
          <StreakCorner streak={streak} longestStreak={longestStreak} />
        </section>

        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Stats Row - responsive to sidebar state */}
          <div className="stats-grid">
            <style>{`
              /* Sidebar open: 3 cols then 2 cols (5 cards) */
              [data-sidebar='open'] .stats-grid {
                grid-template-columns: repeat(3, 1fr);
              }
              /* Sidebar closed: single row of 5 */
              [data-sidebar='closed'] .stats-grid {
                grid-template-columns: repeat(5, 1fr);
              }
              /* Default fallback (auto) */
              .stats-grid {
                display: grid;
                gap: 1rem;
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
              }
              @media (max-width: 991px) {
                [data-sidebar='open'] .stats-grid,
                [data-sidebar='closed'] .stats-grid {
                  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                }
              }
            `}</style>
            <div className="stat-card stat-card--gold card-shiny">
              <div className="stat-card__icon">⚡</div>
              <div className="stat-card__value">{student?.xp_total || 0} XP</div>
              <div className="stat-card__label">Total XP</div>
            </div>
            <div className="stat-card stat-card--success card-shiny">
              <div className="stat-card__icon">✅</div>
              <div className="stat-card__value">{stats.completedCount}</div>
              <div className="stat-card__label">Days Completed</div>
            </div>
            <div className="stat-card card-shiny" style={{ '--primary-glow': 'rgba(255,87,34,0.3)' }}>
              <div className="stat-card__icon">🔥</div>
              <div className="stat-card__value" style={{ background: 'linear-gradient(135deg, #ff8a65, #ff5722)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: 'drop-shadow(0 0 8px rgba(255,87,34,0.3))' }}>{streak} Days</div>
              <div className="stat-card__label">Current Streak</div>
            </div>
            <div className="stat-card card-shiny" style={{ '--primary-glow': 'var(--primary-glow)' }}>
              <div className="stat-card__icon">🎯</div>
              <div className="stat-card__value">{stats.avgAccuracy}%</div>
              <div className="stat-card__label">Avg Accuracy</div>
            </div>
            <div className="stat-card stat-card--teal card-shiny">
              <div className="stat-card__icon">⏱</div>
              <div className="stat-card__value">{Math.round(stats.totalTime / 60)} m</div>
              <div className="stat-card__label">Total Time Spent</div>
            </div>
          </div>

          {/* ─── Gamification Tab Bar ───────────────────────────── */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '0.5rem' }}>
            {[
              { id: 'dashboard', label: '🏠 Dashboard' },
              { id: 'league',    label: '🏆 Weekly League' },
              { id: 'shop',      label: '🛍 XP Shop' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.6rem 1.1rem',
                  background: activeTab === tab.id ? 'linear-gradient(90deg,rgba(255,122,0,0.18),rgba(255,122,0,0.06))' : 'transparent',
                  color: activeTab === tab.id ? 'var(--primary-bright)' : 'var(--text-secondary)',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  fontSize: '0.9rem',
                  borderRadius: '6px 6px 0 0',
                  transition: 'all 0.2s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── Daily Quest Board (inside Dashboard tab) ─────── */}
          {activeTab === 'dashboard' && (
            <div className="card animate-fade" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>⚔️ Daily Quest Board</h3>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Complete quests to earn bonus XP. Resets every midnight.</p>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'rgba(255,122,0,0.08)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(255,122,0,0.15)' }}>
                  +50 XP each
                </span>
              </div>
              {questsLoading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Loading quests…</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {quests.map(q => {
                    const pct = Math.min((q.current / q.target) * 100, 100)
                    return (
                      <div key={q.id} style={{
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        padding: '0.9rem 1.1rem',
                        background: q.claimed ? 'rgba(16,185,129,0.04)' : q.completed ? 'rgba(255,122,0,0.04)' : 'rgba(255,255,255,0.02)',
                        border: q.claimed ? '1px solid rgba(16,185,129,0.25)' : q.completed ? '1px solid rgba(255,122,0,0.25)' : '1px solid rgba(255,255,255,0.07)',
                        borderRadius: '12px',
                        transition: 'all 0.3s',
                      }}>
                        <div style={{ fontSize: '1.8rem', flexShrink: 0 }}>
                          {q.id === 'bead_fun_100' ? '🧮' : q.id === 'solve_25' ? '📐' : '⏱'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{q.title}</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{q.current}/{q.target} {q.unit}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{q.desc}</p>
                          <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: q.claimed ? 'var(--success)' : 'linear-gradient(90deg,var(--primary),var(--primary-bright))', borderRadius: 3, transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                        <button
                          disabled={!q.completed || q.claimed}
                          onClick={async () => {
                            try {
                              await api.post(`/students/${student.id}/quests/${q.id}/claim`)
                              toast.success(`+50 XP earned for "${q.title}"! 🎉`)
                              loadQuestsAndShop()
                            } catch (e) {
                              toast.error(e?.response?.data?.message || 'Could not claim quest.')
                            }
                          }}
                          style={{
                            padding: '0.45rem 0.9rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            borderRadius: '8px',
                            border: 'none',
                            cursor: q.completed && !q.claimed ? 'pointer' : 'not-allowed',
                            background: q.claimed ? 'rgba(16,185,129,0.12)' : q.completed ? 'linear-gradient(135deg,var(--primary),var(--primary-bright))' : 'rgba(255,255,255,0.04)',
                            color: q.claimed ? 'var(--success)' : q.completed ? '#fff' : 'var(--text-muted)',
                            opacity: q.completed || q.claimed ? 1 : 0.5,
                            transition: 'all 0.2s',
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {q.claimed ? '✓ Claimed' : q.completed ? 'Claim +50' : 'Locked'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── Weekly League Panel ───────────────────────────── */}
          {activeTab === 'league' && (
            <div className="card animate-fade" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              {leagueLoading ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading league standings…</p>
              ) : (() => {
                const tierColors = {
                  Bronze: '#cd7f32', Silver: '#c0c0c0', Gold: '#f5c842',
                  Platinum: '#00d4aa', Diamond: '#60a5fa', Master: '#8b5cf6', 'Grand Master': '#ff7a00'
                }
                const tierColor = tierColors[leagueData.tier] || '#cd7f32'
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                      <div style={{ fontSize: '2.8rem' }}>
                        {leagueData.tier === 'Bronze' ? '🥉' : leagueData.tier === 'Silver' ? '🥈' : leagueData.tier === 'Gold' ? '🥇' : leagueData.tier === 'Platinum' ? '💎' : leagueData.tier === 'Diamond' ? '💠' : leagueData.tier === 'Master' ? '👑' : '🔱'}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: tierColor }}>{leagueData.tier} League</h3>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Weekly standings reset on Monday. Top 3 get promoted 🚀</p>
                      </div>
                    </div>

                    <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} /> Promotion Zone (Top 3)</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> Relegation Zone (Bottom 3)</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {leagueData.standings?.map(p => (
                        <div
                          key={p.id}
                          className={p.status === 'promotion' ? 'league-zone-promotion' : p.status === 'relegation' ? 'league-zone-relegation' : ''}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.9rem',
                            padding: '0.7rem 1rem',
                            borderRadius: '10px',
                            background: p.isPlayer ? 'rgba(255,122,0,0.06)' : 'rgba(255,255,255,0.02)',
                            border: p.isPlayer ? '1px solid rgba(255,122,0,0.3)' : '1px solid transparent',
                            transition: 'all 0.2s',
                          }}
                        >
                          <span style={{ fontWeight: 800, fontSize: '0.85rem', minWidth: 22, color: p.rank <= 3 ? tierColor : 'var(--text-muted)', textAlign: 'center' }}>
                            {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
                          </span>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: p.isPlayer ? 'linear-gradient(135deg,var(--primary),var(--primary-dark))' : 'rgba(255,255,255,0.06)',
                            fontWeight: 800, fontSize: '0.85rem', color: p.isPlayer ? '#fff' : 'var(--text-secondary)',
                            flexShrink: 0,
                          }}>
                            {p.name[0]}
                          </div>
                          <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: p.isPlayer ? 700 : 400, color: p.isPlayer ? 'var(--primary-bright)' : 'var(--text-primary)' }}>
                            {p.name} {p.isPlayer && <span style={{ fontSize: '0.72rem', background: 'rgba(255,122,0,0.12)', padding: '2px 6px', borderRadius: 4, color: 'var(--primary)' }}>YOU</span>}
                          </span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{p.weeklyXp} XP</span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* ─── XP Shop Panel ────────────────────────────────── */}
          {activeTab === 'shop' && (() => {
            const xpBalance = (student?.xp_total || 0) - spentXp
            const SHOP_ITEMS = [
              { id: 'gold_glow', type: 'frame', name: 'Gold Glow Frame', desc: 'Golden pulsing glow around your avatar', icon: '✨', cost: 200 },
              { id: 'cyber_pulse', type: 'frame', name: 'Cyber Pulse Frame', desc: 'Teal energy field avatar ring', icon: '⚡', cost: 350 },
              { id: 'magic_shield', type: 'frame', name: 'Magic Shield Frame', desc: 'Violet mystic shield ring', icon: '🔮', cost: 500 },
              { id: 'gm_border', type: 'frame', name: 'Grand Master Border', desc: 'Exclusive fiery Grand Master ring', icon: '🔱', cost: 1000 },
              { id: 'orange_neon', type: 'skin', name: 'Orange Neon Skin', desc: 'Neon-orange glow on all cards', icon: '🟠', cost: 150 },
              { id: 'teal_neon', type: 'skin', name: 'Teal Neon Skin', desc: 'Teal glow on all cards', icon: '🩵', cost: 150 },
              { id: 'violet_neon', type: 'skin', name: 'Violet Neon Skin', desc: 'Purple mystical glow on all cards', icon: '💜', cost: 150 },
              { id: 'cyberpunk', type: 'theme', name: 'Cyberpunk Theme', desc: 'Dark grid overlay background', icon: '🌐', cost: 300 },
              { id: 'deep_forest', type: 'theme', name: 'Deep Forest Theme', desc: 'Soft green nature background', icon: '🌲', cost: 300 },
            ]

            return (
              <div className="card animate-fade" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>🛍 XP Shop</h3>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Spend your XP on avatar frames, card skins, and themes</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-gold)' }}>⚡ {xpBalance} XP</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Available balance</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                  {SHOP_ITEMS.map(item => {
                    const owned = unlockedItems.includes(item.id)
                    const isEquipped = equippedFrame === item.id || equippedTheme === item.id
                    const canAfford = xpBalance >= item.cost

                    return (
                      <div key={item.id} style={{
                        padding: '1.1rem',
                        borderRadius: '14px',
                        background: owned ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
                        border: isEquipped ? '1.5px solid rgba(255,122,0,0.5)' : owned ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.07)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        transition: 'all 0.2s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '2rem' }}>{item.icon}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{item.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: owned ? 'var(--success)' : canAfford ? 'var(--accent-gold)' : 'var(--error)' }}>
                            {owned ? '✓ Owned' : `⚡ ${item.cost} XP`}
                          </span>
                          {owned ? (
                            <button
                              onClick={async () => {
                                const equipType = item.type === 'frame' ? 'frame' : 'theme'
                                try {
                                  await api.post(`/students/${student.id}/equip-item`, {
                                    itemId: isEquipped ? 'default' : item.id,
                                    type: equipType,
                                  })
                                  toast.success(isEquipped ? 'Item unequipped.' : `${item.name} equipped! ✨`)
                                  loadQuestsAndShop()
                                } catch (e) {
                                  toast.error('Could not equip item.')
                                }
                              }}
                              style={{
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                borderRadius: '8px',
                                border: isEquipped ? '1px solid rgba(255,122,0,0.4)' : '1px solid rgba(255,255,255,0.12)',
                                background: isEquipped ? 'rgba(255,122,0,0.12)' : 'rgba(255,255,255,0.05)',
                                color: isEquipped ? 'var(--primary-bright)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              {isEquipped ? '✦ Equipped' : 'Equip'}
                            </button>
                          ) : (
                            <button
                              disabled={!canAfford}
                              onClick={async () => {
                                try {
                                  await api.post(`/students/${student.id}/buy-item`, { itemId: item.id, cost: item.cost })
                                  toast.success(`${item.name} unlocked! 🎉`)
                                  loadQuestsAndShop()
                                } catch (e) {
                                  toast.error(e?.response?.data?.message || 'Purchase failed.')
                                }
                              }}
                              style={{
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                borderRadius: '8px',
                                border: 'none',
                                background: canAfford ? 'linear-gradient(135deg,var(--primary),var(--primary-bright))' : 'rgba(255,255,255,0.04)',
                                color: canAfford ? '#fff' : 'var(--text-muted)',
                                cursor: canAfford ? 'pointer' : 'not-allowed',
                                opacity: canAfford ? 1 : 0.5,
                              }}
                            >
                              Buy
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Badges & Achievements Section */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.25rem', fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600 }}>🏆 Badges & Achievements</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Track your milestones, unlock dynamic abacus badges, and share achievements with friends!</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              {achievements.map(badge => {
                const percent = Math.min((badge.current / badge.target) * 100, 100)
                return (
                  <div 
                    key={badge.id} 
                    className="card-3d"
                    onClick={() => badge.earned && setSelectedBadge(badge)}
                    style={{
                      background: badge.earned ? 'rgba(255,122,0,0.04)' : 'rgba(255,255,255,0.01)',
                      border: badge.earned ? '1px solid rgba(255,122,0,0.3)' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      opacity: badge.earned ? 1 : 0.65,
                      cursor: badge.earned ? 'pointer' : 'default',
                      position: 'relative',
                      boxShadow: badge.earned ? '0 8px 24px rgba(255,122,0,0.15)' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {/* Badge Icon */}
                    <div style={{
                      fontSize: '2.5rem',
                      marginBottom: '0.75rem',
                      filter: badge.earned ? 'drop-shadow(0 0 10px rgba(255,122,0,0.5))' : 'grayscale(100%)',
                      transform: badge.earned ? 'scale(1.05)' : 'scale(0.95)'
                    }}>
                      {badge.icon}
                    </div>
                    
                    {/* Badge Info */}
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.25rem', color: badge.earned ? 'var(--primary-bright)' : 'var(--text-secondary)' }}>
                      {badge.title}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.75rem', minHeight: '34px' }}>
                      {badge.desc}
                    </p>
                    
                    {/* Badge Progress bar */}
                    <div style={{ width: '100%', marginTop: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                        <span>Progress</span>
                        <span>{Math.round(badge.current)} / {badge.target} {badge.unit}</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${percent}%`,
                          height: '100%',
                          background: badge.earned 
                            ? 'linear-gradient(90deg, var(--primary), var(--primary-bright))' 
                            : 'var(--text-muted)',
                          borderRadius: '3px',
                          boxShadow: badge.earned ? '0 0 8px var(--primary)' : 'none'
                        }} />
                      </div>
                    </div>
                    
                    {/* Earned Banner Ribbon */}
                    {badge.earned && (
                      <span style={{
                        position: 'absolute', top: '8px', right: '8px',
                        fontSize: '0.65rem', fontWeight: 800, color: 'var(--success)',
                        background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px'
                      }}>
                        EARNED
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected Badge Share Modal */}
          {selectedBadge && (
            <div 
              className="modal-overlay" 
              onClick={() => setSelectedBadge(null)}
              style={{ zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div 
                className="card animate-pop" 
                onClick={e => e.stopPropagation()} 
                style={{ maxWidth: '440px', width: '100%', margin: '1.5rem', padding: '2.5rem', textAlign: 'center', background: 'rgba(15,20,32,0.95)', border: '1px solid rgba(255,122,0,0.3)', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}
              >
                <div style={{ fontSize: '4.5rem', marginBottom: '1rem' }}>
                  {selectedBadge.icon}
                </div>
                <h2 style={{ fontSize: '1.6rem', color: 'var(--primary-bright)', marginBottom: '0.25rem' }}>
                  {selectedBadge.title} Badge!
                </h2>
                <span className="badge badge-success" style={{ marginBottom: '1.5rem' }}>🏆 Milestone Earned</span>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
                  "{selectedBadge.desc}"
                </p>

                {/* Sharing Block */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `🎉 I just unlocked the "${selectedBadge.title}" ${selectedBadge.icon} badge in the 100 Days of Abacus Challenge! 🧮 Learn mental math with me at Brain Mantra! @brainmantra`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-whatsapp"
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', height: '48px', fontSize: '0.95rem' }}
                  >
                    💬 Share on WhatsApp
                  </a>
                  
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `I just unlocked the "${selectedBadge.title}" ${selectedBadge.icon} badge in the 100 Days of Abacus Challenge! 🧮 Join me @brainmantra`
                      )
                      toast.success('Instagram tag text copied! Share your story & tag @brainmantra.')
                    }}
                    className="btn btn-ghost"
                    style={{ border: '1.5px solid rgba(255,255,255,0.1)', height: '48px', fontSize: '0.95rem', justifyContent: 'center' }}
                  >
                    📸 Copy Instagram Tag
                  </button>

                  <button
                    onClick={() => setSelectedBadge(null)}
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}
                  >
                    Close Dialog
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Recent Day Completions Table */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Completed Days History</h3>
            {days.filter(d => d.completed).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No completed days yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Day</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Accuracy</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>XP Earned</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Marks</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Time Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.filter(d => d.completed).map(d => (
                      <tr key={d.day_number} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ fontWeight: 'bold', padding: '0.75rem 1rem' }}>Day {d.day_number}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ 
                            color: d.accuracy >= 90 ? 'var(--success)' : d.accuracy >= 70 ? 'var(--accent-gold)' : 'var(--error)',
                            fontWeight: '600'
                          }}>
                            {d.accuracy}%
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>+{d.xp_earned} XP</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{d.total_marks} marks</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{Math.floor(d.time_taken_seconds / 60)}m {d.time_taken_seconds % 60}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </StudentLayout>
  )
}
