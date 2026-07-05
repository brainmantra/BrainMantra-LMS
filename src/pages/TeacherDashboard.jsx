import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { teacherApi } from '../utils/api'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const LEVELS = ['l1','l2','l3','l4','l5','l6','l7','l8']
const LEVEL_LABELS = { l1:'Level 1',l2:'Level 2',l3:'Level 3',l4:'Level 4',l5:'Level 5',l6:'Level 6',l7:'Level 7',l8:'Level 8' }
const FIFTH_DAYS = Array.from({length: 20}, (_, i) => (i+1)*5)

function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__value" style={{ color: color || 'var(--primary-light)' }}>{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  )
}

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const [teacher, setTeacher] = useState(null)
  const [tab, setTab] = useState('levels')
  const [levels, setLevels] = useState([])
  const [students, setStudents] = useState([])
  const [activity, setActivity] = useState([])
  const [fifthDays, setFifthDays] = useState([])
  const [loading, setLoading] = useState(true)

  // Question Editor state
  const [qLevel, setQLevel] = useState('')
  const [qDay, setQDay] = useState('')
  const [qSection, setQSection] = useState('teacher_day')
  const [qBlocks, setQBlocks] = useState([])
  const [editQId, setEditQId] = useState(null)
  const [qSaving, setQSaving] = useState(false)
  const [savedQuestions, setSavedQuestions] = useState([])
  const [loadingQ, setLoadingQ] = useState(false)

  // Detailed Student view state
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [selectedDays, setSelectedDays] = useState([])
  const [dayLoading, setDayLoading] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('abacus_teacher')
    if (!stored) { navigate('/teacher'); return }
    const t = JSON.parse(stored)
    setTeacher(t)
    if (t.assigned_levels?.length) setQLevel(t.assigned_levels[0])
    loadData()
  }, [navigate])

  const loadData = async () => {
    try {
      const [lvRes, stuRes, actRes, fifthRes] = await Promise.all([
        teacherApi.get('/teachers/levels'),
        teacherApi.get('/teachers/students'),
        teacherApi.get('/teachers/activity'),
        teacherApi.get('/teachers/fifth-days'),
      ])
      setLevels(lvRes.data)
      setStudents(stuRes.data)
      setActivity(actRes.data)
      setFifthDays(fifthRes.data)
    } catch (err) {
      if (err.response?.status === 401) { navigate('/teacher'); return }
      toast.error('Could not load data.')
    } finally {
      setLoading(false)
    }
  }

  const loadQuestions = async () => {
    if (!qLevel) return
    setLoadingQ(true)
    try {
      const params = new URLSearchParams({ level: qLevel })
      if (qDay) params.append('day_number', qDay)
      const res = await teacherApi.get(`/teachers/questions?${params}`)
      setSavedQuestions(res.data)
    } catch {
      toast.error('Could not fetch questions.')
    } finally {
      setLoadingQ(false)
    }
  }

  useEffect(() => {
    if (tab === 'editor') loadQuestions()
  }, [tab, qLevel, qDay])



  const handleLogout = () => {
    localStorage.removeItem('abacus_teacher_token')
    localStorage.removeItem('abacus_teacher')
    navigate('/teacher')
  }

  const openStudent = async (s) => {
    setSelectedStudent(s)
    setDayLoading(true)
    try {
      const res = await teacherApi.get(`/teachers/students/${s.id}`)
      setSelectedDays(res.data.days || [])
    } catch {
      toast.error('Could not load student history.')
    } finally {
      setDayLoading(false)
    }
  }

  const getStatusIcon = (days, idx) => {
    const d = days.find(d => d.day_number === idx + 1)
    if (!d) return { icon: '○', cls: 'day-card--locked', title: 'Locked' }
    if (d.completed) return { icon: '✓', cls: 'day-card--completed', title: `Done — ${d.accuracy}% accuracy` }
    if (d.opened) return { icon: '⏳', cls: 'day-card--progress', title: 'Opened, not completed' }
    return { icon: '○', cls: '', title: 'Not started' }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>

  const NAV = [
    { id: 'levels',   icon: '🎓', label: 'My Levels' },
    { id: 'editor',   icon: '✏',  label: 'Question Editor' },
    { id: 'students', icon: '👥',  label: 'Student Progress' },
    { id: 'activity', icon: '📋',  label: 'My Activity' },
  ]

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar__logo">
          <h2 style={{ color: 'var(--teacher-primary)' }}>👨‍🏫 Teacher Portal</h2>
          <p>{teacher?.name}</p>
          <p style={{ fontSize: '0.7rem', marginTop: 2 }}>{teacher?.assigned_levels?.map(l => LEVEL_LABELS[l]).join(', ')}</p>
        </div>
        {NAV.map(n => (
          <button key={n.id}
            className={`admin-nav-item teacher-nav-item ${tab === n.id ? 'active' : ''}`}
            onClick={() => setTab(n.id)}
          >
            <span>{n.icon}</span> {n.label}
          </button>
        ))}
        <div style={{ position: 'absolute', bottom: '1.5rem', width: '100%', padding: '0 1rem' }}>
          <button className="btn btn-ghost btn-sm btn-block" onClick={handleLogout}>Sign Out</button>
        </div>
      </aside>

      {/* Main */}
      <main className="admin-main">

        {/* MY LEVELS */}
        {tab === 'levels' && (
          <div className="animate-slide-up">
            <h1 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>My Levels</h1>

            {/* Pending 5th-day alerts */}
            {levels.some(l => l.pendingFifthDays?.length > 0) && (
              <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
                <span>⚠️</span>
                <div>
                  <strong>Pending 5th-day questions:</strong>{' '}
                  {levels.flatMap(l =>
                    (l.pendingFifthDays || []).map(d => `${LEVEL_LABELS[l.level]} Day ${d}`)
                  ).join(', ')}
                  <br />
                  <span style={{ fontSize: '0.85rem' }}>Submit before midnight on each day.</span>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
              {levels.map(l => (
                <div key={l.level} className="card" style={{ borderColor: 'rgba(0,180,216,0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ color: 'var(--teacher-primary)' }}>{LEVEL_LABELS[l.level]}</h3>
                    <span className="badge badge-info">{l.studentCount} students</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="report-metric" style={{ flex: 1 }}>
                      <div className="report-metric__val" style={{ fontSize: '1.5rem', color: 'var(--teacher-primary)' }}>{l.activeToday}</div>
                      <div className="report-metric__label">Active today</div>
                    </div>
                    <div className="report-metric" style={{ flex: 1 }}>
                      <div className="report-metric__val" style={{ fontSize: '1.5rem', color: 'var(--warning)' }}>{l.pendingFifthDays?.length ?? 0}</div>
                      <div className="report-metric__label">Pending 5th days</div>
                    </div>
                  </div>
                  {(l.pendingFifthDays?.length > 0) && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--warning)' }}>
                      ⚠ Days needing questions: {l.pendingFifthDays.join(', ')}
                    </div>
                  )}
                  <button
                    className="btn btn-sm btn-block"
                    style={{ marginTop: '1rem', background: 'rgba(0,180,216,0.15)', color: 'var(--teacher-primary)', border: '1px solid rgba(0,180,216,0.3)' }}
                    onClick={() => { setQLevel(l.level); setTab('editor') }}
                  >
                    Open Question Editor →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QUESTION EDITOR */}
        {tab === 'editor' && (
          <div className="animate-slide-up">
            <h1 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>Question Editor</h1>

            {/* Filter row */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Level</label>
                  <select value={qLevel} onChange={e => setQLevel(e.target.value)}>
                    <option value="">Select level</option>
                    {(teacher?.assigned_levels || []).map(l => (
                      <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Day Number</label>
                  <input type="number" min="1" max="100" value={qDay} onChange={e => setQDay(e.target.value)} placeholder="e.g. 5" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Section</label>
                  <select value={qSection} onChange={e => setQSection(e.target.value)}>
                    <option value="teacher_day">🌟 Teacher Day (5th-day)</option>
                    <option value="teacher_input">👨‍🏫 Teacher Input</option>
                    <option value="tables">📋 Tables</option>
                    <option value="form_the_question">✏ Form The Question</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 5th-day guidance */}
            {qSection === 'teacher_day' && (
              <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
                <span>📅</span>
                <div>
                  <strong>Every-5th-day questions:</strong> Days 5, 10, 15, 20… 100 need a question submitted before midnight.
                  {fifthDays.filter(f => f.level === qLevel).length > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                      Status for {LEVEL_LABELS[qLevel]}:{' '}
                      {fifthDays.filter(f => f.level === qLevel).map(f => (
                        <span key={f.day_number} style={{ marginRight: '0.5rem', color: f.submitted ? 'var(--success)' : 'var(--warning)' }}>
                          Day {f.day_number}: {f.submitted ? '✓' : '⏳'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Question form */}
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Add / Update Question</h3>
              <form onSubmit={(e) => {
                e.preventDefault()
                // Convert blocks to legacy fields before submit
                const questionStr = JSON.stringify(qBlocks)
                const answers = qBlocks.filter(b => b.type === 'box').map(b => b.answer || '')
                const answerStr = JSON.stringify(answers)
                
                if (!qLevel || !qDay || !qBlocks.length) return toast.error('All fields required.')
                if (answers.length === 0 && qSection === 'teacher') return toast.error('Teacher questions require at least one Answer Box.')
                
                setQSaving(true)
                axios.post('/api/teacher-questions', {
                  id: editQId, level: qLevel, day_number: parseInt(qDay), section: qSection,
                  question: questionStr, answer: answerStr,
                })
                  .then(() => {
                    toast.success('Question saved!')
                    setQBlocks([])
                    setEditQId(null)
                    fetchQuestions()
                  })
                  .catch(() => toast.error('Failed to save.'))
                  .finally(() => setQSaving(false))
              }}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ marginBottom: '0.5rem' }}>Question Builder</label>
                  
                  {qBlocks.map((block, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem',
                      padding: '0.75rem', background: 'var(--surface-color)', borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 4px' }} disabled={idx === 0} onClick={() => {
                          const newBlocks = [...qBlocks];
                          [newBlocks[idx - 1], newBlocks[idx]] = [newBlocks[idx], newBlocks[idx - 1]];
                          setQBlocks(newBlocks);
                        }}>▲</button>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 4px' }} disabled={idx === qBlocks.length - 1} onClick={() => {
                          const newBlocks = [...qBlocks];
                          [newBlocks[idx + 1], newBlocks[idx]] = [newBlocks[idx], newBlocks[idx + 1]];
                          setQBlocks(newBlocks);
                        }}>▼</button>
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>{block.type}</div>
                        {block.type === 'box' ? (
                          <input 
                            type="text" placeholder="Correct Answer..." 
                            value={block.answer || ''} 
                            onChange={e => {
                              const newB = [...qBlocks]; newB[idx].answer = e.target.value; setQBlocks(newB);
                            }} 
                          />
                        ) : (
                          <textarea 
                            rows={2} placeholder={`Enter ${block.type} text...`}
                            style={{ resize: 'vertical', minHeight: '60px' }}
                            value={block.content || ''} 
                            onChange={e => {
                              const newB = [...qBlocks]; newB[idx].content = e.target.value; setQBlocks(newB);
                            }} 
                          />
                        )}
                      </div>
                      
                      <button type="button" className="btn btn-ghost" style={{ color: '#ef4444', padding: '0.5rem' }} onClick={() => {
                        setQBlocks(qBlocks.filter((_, i) => i !== idx));
                      }}>✕</button>
                    </div>
                  ))}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQBlocks([...qBlocks, { type: 'instruction', content: '' }])}>+ Instruction</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQBlocks([...qBlocks, { type: 'text', content: '' }])}>+ Text</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQBlocks([...qBlocks, { type: 'example', content: '' }])}>+ Example</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setQBlocks([...qBlocks, { type: 'box', answer: '' }])}>+ Answer Box</button>
                  </div>
                </div>

                <button type="submit" className="btn btn-teacher" disabled={qSaving}>
                  {qSaving ? <><div className="spinner spinner-sm" /> Saving...</> : '💾 Save Question'}
                </button>
                {editQId && (
                  <button type="button" className="btn btn-ghost" style={{ marginLeft: '0.5rem' }} onClick={() => {
                    setEditQId(null); setQBlocks([]);
                  }}>Cancel Edit</button>
                )}
              </form>
            
            {/* List */}
            <div className="card animate-fade-in" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Existing Questions</h3>
              {loadingQs ? <div className="spinner" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {questions.map(q => (
                    <div key={q.id} style={{
                      padding: '1rem', background: 'var(--surface-color)', borderRadius: '8px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                          Level {q.level} - Day {q.day_number} ({q.section})
                        </div>
                        <div style={{ fontWeight: 500 }}>
                          {(() => {
                            try {
                              const parsed = JSON.parse(q.question);
                              return Array.isArray(parsed) ? parsed.map(b => b.type === 'box' ? '[BOX]' : b.content).join(' ') : q.question;
                            } catch {
                              return q.question;
                            }
                          })()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          setEditQId(q.id); setQLevel(q.level); setQDay(String(q.day_number)); setQSection(q.section);
                          try {
                            const parsed = JSON.parse(q.question);
                            if (Array.isArray(parsed)) {
                              setQBlocks(parsed);
                            } else throw new Error();
                          } catch {
                            // Legacy parsing
                            let b = [{ type: 'text', content: q.question }];
                            if (q.answer) {
                              try {
                                const parsedAns = JSON.parse(q.answer);
                                if (Array.isArray(parsedAns)) {
                                  parsedAns.forEach(a => b.push({ type: 'box', answer: a }));
                                } else throw new Error();
                              } catch {
                                b.push({ type: 'box', answer: q.answer });
                              }
                            }
                            setQBlocks(b);
                          }
                        }}>Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved questions */}
            <div>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                Saved Questions {qLevel && `(${LEVEL_LABELS[qLevel]})`}
              </h3>
              {loadingQ ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <div className="spinner" />
                </div>
              ) : savedQuestions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  No saved questions yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {savedQuestions.map(q => (
                    <div key={q.id} className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                          <span className="badge badge-info">Day {q.day_number}</span>
                          <span className="badge badge-muted">{q.section}</span>
                        </div>
                        <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                          {(() => {
                            try {
                              const parsed = JSON.parse(q.question);
                              return Array.isArray(parsed) ? parsed.map(b => b.type === 'box' ? '[BOX]' : b.content).join(' ') : q.question;
                            } catch {
                              return q.question;
                            }
                          })()}
                        </p>
                        <p style={{ color: 'var(--success)', fontSize: '0.85rem' }}>
                          Answer: {(() => {
                            try {
                              const parsed = JSON.parse(q.answer);
                              return Array.isArray(parsed) ? parsed.join(', ') : q.answer;
                            } catch {
                              return q.answer;
                            }
                          })()}
                        </p>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditQId(q.id); setQLevel(q.level); setQDay(String(q.day_number)); setQSection(q.section);
                          try {
                            const parsed = JSON.parse(q.question);
                            if (Array.isArray(parsed)) {
                              setQBlocks(parsed);
                            } else throw new Error();
                          } catch {
                            // Legacy parsing
                            let b = [{ type: 'text', content: q.question }];
                            if (q.answer) {
                              try {
                                const parsedAns = JSON.parse(q.answer);
                                if (Array.isArray(parsedAns)) {
                                  parsedAns.forEach(a => b.push({ type: 'box', answer: a }));
                                } else throw new Error();
                              } catch {
                                b.push({ type: 'box', answer: q.answer });
                              }
                            }
                            setQBlocks(b);
                          }
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STUDENT PROGRESS */}
        {tab === 'students' && selectedStudent && (
          <div className="animate-slide-up">
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: '1.5rem' }} onClick={() => setSelectedStudent(null)}>
              ← Back to All Students
            </button>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                {selectedStudent.name[0]}
              </div>
              <div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '0.2rem' }}>{selectedStudent.name}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {selectedStudent.mobile} · {LEVEL_LABELS[selectedStudent.level] || selectedStudent.level} · 
                  🔥 {selectedStudent.streak} streak · ⚡ {selectedStudent.xp_total} XP
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
                  <StatCard icon="⚡" label="Total XP" value={selectedStudent.xp_total} color="var(--accent-gold)" />
                  <StatCard icon="🔥" label="Best Streak" value={selectedStudent.streak} color="var(--warning)" />
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
        )}

        {tab === 'students' && !selectedStudent && (
          <div className="animate-slide-up">
            <h1 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>Student Progress</h1>
            <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Level</th><th>Consistency</th><th>Streak</th><th>XP</th><th>Last Active</th><th></th></tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><span className="badge badge-info">{LEVEL_LABELS[s.level] || s.level}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }} title={`${s.days_completed || 0}/100 Days Completed`}>
                          {Array.from({ length: 25 }).map((_, i) => {
                            // Display 25 blocks representing 4 days each (total 100 days)
                            const blockStart = i * 4 + 1
                            const blockEnd = i * 4 + 4
                            let completedInBlock = 0
                            if (s.completed_days) {
                              completedInBlock = s.completed_days.filter(d => d >= blockStart && d <= blockEnd).length
                            }
                            // Color intensity based on completion in this block
                            const opacity = completedInBlock === 0 ? 0.1 : (completedInBlock / 4)
                            return (
                              <div key={i} style={{ 
                                width: '8px', 
                                height: '14px', 
                                background: completedInBlock > 0 ? 'var(--success)' : 'var(--text-muted)',
                                opacity: completedInBlock > 0 ? Math.max(0.3, opacity) : 0.1,
                                borderRadius: '1px' 
                              }} />
                            )
                          })}
                          <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {s.days_completed || 0}%
                          </span>
                        </div>
                      </td>
                      <td><span style={{ color: 'var(--warning)' }}>🔥 {s.streak}</span></td>
                      <td><span style={{ color: 'var(--accent-gold)' }}>⚡ {s.xp_total}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {s.last_active ? new Date(s.last_active).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => openStudent(s)}>View →</button>
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No students yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MY ACTIVITY */}
        {tab === 'activity' && (
          <div className="animate-slide-up">
            <h1 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>My Activity</h1>
            <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <table className="data-table">
                <thead>
                  <tr><th>Action</th><th>Level</th><th>Day</th><th>Section</th><th>Timestamp</th></tr>
                </thead>
                <tbody>
                  {activity.map(a => (
                    <tr key={a.id}>
                      <td><span className="badge badge-primary">{a.action.replace(/_/g, ' ')}</span></td>
                      <td>{a.level || '—'}</td>
                      <td>{a.day_number || '—'}</td>
                      <td>{a.section || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {new Date(a.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {activity.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No activity yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
