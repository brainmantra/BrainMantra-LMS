import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../utils/api'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import StudentAnswersTab from '../components/StudentAnswersTab'


const LEVELS = ['beginner','l1','l2','l3','l4','l5','l6','l7','l8','alumni','gm']
const LEVEL_LABELS = {
  beginner: 'Beginner',
  l1: 'Level 1',
  l2: 'Level 2',
  l3: 'Level 3',
  l4: 'Level 4',
  l5: 'Level 5',
  l6: 'Level 6',
  l7: 'Level 7',
  l8: 'Level 8',
  alumni: 'Alumni',
  gm: 'Grand Master (GM)'
}

const isMultiLineRequired = (level, day) => {
  const normLevel = String(level).toLowerCase().trim();
  const dNum = parseInt(day, 10);
  if (normLevel === 'l1' || normLevel === 'beginner') return true;
  if (dNum === 5) return true;
  return false;
};

function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__value" style={{ color: color || 'var(--primary-light)' }}>{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────────
   OVERVIEW TAB
────────────────────────────────────────────────────────────────────────────── */
function OverviewTab() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.get('/admin/stats').then(r => { setStats(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-screen" style={{ minHeight: 'unset', height: 300 }}><div className="spinner" /></div>
  if (!stats) return null

  const totalStudents = stats.totalStudents?.reduce((s, r) => s + parseInt(r.count), 0) || 0

  return (
    <div className="animate-slide-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Dashboard Overview</h1>
        <button className="btn btn-admin btn-sm" onClick={() => navigate('/leaderboard')}>🏆 View Weekly Leaderboard</button>
      </div>

      <div className="stat-grid" style={{ marginBottom: '2rem' }}>
        <StatCard icon="👥" label="Total Students" value={totalStudents} />
        <StatCard icon="📅" label="Active Today" value={stats.activeToday} color="var(--accent-teal)" />
        <StatCard icon="✅" label="Completed Today" value={stats.completedToday} color="var(--success)" />
        <StatCard icon="⚡" label="XP Distributed Today" value={stats.xpToday} color="var(--accent-gold)" />
        <StatCard icon="⏳" label="Pending Teacher Days" value={stats.pendingTeacherDays?.length || 0} color="var(--warning)" />
      </div>

      {/* Per-level breakdown */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Students Per Level</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {(stats.totalStudents || []).map(r => (
            <div key={r.level} style={{ padding: '0.5rem 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{LEVEL_LABELS[r.level] || r.level}: </span>
              <strong style={{ color: 'var(--primary-light)' }}>{r.count}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Pending teacher alerts */}
      {stats.pendingTeacherDays?.length > 0 && (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <div>
            <strong>Teacher questions not yet submitted:</strong>
            <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {stats.pendingTeacherDays.map(p => (
                <span key={`${p.level}-${p.day_number}`} className="badge badge-warning">
                  {LEVEL_LABELS[p.level] || p.level} · Day {p.day_number}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────────
   STUDENTS TAB
────────────────────────────────────────────────────────────────────────────── */
function StudentsTab() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [selected, setSelected] = useState(null)
  const [selectedDays, setSelectedDays] = useState([])
  const [dayLoading, setDayLoading] = useState(false)
  const [showCredsModal, setShowCredsModal] = useState(false)
  const [credUsername, setCredUsername] = useState('')
  const [credPassword, setCredPassword] = useState('')
  const [credSaving, setCredSaving] = useState(false)

  // Add Student states
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMobile, setNewMobile] = useState('')
  const [newLevel, setNewLevel] = useState('l1')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newSaving, setNewSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [usernameAutoFilled, setUsernameAutoFilled] = useState(true)

  // Auto-generate login ID from name whenever name changes (unless admin edited manually)
  const generateUsernameFromName = (name) =>
    name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

  useEffect(() => {
    if (usernameAutoFilled) {
      setNewUsername(generateUsernameFromName(newName))
    }
  }, [newName, usernameAutoFilled])

  const handleSyncSheet = async () => {
    if (!window.confirm('This will pull students from the Google Sheet and generate passwords for new/missing students. Proceed?')) return
    setSyncing(true)
    try {
      const res = await adminApi.post('/admin/students/sync')
      toast.success(`Synced! ${res.data.addedCount} new added, ${res.data.credentialsGenerated} credentials assigned.`)
      fetchStudents()
    } catch (err) {
      toast.error('Failed to sync students from sheet.')
    } finally {
      setSyncing(false)
    }
  }

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (filterLevel) params.append('level', filterLevel)
      const res = await adminApi.get(`/admin/students?${params}`)
      setStudents(res.data.students || [])
    } catch { toast.error('Failed to load students.') }
    finally { setLoading(false) }
  }, [search, filterLevel])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  const openStudent = async (s) => {
    setSelected(s); setDayLoading(true)
    setCredUsername(s.username || '')
    setCredPassword('')
    try {
      const res = await adminApi.get(`/admin/students/${s.id}`)
      setSelectedDays(res.data.days || [])
    } catch { toast.error('Could not load student history.') }
    finally { setDayLoading(false) }
  }

  const handleSaveCredentials = async (e) => {
    e.preventDefault()
    if (!credUsername || !credPassword) {
      toast.error('Both Username and Password are required.')
      return
    }
    setCredSaving(true)
    try {
      await adminApi.post(`/admin/students/${selected.id}/credentials`, {
        username: credUsername,
        password: credPassword
      })
      toast.success('Credentials saved successfully.')
      setSelected(prev => ({ ...prev, username: credUsername.trim().toLowerCase() }))
      setStudents(prev => prev.map(st => st.id === selected.id ? { ...st, username: credUsername.trim().toLowerCase() } : st))
      setShowCredsModal(false)
      setCredPassword('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save credentials.')
    } finally {
      setCredSaving(false)
    }
  }

  const handleAddStudent = async (e) => {
    e.preventDefault()
    if (!newName || !newMobile || !newLevel || !newUsername || !newPassword) {
      toast.error('All fields are required.')
      return
    }
    if (!/^\d{10}$/.test(newMobile)) {
      toast.error('Mobile number must be exactly 10 digits.')
      return
    }
    setNewSaving(true)
    try {
      await adminApi.post('/admin/students', {
        name: newName,
        mobile: newMobile,
        level: newLevel,
        username: newUsername,
        password: newPassword
      })
      toast.success('Student added successfully.')
      fetchStudents()
      setShowAddModal(false)
      setNewName('')
      setNewMobile('')
      setNewLevel('l1')
      setNewUsername('')
      setNewPassword('')
      setUsernameAutoFilled(true)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add student.')
    } finally {
      setNewSaving(false)
    }
  }

  const getStatusIcon = (days, idx) => {
    const d = days.find(d => d.day_number === idx + 1)
    if (!d) return { icon: '○', cls: 'day-card--locked', title: 'Locked' }
    if (d.completed) return { icon: '✓', cls: 'day-card--completed', title: `Done — ${d.accuracy}% accuracy` }
    if (d.opened) return { icon: '⏳', cls: 'day-card--progress', title: 'Opened, not completed' }
    return { icon: '○', cls: '', title: 'Not started' }
  }

  if (selected) {
    return (
      <div className="animate-slide-up">
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: '1.5rem' }} onClick={() => setSelected(null)}>
          ← Back to All Students
        </button>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
            {selected.name[0]}
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '0.2rem' }}>{selected.name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {selected.mobile} · {LEVEL_LABELS[selected.level] || selected.level} · 
              🔥 {selected.streak} streak · ⚡ {selected.xp_total} XP
            </p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>Login ID:</strong> {selected.username || <em style={{ color: 'var(--text-muted)' }}>Not Set</em>}
              {' | '}
              <strong>Password:</strong> {selected.plain_password || <em style={{ color: 'var(--text-muted)' }}>Not Set</em>}
            </p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCredsModal(true)}>
              🔑 Set Login ID & Password
            </button>
          </div>
        </div>

        {dayLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
        ) : (
          <div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>100-Day Grid</h3>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '12px',
              marginBottom: '1.5rem' 
            }}>
              {Array.from({ length: 100 }, (_, i) => {
                const dayNum = i + 1
                const dayRecord = selectedDays.find(d => d.day_number === dayNum)
                const { icon, cls, title } = getStatusIcon(selectedDays, i)
                
                const sectionData = dayRecord?.section_data || {}
                const sections = Object.keys(sectionData)

                const SECTION_LABELS = {
                  p1: 'Abacus',
                  p2: 'Visual',
                  p3: 'Mul',
                  p4: '2 Steps'
                }

                return (
                  <div key={i} className={`day-card ${cls}`} title={title} style={{ 
                    cursor: 'default', 
                    aspectRatio: 'auto', 
                    padding: '0.75rem', 
                    minHeight: '80px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.5rem',
                    alignItems: 'stretch'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="day-card__num" style={{ fontSize: '0.9rem' }}>Day {dayNum}</span>
                      <span className="day-card__emoji" style={{ fontSize: '1rem' }}>{icon}</span>
                    </div>
                    
                    {sections.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {sections.map(sec => {
                          const sd = sectionData[sec]
                          const secAcc = sd.questionCount > 0 ? Math.round((sd.correct / sd.questionCount) * 100) : 0
                          const color = secAcc >= 80 ? 'var(--success)' : secAcc >= 50 ? 'var(--warning)' : 'var(--error)'
                          const label = SECTION_LABELS[sec] || sec.toUpperCase()
                          
                          return (
                            <div key={sec} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                              <span style={{ color, fontWeight: 'bold' }}>{sd.correct ?? 0}/{sd.questionCount ?? 0}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Stats */}
            <div className="stat-grid">
              <StatCard icon="✓" label="Days Completed" value={selectedDays.filter(d => d.completed).length} color="var(--success)" />
              <StatCard icon="🎯" label="Avg Accuracy" value={selectedDays.filter(d => d.accuracy).length > 0 ? Math.round(selectedDays.filter(d=>d.accuracy).reduce((s,d)=>s+parseFloat(d.accuracy),0)/selectedDays.filter(d=>d.accuracy).length)+'%' : '—'} />
              <StatCard icon="⚡" label="Total XP" value={selected.xp_total} color="var(--accent-gold)" />
              <StatCard icon="🔥" label="Best Streak" value={selected.longest_streak} color="var(--warning)" />
            </div>

            {/* Growth Chart */}
            <h3 style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>Performance Growth</h3>
            {selectedDays.filter(d => d.completed).length > 0 ? (
              <div style={{ height: '300px', width: '100%', background: 'var(--bg-elevated)', padding: '1rem', borderRadius: 'var(--radius-lg)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedDays.filter(d => d.completed)} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day_number" label={{ value: 'Day', position: 'insideBottomRight', offset: -5 }} />
                    <YAxis yAxisId="left" domain={[0, 100]} />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="accuracy" stroke="#10b981" name="Accuracy %" strokeWidth={3} />
                    <Line yAxisId="right" type="monotone" dataKey="xp_earned" stroke="#8b5cf6" name="XP Earned" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No completed days yet for a growth chart.</p>
            )}
          </div>
        )}
        
        {showCredsModal && (
          <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card animate-pop" style={{ maxWidth: 400, width: '90%', padding: '2rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: 'var(--text-primary)' }}>Set Login Credentials</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Assign a unique Login ID (Username) and Password for <strong>{selected.name}</strong>.
              </p>
              <form onSubmit={handleSaveCredentials}>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Login ID (Username)</label>
                  <input
                    className="form-input"
                    type="text"
                    required
                    placeholder="e.g. rahul_abacus"
                    value={credUsername}
                    onChange={e => setCredUsername(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Password</label>
                  <input
                    className="form-input"
                    type="password"
                    required
                    placeholder="e.g. password123"
                    value={credPassword}
                    onChange={e => setCredPassword(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => { setShowCredsModal(false); setCredPassword(''); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={credSaving}>
                    {credSaving ? 'Saving...' : 'Save Credentials'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="animate-slide-up">
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.6rem', flex: 1 }}>Students</h1>
        <button className="btn btn-secondary" onClick={handleSyncSheet} disabled={syncing}>
          {syncing ? 'Syncing...' : '🔄 Sync from Sheet'}
        </button>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          ➕ Add Student
        </button>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="search-input" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-input__icon">🔍</span>
          <input placeholder="Search name or mobile..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={{ width: 160 }}>
          <option value="">All Levels</option>
          {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Mobile</th><th>Level</th><th>Login / Pass</th><th>Streak</th><th>XP</th><th>Days Done</th><th>Last Active</th><th></th></tr></thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{s.mobile}</td>
                  <td><span className="badge badge-info">{LEVEL_LABELS[s.level] || s.level}</span></td>
                  <td style={{ fontSize: '0.85rem' }}>
                    <div style={{ color: 'var(--primary-light)' }}>{s.username || '—'}</div>
                    <div style={{ color: 'var(--text-muted)' }}>{s.plain_password || '—'}</div>
                  </td>
                  <td><span style={{ color: 'var(--warning)' }}>🔥 {s.streak}</span></td>
                  <td><span style={{ color: 'var(--accent-gold)' }}>⚡ {s.xp_total}</span></td>
                  <td>{s.days_completed ?? 0}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {s.last_active ? new Date(s.last_active).toLocaleDateString() : '—'}
                  </td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => openStudent(s)}>View →</button></td>
                </tr>
              ))}
              {students.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No students found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card animate-pop" style={{ maxWidth: 450, width: '90%', padding: '2rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: 'var(--text-primary)' }}>Add New Student</h3>
            <form onSubmit={handleAddStudent}>
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
                <input className="form-input" type="text" required placeholder="e.g. Rahul Sharma" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Mobile Number</label>
                <input className="form-input" type="tel" maxLength={10} required placeholder="10-digit mobile" value={newMobile} onChange={e => setNewMobile(e.target.value.replace(/\D/g, ''))} />
              </div>
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Level</label>
                <select value={newLevel} onChange={e => setNewLevel(e.target.value)} style={{ width: '100%' }}>
                  {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label" style={{ color: 'var(--text-secondary)' }}>
                  Login ID (Username)
                  {usernameAutoFilled && <span style={{ fontSize: '0.75rem', color: '#f5a623', marginLeft: '0.5rem' }}>● auto-filled from name</span>}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    className="form-input"
                    type="text"
                    required
                    placeholder="e.g. rahul_sharma"
                    value={newUsername}
                    onChange={e => {
                      setNewUsername(e.target.value)
                      setUsernameAutoFilled(false)
                    }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      setNewUsername(generateUsernameFromName(newName))
                      setUsernameAutoFilled(true)
                    }}
                    title="Re-generate from name"
                  >
                    ↺ Reset
                  </button>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Password</label>
                <input className="form-input" type="password" required placeholder="e.g. password123" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={newSaving}>
                  {newSaving ? 'Saving...' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────────
   TEACHERS TAB
────────────────────────────────────────────────────────────────────────────── */
function TeachersTab() {
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', assigned_levels: [], is_active: true })
  const [saving, setSaving] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try { const r = await adminApi.get('/admin/teachers'); setTeachers(r.data) }
    catch { toast.error('Failed to load teachers.') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [])

  const openCreate = () => { setEditing(null); setForm({ name: '', email: '', password: '', assigned_levels: [], is_active: true }); setShowForm(true) }
  const openEdit = (t) => { setEditing(t); setForm({ name: t.name, email: t.email, password: '', assigned_levels: t.assigned_levels || [], is_active: t.is_active }); setShowForm(true) }

  const toggleLevel = (l) => {
    setForm(f => ({ ...f, assigned_levels: f.assigned_levels.includes(l) ? f.assigned_levels.filter(x => x !== l) : [...f.assigned_levels, l] }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) await adminApi.put(`/admin/teachers/${editing.id}`, form)
      else await adminApi.post('/admin/teachers', form)
      toast.success(editing ? 'Teacher updated.' : 'Teacher created.')
      setShowForm(false); fetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save.')
    } finally { setSaving(false) }
  }

  const handleDeactivate = async (id) => {
    if (!confirm('Deactivate this teacher?')) return
    try { await adminApi.delete(`/admin/teachers/${id}`); toast.success('Teacher deactivated.'); fetch() }
    catch { toast.error('Could not deactivate.') }
  }

  return (
    <div className="animate-slide-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem' }}>Teachers</h1>
        <button className="btn btn-admin btn-sm" onClick={openCreate}>+ Add Teacher</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(245,200,66,0.3)' }}>
          <h3 style={{ marginBottom: '1rem' }}>{editing ? 'Edit Teacher' : 'New Teacher'}</h3>
          <form onSubmit={handleSave}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password {editing && '(leave blank to keep current)'}</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} {...(!editing ? { required: true } : {})} />
            </div>
            <div className="form-group">
              <label className="form-label">Assigned Levels</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {LEVELS.map(l => (
                  <button key={l} type="button"
                    className={`btn btn-sm ${form.assigned_levels.includes(l) ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => toggleLevel(l)}
                  >
                    {LEVEL_LABELS[l]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-admin" disabled={saving}>
                {saving ? <div className="spinner spinner-sm" /> : '💾 Save'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div> : (
        <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Levels</th><th>Status</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {teachers.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.email}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {(t.assigned_levels || []).map(l => <span key={l} className="badge badge-info">{LEVEL_LABELS[l] || l}</span>)}
                    </div>
                  </td>
                  <td><span className={`badge ${t.is_active ? 'badge-success' : 'badge-error'}`}>{t.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>Edit</button>
                    {t.is_active && <button className="btn btn-sm" style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }} onClick={() => handleDeactivate(t.id)}>Deactivate</button>}
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No teachers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────────
   QUESTION BANK TAB
────────────────────────────────────────────────────────────────────────────── */
function QuestionBankTab() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [level, setLevel] = useState('l1')
  const [section, setSection] = useState('')

  const fetch = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ level })
      if (section) params.append('section', section)
      const r = await adminApi.get(`/admin/question-bank?${params}`)
      setQuestions(r.data)
    } catch { toast.error('Could not load question bank.') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [level, section])

  return (
    <div className="animate-slide-up">
      <h1 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>Question Bank</h1>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <select value={level} onChange={e => setLevel(e.target.value)} style={{ width: 160 }}>
          {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
        </select>
        <select value={section} onChange={e => setSection(e.target.value)} style={{ width: 200 }}>
          <option value="">All Sections</option>
          {['abacus','visual','multiplication','division','tables','form_the_question','teacher_input','teacher_day'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <table className="data-table">
            <thead><tr><th>#</th><th>Section</th><th>Type</th><th>Question</th><th>Answer</th><th>Source</th></tr></thead>
            <tbody>
              {questions.map(q => (
                <tr key={q.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{q.question_index}</td>
                  <td><span className="badge badge-info">{q.section}</span></td>
                  <td><span className="badge badge-muted">{q.question_type}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', maxWidth: 280 }}>
                    {q.question_type === 'add' || q.question_type === 'visual'
                      ? `[${(q.addends || []).join(', ')}]`
                      : `${q.operand1} ${q.operator} ${q.operand2}`}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--success)' }}>{q.answer}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{q.source_sheet} Q{q.source_question_number}</td>
                </tr>
              ))}
              {questions.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No questions. Run the seed script to populate.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}



const convertLegacyToFormItems = (questionVal, answerVal) => {
  let blocks = []
  try {
    blocks = typeof questionVal === 'string' ? JSON.parse(questionVal) : questionVal
  } catch (e) {
    return [{
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'question',
      questionType: 'short_answer',
      questionText: String(questionVal || ''),
      correctAnswer: String(answerVal || ''),
      image: '',
      options: []
    }]
  }

  if (!Array.isArray(blocks)) {
    return [{
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'question',
      questionType: 'short_answer',
      questionText: String(questionVal || ''),
      correctAnswer: String(answerVal || ''),
      image: '',
      options: []
    }]
  }

  let answers = []
  try {
    answers = typeof answerVal === 'string' ? JSON.parse(answerVal) : answerVal
    if (!Array.isArray(answers)) answers = [answerVal]
  } catch (e) {
    answers = [answerVal]
  }

  const items = []
  let ansIdx = 0

  blocks.forEach((block, index) => {
    if (block.type === 'text') {
      const nextBlock = blocks[index + 1]
      const hasBox = nextBlock && (nextBlock.type === 'box' || nextBlock.type === 'paragraph' || nextBlock.type === 'step')
      
      items.push({
        id: `item_${index}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'question',
        questionType: hasBox && nextBlock.type === 'paragraph' ? 'paragraph' : 'short_answer',
        questionText: block.content || '',
        correctAnswer: hasBox ? String(answers[ansIdx++] || '') : '',
        image: '',
        options: []
      })
    } else if (block.type === 'image') {
      items.push({
        id: `item_${index}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'image_only',
        image: block.content || '',
        description: 'Image description'
      })
    } else if (block.type === 'instruction' || block.type === 'example') {
      items.push({
        id: `item_${index}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'section_header',
        title: block.type === 'example' ? '💡 Example' : 'Instruction',
        description: block.content || ''
      })
    } else if (block.type === 'options') {
      const options = (block.content || '').split(',').map((o, oi) => ({ id: `opt_${oi}`, text: o.trim(), image: '' }))
      items.push({
        id: `item_${index}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'question',
        questionType: 'multiple_choice',
        questionText: 'Select an option:',
        options,
        correctAnswer: String(answers[ansIdx++] || ''),
        image: ''
      })
    } else if (block.type === 'box' || block.type === 'paragraph' || block.type === 'step') {
      const prevBlock = blocks[index - 1]
      const isConsumed = prevBlock && prevBlock.type === 'text'
      if (!isConsumed) {
        items.push({
          id: `item_${index}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'question',
          questionType: block.type === 'paragraph' ? 'paragraph' : 'short_answer',
          questionText: 'Answer:',
          correctAnswer: String(answers[ansIdx++] || ''),
          image: '',
          options: []
        })
      }
    }
  })

  return items.length > 0 ? items : [{
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'question',
    questionType: 'short_answer',
    questionText: '',
    correctAnswer: '',
    image: '',
    options: []
  }]
}

function CustomFormsTab() {
  const [qLevel, setQLevel] = useState('l1')
  const [qDay, setQDay] = useState('1')
  const [qSection, setQSection] = useState('abacus')
  const [formTitle, setFormTitle] = useState('Abacus Daily Challenge')
  const [formDescription, setFormDescription] = useState('Solve all questions step by step.')
  const [formItems, setFormItems] = useState([])
  const [qFormatExample, setQFormatExample] = useState('')
  const [editQId, setEditQId] = useState(null)
  const [qSaving, setQSaving] = useState(false)
  const [savedQuestions, setSavedQuestions] = useState([])
  const [loadingQ, setLoadingQ] = useState(false)

  const handleExcelImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws)
        
        const importedItems = data.map((row, idx) => {
          const qText = row.Question || row.question || ''
          const ans = row.Answer || row.answer || ''
          const qTypeRaw = String(row.Type || row.type || 'short_answer').toLowerCase()
          
          let questionType = 'short_answer'
          if (qTypeRaw.includes('paragraph') || qTypeRaw.includes('text')) {
            questionType = 'paragraph'
          } else if (qTypeRaw.includes('choice') || qTypeRaw.includes('radio') || qTypeRaw.includes('multiple')) {
            questionType = 'multiple_choice'
          } else if (qTypeRaw.includes('checkbox')) {
            questionType = 'checkbox'
          }

          let optionsList = []
          const optsRaw = row.Options || row.options
          if (optsRaw) {
            optionsList = String(optsRaw).split(',').map((optText, oIdx) => ({
              id: `opt_${Date.now()}_${idx}_${oIdx}`,
              text: optText.trim(),
              image: ''
            }))
          } else if (questionType === 'multiple_choice' || questionType === 'checkbox') {
            optionsList = [{ id: `opt_${Date.now()}_${idx}_0`, text: 'Option 1', image: '' }]
          }

          return {
            id: `q_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
            type: 'question',
            questionType,
            questionText: qText,
            correctAnswer: ans,
            image: '',
            options: optionsList
          }
        }).filter(item => item.questionText)

        setFormItems(prev => [...prev, ...importedItems])
        toast.success(`Imported ${importedItems.length} questions into the form!`)
      } catch (err) {
        toast.error('Failed to parse Excel file')
      }
    }
    reader.readAsBinaryString(file)
  }

  const loadQuestions = async () => {
    if (!qLevel) return
    setLoadingQ(true)
    try {
      const params = new URLSearchParams({ level: qLevel })
      if (qDay) params.append('day_number', qDay)
      const res = await adminApi.get(`/admin/teacher-questions?${params}`)
      setSavedQuestions(res.data)
    } catch {
      toast.error('Could not fetch questions.')
    } finally {
      setLoadingQ(false)
    }
  }

  useEffect(() => {
    loadQuestions()
  }, [qLevel, qDay])

  useEffect(() => {
    const secs = getTeacherSectionsForLevel(qLevel, qDay)
    if (secs.length > 0) {
      if (!secs.some(s => s.value === qSection)) {
        setQSection(secs[0].value)
      }
    } else {
      setQSection('')
    }
  }, [qLevel, qDay, qSection])

  useEffect(() => {
    if (!qLevel || !qDay || !qSection) return
    const match = savedQuestions.find(q => 
      q.level === qLevel && 
      q.day_number === parseInt(qDay, 10) && 
      q.section === qSection
    )
    if (match) {
      setEditQId(match.id)
      setQFormatExample(match.format_example || '')
      try {
        const parsed = JSON.parse(match.question)
        if (parsed && typeof parsed === 'object' && parsed.items) {
          setFormTitle(parsed.title || 'Abacus Daily Challenge')
          setFormDescription(parsed.description || '')
          setFormItems(parsed.items || [])
        } else {
          const convertedItems = convertLegacyToFormItems(parsed || match.question, match.answer)
          setFormTitle(`Daily Challenge - Day ${qDay}`)
          setFormDescription('')
          setFormItems(convertedItems)
        }
      } catch (e) {
        setFormTitle(`Daily Challenge - Day ${qDay}`)
        setFormDescription('')
        setFormItems([{
          id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'question',
          questionType: 'short_answer',
          questionText: match.question || '',
          correctAnswer: match.answer || '',
          image: '',
          options: []
        }])
      }
    } else {
      setEditQId(null)
      setQFormatExample('')
      setFormTitle(`Daily Challenge - Day ${qDay}`)
      setFormDescription('')
      setFormItems([{
        id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'question',
        questionType: 'short_answer',
        questionText: '',
        correctAnswer: '',
        image: '',
        options: []
      }])
    }
  }, [qLevel, qDay, qSection, savedQuestions])

  const addFormItem = (type, qType = 'short_answer') => {
    const newItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
    }
    if (type === 'question') {
      newItem.questionType = qType
      newItem.questionText = ''
      newItem.correctAnswer = ''
      newItem.image = ''
      newItem.options = qType === 'multiple_choice' || qType === 'checkbox' 
        ? [{ id: `opt_${Date.now()}_0`, text: 'Option 1', image: '' }] 
        : []
    } else if (type === 'image_only') {
      newItem.image = ''
      newItem.description = ''
    } else if (type === 'section_header') {
      newItem.title = 'New Section'
      newItem.description = ''
    }
    setFormItems([...formItems, newItem])
  }

  const moveItem = (index, direction) => {
    const newItems = [...formItems]
    if (direction === 'up' && index > 0) {
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]]
    } else if (direction === 'down' && index < newItems.length - 1) {
      [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]]
    }
    setFormItems(newItems)
  }

  const deleteItem = (index) => {
    setFormItems(formItems.filter((_, i) => i !== index))
  }

  const duplicateItem = (index) => {
    const itemToCopy = formItems[index]
    const copied = JSON.parse(JSON.stringify(itemToCopy))
    copied.id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const newItems = [...formItems]
    newItems.splice(index + 1, 0, copied)
    setFormItems(newItems)
  }

  const getTeacherSectionsForLevel = (level, dayStr) => {
    const day = parseInt(dayStr, 10)
    if (day === 0) {
      if (level === 'l1' || level === 'beginner') {
        return [
          { value: 'abacus', label: '🧮 Abacus' },
          { value: 'teacher_input', label: '👨‍🏫 Teacher Input' }
        ]
      }
      return [
        { value: 'power_exercise', label: '⚡ Power Exercise' }
      ]
    }
    if (level === 'l1' || level === 'beginner') return [
      { value: 'abacus', label: '🧮 Abacus' },
      { value: 'teacher_input', label: '👨‍🏫 Teacher Input' }
    ]
    if (level === 'l4') return [
      { value: 'form_the_question', label: '✏ Form The Question' }
    ]
    if (level === 'l5') return [
      { value: 'cracking', label: '✏ Cracking' }
    ]
    if (level === 'l6') return [
      { value: 'bodmas', label: '🧮 Bodmas' }
    ]
    if (level === 'l8') return [
      { value: 'cracking', label: '✏ Cracking' }
    ]
    return []
  }

  return (
    <div className="animate-slide-up" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
      <h1 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>Google Forms Clone Creator</h1>

      {/* Filter row */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Level</label>
          <select value={qLevel} onChange={e => setQLevel(e.target.value)} style={{ width: 150 }}>
            {LEVELS.map(l => (
              <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Day Number</label>
          <input type="number" min="0" max="100" value={qDay} onChange={e => setQDay(e.target.value)} placeholder="e.g. 5" style={{ width: 100 }} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Section</label>
          <select value={qSection} onChange={e => setQSection(e.target.value)} style={{ width: 220 }}>
            {getTeacherSectionsForLevel(qLevel, qDay).map(sec => (
              <option key={sec.value} value={sec.value}>{sec.label}</option>
            ))}
            {getTeacherSectionsForLevel(qLevel, qDay).length === 0 && (
              <option value="">No custom sections (Auto-generated)</option>
            )}
          </select>
        </div>
      </div>

      {/* Designer UI */}
      {/* Designer UI */}

      {/* Format instruction (legacy support) */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', background: 'var(--bg-card)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
          <label className="form-label" style={{ marginBottom: '0.2rem', display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Format Example / Extra Instructions (Optional)</label>
          <input
            type="text"
            placeholder="e.g. 'Enter integer' or instructions"
            value={qFormatExample}
            onChange={e => setQFormatExample(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Items List */}
      {formItems.map((item, idx) => (
        <div key={item.id} className="card animate-fade-in" style={{
          padding: '1.5rem',
          marginBottom: '1.5rem',
          borderRadius: '8px',
          background: 'var(--bg-card)',
          boxShadow: 'var(--shadow-sm)',
          borderLeft: '5px solid transparent',
          position: 'relative',
        }}
        onMouseEnter={e => e.currentTarget.style.borderLeft = '5px solid #673ab7'}
        onMouseLeave={e => e.currentTarget.style.borderLeft = '5px solid transparent'}
        >
          
          {/* Reorder and Delete controls header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              <button type="button" className="btn btn-ghost btn-sm" disabled={idx === 0} onClick={() => moveItem(idx, 'up')}>▲ Up</button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={idx === formItems.length - 1} onClick={() => moveItem(idx, 'down')}>▼ Down</button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>Item {idx + 1}</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={item.type}
                onChange={e => {
                  const newItems = [...formItems]
                  const newType = e.target.value
                  newItems[idx].type = newType
                  if (newType === 'question') {
                    newItems[idx].questionType = 'short_answer'
                    newItems[idx].questionText = newItems[idx].questionText || ''
                    newItems[idx].correctAnswer = ''
                    newItems[idx].options = []
                  } else if (newType === 'image_only') {
                    newItems[idx].description = ''
                  } else if (newType === 'section_header') {
                    newItems[idx].title = 'Section Title'
                    newItems[idx].description = ''
                  }
                  setFormItems(newItems)
                }}
                style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              >
                <option value="question">❓ Question Field</option>
                <option value="image_only">🖼️ Image Block Only</option>
                <option value="section_header">🔖 Section Title/Break</option>
              </select>

              <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--text-muted)' }} onClick={() => duplicateItem(idx)}>📋 Duplicate</button>
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => deleteItem(idx)}>🗑️ Delete</button>
            </div>
          </div>

          {/* Render based on item type */}
          {item.type === 'section_header' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Section Title (e.g. Section 1: Mentals)"
                value={item.title || ''}
                onChange={e => {
                  const newItems = [...formItems]
                  newItems[idx].title = e.target.value
                  setFormItems(newItems)
                }}
                style={{ width: '100%', fontSize: '1.25rem', fontWeight: 600, padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              />
              <textarea
                rows={2}
                placeholder="Section Description / Instructions (Optional)"
                value={item.description || ''}
                onChange={e => {
                  const newItems = [...formItems]
                  newItems[idx].description = e.target.value
                  setFormItems(newItems)
                }}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', resize: 'vertical' }}
              />
            </div>
          )}

          {item.type === 'image_only' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Image upload area */}
              <div 
                onPaste={e => {
                  const itemsList = e.clipboardData.items;
                  for (let i = 0; i < itemsList.length; i++) {
                    if (itemsList[i].type.indexOf("image") !== -1) {
                      const blob = itemsList[i].getAsFile();
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const newItems = [...formItems]
                        newItems[idx].image = reader.result
                        setFormItems(newItems)
                      };
                      reader.readAsDataURL(blob);
                    }
                  }
                }}
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: '6px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.01)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const newItems = [...formItems]
                        newItems[idx].image = reader.result
                        setFormItems(newItems)
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{ display: 'block', margin: '0 auto 0.5rem' }}
                />
                Or paste image here (Ctrl+V)
              </div>
              
              {item.image && (
                <div style={{ marginTop: '0.5rem', position: 'relative', textAlign: 'center' }}>
                  <img 
                    src={item.image} 
                    alt="Preview" 
                    style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '4px', border: '1px solid var(--border)' }} 
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '50%', width: 24, height: 24, padding: 0 }}
                    onClick={() => {
                      const newItems = [...formItems]
                      newItems[idx].image = ''
                      setFormItems(newItems)
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
              
              <input
                type="text"
                placeholder="Image Description / Caption (e.g. Figure A)"
                value={item.description || ''}
                onChange={e => {
                  const newItems = [...formItems]
                  newItems[idx].description = e.target.value
                  setFormItems(newItems)
                }}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              />
            </div>
          )}

          {item.type === 'question' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              
              {/* Question input + Question Type Selector */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {isMultiLineRequired(qLevel, qDay) ? (
                  <textarea
                    rows={2}
                    placeholder="Question Title (e.g. What is 2 + 2?)"
                    value={item.questionText || ''}
                    onChange={e => {
                      const newItems = [...formItems]
                      newItems[idx].questionText = e.target.value
                      setFormItems(newItems)
                    }}
                    style={{ flex: 1, minWidth: '200px', fontSize: '1.1rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', resize: 'vertical' }}
                  />
                ) : (
                  <input
                    type="text"
                    placeholder="Question Title (e.g. What is 2 + 2?)"
                    value={item.questionText || ''}
                    onChange={e => {
                      const newItems = [...formItems]
                      newItems[idx].questionText = e.target.value
                      setFormItems(newItems)
                    }}
                    style={{ flex: 1, minWidth: '200px', fontSize: '1.1rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  />
                )}
                <select
                  value={item.questionType}
                  onChange={e => {
                    const newItems = [...formItems]
                    const newQType = e.target.value
                    newItems[idx].questionType = newQType
                    newItems[idx].correctAnswer = newQType === 'checkbox' ? [] : ''
                    newItems[idx].options = newQType === 'multiple_choice' || newQType === 'checkbox'
                      ? [{ id: `opt_${Date.now()}_0`, text: 'Option 1', image: '' }]
                      : []
                    setFormItems(newItems)
                  }}
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  <option value="short_answer">✏️ Short Answer</option>
                  <option value="paragraph">📑 Paragraph Text</option>
                  <option value="multiple_choice">🔘 Multiple Choice</option>
                  <option value="checkbox">☑️ Checkboxes</option>
                </select>
              </div>

              {/* Question image attachment */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input
                  type="file"
                  accept="image/*"
                  id={`q_img_file_${item.id}`}
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onloadend = () => {
                        const newItems = [...formItems]
                        newItems[idx].image = reader.result
                        setFormItems(newItems)
                      }
                      reader.readAsDataURL(file)
                    }
                  }}
                />
                <label
                  htmlFor={`q_img_file_${item.id}`}
                  style={{ cursor: 'pointer', padding: '4px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.85rem' }}
                >
                  🖼️ Attach Image to Question
                </label>
                {item.image && (
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <img src={item.image} alt="Question" style={{ maxHeight: '40px', borderRadius: '4px' }} />
                    <button
                      type="button"
                      style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => {
                        const newItems = [...formItems]
                        newItems[idx].image = ''
                        setFormItems(newItems)
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Question Choices or Answer Fields */}
              {(item.questionType === 'multiple_choice' || item.questionType === 'checkbox') ? (
                <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>
                    Choices (Select correct option(s) or leave all unchecked for manual review):
                  </span>
                  
                  {item.options.map((opt, oIdx) => (
                    <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      {item.questionType === 'multiple_choice' ? (
                        <input
                          type="radio"
                          name={`correct_${item.id}`}
                          checked={item.correctAnswer === opt.id}
                          onChange={() => {
                            const newItems = [...formItems]
                            newItems[idx].correctAnswer = opt.id
                            setFormItems(newItems)
                          }}
                        />
                      ) : (
                        <input
                          type="checkbox"
                          checked={Array.isArray(item.correctAnswer) && item.correctAnswer.includes(opt.id)}
                          onChange={(e) => {
                            const newItems = [...formItems]
                            let curr = Array.isArray(item.correctAnswer) ? [...item.correctAnswer] : []
                            if (e.target.checked) {
                              curr.push(opt.id)
                            } else {
                              curr = curr.filter(id => id !== opt.id)
                            }
                            newItems[idx].correctAnswer = curr
                            setFormItems(newItems)
                          }}
                        />
                      )}
                      
                      <input
                        type="text"
                        placeholder={`Option ${oIdx + 1}`}
                        value={opt.text}
                        onChange={e => {
                          const newItems = [...formItems]
                          newItems[idx].options[oIdx].text = e.target.value
                          setFormItems(newItems)
                        }}
                        style={{ flex: 1, minWidth: '150px', padding: '0.4rem', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                      />
                      
                      <input
                        type="file"
                        accept="image/*"
                        id={`opt_file_${item.id}_${opt.id}`}
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files[0]
                          if (file) {
                            const reader = new FileReader()
                            reader.onloadend = () => {
                              const newItems = [...formItems]
                              newItems[idx].options[oIdx].image = reader.result
                              setFormItems(newItems)
                            }
                            reader.readAsDataURL(file)
                          }
                        }}
                      />
                      <label
                        htmlFor={`opt_file_${item.id}_${opt.id}`}
                        style={{ cursor: 'pointer', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.8rem' }}
                      >
                        🖼️ Add Image
                      </label>

                      {opt.image && (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <img src={opt.image} alt="Option" style={{ maxHeight: '30px', maxWidth: '50px', borderRadius: '4px' }} />
                          <button
                            type="button"
                            style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 14, height: 14, fontSize: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => {
                              const newItems = [...formItems]
                              newItems[idx].options[oIdx].image = ''
                              setFormItems(newItems)
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#ef4444', padding: '0.2rem' }}
                        onClick={() => {
                          const newItems = [...formItems]
                          newItems[idx].options = newItems[idx].options.filter((_, oi) => oi !== oIdx)
                          setFormItems(newItems)
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--primary-light)', marginTop: '0.25rem' }}
                    onClick={() => {
                      const newItems = [...formItems]
                      newItems[idx].options.push({
                        id: `opt_${Date.now()}_${item.options.length}`,
                        text: `Option ${item.options.length + 1}`,
                        image: ''
                      })
                      setFormItems(newItems)
                    }}
                  >
                    ➕ Add Choice Option
                  </button>
                </div>
              ) : (
                <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Correct Answer (Leave blank for manual grading by teacher):
                  </label>
                  {item.questionType === 'paragraph' ? (
                    <textarea
                      rows={2}
                      placeholder="Correct answer text..."
                      value={item.correctAnswer || ''}
                      onChange={e => {
                        const newItems = [...formItems]
                        newItems[idx].correctAnswer = e.target.value
                        setFormItems(newItems)
                      }}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', resize: 'vertical' }}
                    />
                  ) : isMultiLineRequired(qLevel, qDay) ? (
                    <textarea
                      rows={2}
                      placeholder="Correct answer value..."
                      value={item.correctAnswer || ''}
                      onChange={e => {
                        const newItems = [...formItems]
                        newItems[idx].correctAnswer = e.target.value
                        setFormItems(newItems)
                      }}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', resize: 'vertical' }}
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="Correct answer value..."
                      value={item.correctAnswer || ''}
                      onChange={e => {
                        const newItems = [...formItems]
                        newItems[idx].correctAnswer = e.target.value
                        setFormItems(newItems)
                      }}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Creator floating/bottom menu card */}
      <div className="card" style={{
        padding: '1.25rem',
        marginBottom: '2rem',
        borderRadius: '8px',
        background: 'var(--bg-card)',
        border: '1px solid rgba(103, 58, 183, 0.3)',
        display: 'flex',
        gap: '0.75rem',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <button type="button" className="btn btn-primary btn-sm" style={{ background: '#673ab7' }} onClick={() => addFormItem('question', 'short_answer')}>➕ Add Text Question</button>
        <button type="button" className="btn btn-primary btn-sm" style={{ background: '#512da8' }} onClick={() => addFormItem('question', 'multiple_choice')}>➕ Add Choice Question</button>
        <button type="button" className="btn btn-primary btn-sm" style={{ background: '#00b4d8' }} onClick={() => addFormItem('image_only')}>➕ Add Image Block</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => addFormItem('section_header')}>🔖 Add Section Break</button>
        <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <span>📁 Import Excel</span>
          <input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleExcelImport} />
        </label>
      </div>

      {/* Action Save button */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginBottom: '4rem' }}>
        {editQId && (
          <button type="button" className="btn btn-ghost" onClick={() => {
            setEditQId(null)
            setQFormatExample('')
            setFormTitle(`Daily Challenge - Day ${qDay}`)
            setFormDescription('')
            setFormItems([])
          }}>Clear / Reset</button>
        )}
        
        <button
          type="button"
          className="btn btn-admin"
          style={{ minWidth: '150px', background: '#673ab7', borderColor: '#512da8', color: '#fff' }}
          disabled={qSaving}
          onClick={(e) => {
            e.preventDefault()
            if (!qLevel || !qDay || !qSection) {
              return toast.error('Please select level, day and section first.')
            }

            const formPayload = {
              title: formTitle,
              description: formDescription,
              items: formItems
            }

            const questionStr = JSON.stringify(formPayload)

            const answersList = []
            formItems.forEach(item => {
              if (item.type === 'question') {
                if (item.questionType === 'checkbox') {
                  answersList.push(JSON.stringify(item.correctAnswer || []))
                } else {
                  answersList.push(String(item.correctAnswer || ''))
                }
              }
            })

            const answerStr = JSON.stringify(answersList)

            setQSaving(true)
            adminApi.post('/admin/teacher-questions', {
              id: editQId,
              level: qLevel,
              day_number: parseInt(qDay, 10),
              section: qSection,
              question: questionStr,
              answer: answerStr,
              format_example: qFormatExample
            })
              .then((res) => {
                toast.success('Form saved successfully!')
                if (res.data && res.data.id) {
                  setEditQId(res.data.id)
                }
                loadQuestions()
              })
              .catch(() => toast.error('Failed to save form.'))
              .finally(() => setQSaving(false))
          }}
        >
          {qSaving ? <><div className="spinner spinner-sm" /> Saving...</> : '💾 Save Google Form'}
        </button>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────────
   PERFORMANCE TAB
────────────────────────────────────────────────────────────────────────────── */
function PerformanceTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.get('/admin/performance').then(r => { setData(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
  if (!data) return null

  return (
    <div className="animate-slide-up">
      <h1 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>Performance Analytics</h1>

      {/* XP Leaderboard */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>⚡ All-Time XP Leaderboard (Top 20)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Rank</th><th>Name</th><th>Level</th><th>XP</th><th>Streak</th></tr></thead>
            <tbody>
              {(data.xpLeaderboard || []).map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <span style={{ fontWeight: 700, color: i === 0 ? 'var(--accent-gold)' : i === 1 ? '#b0bec5' : i === 2 ? '#cd7f32' : 'var(--text-muted)' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td><span className="badge badge-info">{LEVEL_LABELS[s.level] || s.level}</span></td>
                  <td><span style={{ color: 'var(--accent-gold)' }}>⚡ {s.xp_total}</span></td>
                  <td><span style={{ color: 'var(--warning)' }}>🔥 {s.streak}</span></td>
                </tr>
              ))}
              {(!data.xpLeaderboard?.length) && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No data yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Level comparison */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Level-by-Level Comparison</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Level</th><th>Avg Accuracy</th><th>Avg Time (s)</th></tr></thead>
            <tbody>
              {(data.levelComparison || []).map(row => (
                <tr key={row.level}>
                  <td><span className="badge badge-info">{LEVEL_LABELS[row.level] || row.level}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, maxWidth: 120 }}>
                        <div style={{ height: '100%', width: `${Math.min(100, row.avg_accuracy || 0)}%`, background: 'linear-gradient(90deg, var(--primary), var(--accent-teal))', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontWeight: 600 }}>{parseFloat(row.avg_accuracy || 0).toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{parseFloat(row.avg_time || 0).toFixed(0)}s</td>
                </tr>
              ))}
              {(!data.levelComparison?.length) && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No performance data yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────────
   ACTIVITY LOG TAB
────────────────────────────────────────────────────────────────────────────── */
function ActivityLogTab() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.get('/admin/activity-log').then(r => { setLogs(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="animate-slide-up">
      <h1 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>Activity Log</h1>
      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div> : (
        <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <table className="data-table">
            <thead><tr><th>Teacher</th><th>Action</th><th>Level</th><th>Day</th><th>Section</th><th>Timestamp</th></tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 500 }}>{l.teacher_name || '—'}</td>
                  <td><span className="badge badge-primary">{l.action.replace(/_/g, ' ')}</span></td>
                  <td>{l.level || '—'}</td>
                  <td>{l.day_number || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{l.section || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(l.timestamp).toLocaleString()}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No activity logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────────
   LOGIN LOGS TAB
────────────────────────────────────────────────────────────────────────────── */
function LoginLogsTab() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [userType, setUserType] = useState('all')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.get(`/admin/login-logs?userType=${userType}`)
      setLogs(res.data.logs || [])
    } catch {
      toast.error('Could not load login logs.')
    } finally {
      setLoading(false)
    }
  }, [userType])

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 30000) // Auto-refresh every 30s
    return () => clearInterval(interval)
  }, [fetchLogs])

  return (
    <div className="animate-slide-up">
      <h1 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>Login & Activity Logs</h1>
      
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <select value={userType} onChange={e => setUserType(e.target.value)} style={{ width: 160 }}>
          <option value="all">All Users</option>
          <option value="student">Students</option>
          <option value="teacher">Teachers</option>
          <option value="admin">Admins</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={fetchLogs}>🔄 Refresh</button>
      </div>

      {loading && logs.length === 0 ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div> : (
        <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <table className="data-table">
            <thead><tr><th>Time</th><th>User Type</th><th>User</th><th>Action</th><th>IP Address</th><th>Details</th></tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(l.created_at).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${
                      l.user_type === 'admin' ? 'badge-warning' : 
                      l.user_type === 'teacher' ? 'badge-primary' : 'badge-info'
                    }`}>{l.user_type}</span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{l.user_label || 'Unknown'}</td>
                  <td>
                    <span className={`badge ${
                      l.action.includes('success') ? 'badge-success' : 
                      l.action.includes('fail') ? 'badge-error' : 'badge-muted'
                    }`}>{l.action.replace(/_/g, ' ')}</span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{l.ip_address || '—'}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={JSON.stringify(l.metadata)}>
                    {l.metadata ? JSON.stringify(l.metadata) : '—'}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No logs found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────────
   MAIN ADMIN DASHBOARD
────────────────────────────────────────────────────────────────────────────── */
export default function AdminDashboard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    const token = localStorage.getItem('abacus_admin_token')
    if (!token) navigate('/admin')
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('abacus_admin_token')
    navigate('/admin')
  }

  const NAV = [
    { id: 'overview',  icon: '📊', label: 'Dashboard' },
    { id: 'students',  icon: '👥', label: 'Students' },
    { id: 'answers',   icon: '🎯', label: 'Student Answers' },
    { id: 'teachers',  icon: '👨‍🏫', label: 'Teachers' },
    { id: 'builder',   icon: '📝', label: 'Question Builder' },
    { id: 'qbank',     icon: '📚', label: 'Question Bank (Legacy)' },
    { id: 'perf',      icon: '📈', label: 'Performance' },
    { id: 'actlog',    icon: '📝', label: 'Teacher Edits' },
    { id: 'loginlog',  icon: '📋', label: 'Global Logs' },
  ]

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar__logo">
          <h2>🧮 Admin Portal</h2>
          <p>100 Days of Abacus</p>
        </div>
        {NAV.map(n => (
          <button key={n.id}
            className={`admin-nav-item ${tab === n.id ? 'active' : ''}`}
            onClick={() => setTab(n.id)}
          >
            <span>{n.icon}</span> {n.label}
          </button>
        ))}
        <div style={{ position: 'absolute', bottom: '1.5rem', width: '100%', padding: '0 1rem' }}>
          <button className="btn btn-ghost btn-sm btn-block" onClick={handleLogout}>Sign Out</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        { tab === 'overview'  && <OverviewTab /> }
        { tab === 'students'  && <StudentsTab /> }
        { tab === 'answers'   && <StudentAnswersTab apiInstance={adminApi} isTeacherPortal={false} /> }
        { tab === 'teachers'  && <TeachersTab /> }
        { tab === 'builder'   && <CustomFormsTab /> }
        { tab === 'qbank'     && <QuestionBankTab /> }
        { tab === 'perf'      && <PerformanceTab /> }
        { tab === 'actlog'    && <ActivityLogTab /> }
        { tab === 'loginlog'  && <LoginLogsTab /> }
      </main>
    </div>
  )
}
