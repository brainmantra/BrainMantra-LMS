import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../utils/api'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'
import StudentAnswersTab from '../components/StudentAnswersTab'


const LEVELS = ['l1','l2','l3','l4','l5','l6','l7','l8','alumni']
const LEVEL_LABELS = { l1:'Level 1',l2:'Level 2',l3:'Level 3',l4:'Level 4',l5:'Level 5',l6:'Level 6',l7:'Level 7',l8:'Level 8', alumni:'Alumni' }

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
      <h1 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>Dashboard Overview</h1>

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
    try {
      const res = await adminApi.get(`/admin/students/${s.id}`)
      setSelectedDays(res.data.days || [])
    } catch { toast.error('Could not load student history.') }
    finally { setDayLoading(false) }
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
          </div>
        </div>

        {dayLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
        ) : (
          <div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>100-Day Grid</h3>
            <div className="day-grid" style={{ marginBottom: '1.5rem' }}>
              {Array.from({ length: 100 }, (_, i) => {
                const { icon, cls, title } = getStatusIcon(selectedDays, i)
                return (
                  <div key={i} className={`day-card ${cls}`} title={title} style={{ cursor: 'default' }}>
                    <span className="day-card__num">{i + 1}</span>
                    <span className="day-card__emoji" style={{ fontSize: '0.75rem' }}>{icon}</span>
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
      </div>
    )
  }

  return (
    <div className="animate-slide-up">
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.6rem', flex: 1 }}>Students</h1>
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
            <thead><tr><th>Name</th><th>Mobile</th><th>Level</th><th>Streak</th><th>XP</th><th>Days Done</th><th>Last Active</th><th></th></tr></thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{s.mobile}</td>
                  <td><span className="badge badge-info">{LEVEL_LABELS[s.level] || s.level}</span></td>
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

/* ──────────────────────────────────────────────────────────────────────────────
   QUESTION BUILDER TAB
────────────────────────────────────────────────────────────────────────────── */
function QuestionBuilderTab() {
  const [level, setLevel] = useState('l1')
  const [day, setDay] = useState(1)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.get(`/admin/questions/${level}/${day}`)
      setQuestions(res.data)
    } catch (err) {
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }, [level, day])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  const handleFileUpload = (e) => {
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
        
        // Map columns to questions
        const newQs = data.map((row, idx) => ({
          id: 'temp_' + Date.now() + idx,
          question_text: row.Question || row.question || '',
          expected_answer: row.Answer || row.answer || '',
          format_example: row['Format Example'] || row.format_example || '',
          question_type: row.Type || row.type || 'math',
        })).filter(q => q.question_text)

        setQuestions(prev => [...prev, ...newQs])
        toast.success(`Imported ${newQs.length} questions! Click Save to apply.`)
      } catch (err) {
        toast.error('Failed to parse Excel file')
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminApi.put(`/admin/questions/${level}/${day}`, { questions })
      toast.success('Questions saved successfully!')
      fetchQuestions()
    } catch (err) {
      toast.error('Failed to save questions')
    } finally {
      setSaving(false)
    }
  }

  const updateQuestion = (id, field, value) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q))
  }

  const deleteQuestion = (id) => {
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  const addQuestion = () => {
    const newQ = { id: 'temp_' + Date.now(), question_text: '', expected_answer: '', format_example: '', question_type: 'math' }
    setQuestions([...questions, newQ])
    setEditingId(newQ.id)
  }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 800, margin: '0 auto', paddingBottom: '3rem' }}>
      <h1 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>Question Builder</h1>
      
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <label className="form-label" style={{ marginBottom: '0.3rem', display: 'block' }}>Level</label>
          <select value={level} onChange={e => setLevel(e.target.value)} style={{ width: 150 }}>
            {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label" style={{ marginBottom: '0.3rem', display: 'block' }}>Day</label>
          <input type="number" min="1" max="100" value={day} onChange={e => setDay(e.target.value)} style={{ width: 100 }} />
        </div>
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <label className="btn btn-ghost" style={{ cursor: 'pointer', margin: 0, marginTop: 'auto' }}>
            <span>📁 Import Excel</span>
            <input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>
          <button className="btn btn-admin" style={{ marginTop: 'auto' }} onClick={handleSave} disabled={saving}>
            {saving ? <div className="spinner spinner-sm" /> : '💾 Save Changes'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {questions.map((q, idx) => {
            const isEditing = editingId === q.id
            return (
              <div 
                key={q.id} 
                className="card" 
                style={{ 
                  padding: '1.5rem', 
                  borderLeft: isEditing ? '4px solid var(--primary)' : '4px solid transparent',
                  cursor: isEditing ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: isEditing ? 'var(--bg-elevated)' : 'var(--bg-card)',
                  boxShadow: isEditing ? '0 8px 24px rgba(0,0,0,0.1)' : 'none'
                }}
                onClick={() => !isEditing && setEditingId(q.id)}
              >
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <textarea 
                          placeholder="Question Title" 
                          style={{ fontSize: '1.1rem', fontWeight: 500, width: '100%', padding: '0.8rem', borderBottom: '1px solid var(--border)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', background: 'transparent', color: 'var(--text-main)', outline: 'none', minHeight: '60px', resize: 'vertical' }}
                          value={q.question_text}
                          onChange={e => updateQuestion(q.id, 'question_text', e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div>
                        <select value={q.question_type} onChange={e => updateQuestion(q.id, 'question_type', e.target.value)} style={{ padding: '0.6rem', borderRadius: '4px' }}>
                          <option value="math">Short Answer (Math)</option>
                          <option value="steps">Steps (String Matching)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <input 
                        type="text" 
                        placeholder="Expected Answer" 
                        style={{ width: '100%', padding: '0.6rem', borderBottom: '1px solid var(--border)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', background: 'transparent', color: 'var(--text-main)', outline: 'none' }}
                        value={q.expected_answer}
                        onChange={e => updateQuestion(q.id, 'expected_answer', e.target.value)}
                      />
                    </div>

                    <div>
                      <input 
                        type="text" 
                        placeholder="Format Example (Optional - e.g. '1st row = 2')" 
                        style={{ width: '100%', padding: '0.6rem', borderBottom: '1px dotted var(--border)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', background: 'transparent', color: 'var(--text-muted)', outline: 'none', fontSize: '0.9rem' }}
                        value={q.format_example || ''}
                        onChange={e => updateQuestion(q.id, 'format_example', e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id) }} style={{ color: 'var(--error)' }}>
                        🗑️ Delete
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); setEditingId(null) }}>
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 500, fontSize: '1.1rem', marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>
                        {idx + 1}. {q.question_text || 'Untitled Question'}
                      </div>
                      <span className="badge badge-muted">{q.question_type}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                      Answer: <span style={{ color: 'var(--success)', fontWeight: 600 }}>{q.expected_answer}</span>
                    </div>
                    {q.format_example && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                        Format: {q.format_example}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          
          <button 
            className="btn btn-ghost" 
            style={{ width: '100%', padding: '1rem', border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)' }}
            onClick={addQuestion}
          >
            + Add Question
          </button>
          
          {questions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No questions found for Level {level} Day {day}. Add one or import an Excel file.
            </div>
          )}
        </div>
      )}
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
        { tab === 'builder'   && <QuestionBuilderTab /> }
        { tab === 'qbank'     && <QuestionBankTab /> }
        { tab === 'perf'      && <PerformanceTab /> }
        { tab === 'actlog'    && <ActivityLogTab /> }
        { tab === 'loginlog'  && <LoginLogsTab /> }
      </main>
    </div>
  )
}
