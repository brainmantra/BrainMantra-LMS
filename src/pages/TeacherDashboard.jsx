import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { teacherApi } from '../utils/api'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
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
  gm: 'GM Level'
}
const FIFTH_DAYS = Array.from({length: 20}, (_, i) => (i+1)*5)

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
  const [qBlocks, setQBlocks] = useState([{ type: 'text', content: '' }, { type: 'box', answer: '' }])
  const [qFormatExample, setQFormatExample] = useState('')
  const [editQId, setEditQId] = useState(null)
  const [qSaving, setQSaving] = useState(false)

  // Form Builder state (Google Forms Clone)
  const [formTitle, setFormTitle] = useState('Abacus Daily Challenge')
  const [formDescription, setFormDescription] = useState('Solve all questions step by step.')
  const [formItems, setFormItems] = useState([])

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
    { id: 'answers',  icon: '🎯', label: 'Student Answers' },
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
                  <input type="number" min="0" max="100" value={qDay} onChange={e => setQDay(e.target.value)} placeholder="e.g. 5" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Section</label>
                  <select value={qSection} onChange={e => setQSection(e.target.value)}>
                    {getTeacherSectionsForLevel(qLevel, qDay).map(sec => (
                      <option key={sec.value} value={sec.value}>{sec.label}</option>
                    ))}
                    {getTeacherSectionsForLevel(qLevel, qDay).length === 0 && (
                      <option value="">No teacher sections (Auto-generated)</option>
                    )}
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
            {/* Google Forms Clone Designer */}
            <div style={{ maxWidth: '780px', margin: '0 auto', fontFamily: 'var(--font-sans)' }}>
              

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
                  className="btn btn-teacher"
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

                    // Extract all correct answers to save in legacy answer field
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
                    teacherApi.post('/teachers/questions', {
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
            
            {/* List */}
            <div className="card animate-fade-in" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Existing Questions</h3>
              {loadingQ ? <div className="spinner" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {savedQuestions.map(q => (
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
                          setQFormatExample(q.format_example || '');
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
                          setQFormatExample(q.format_example || '');
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
        {tab === 'answers' && (
          <StudentAnswersTab apiInstance={teacherApi} isTeacherPortal={true} />
        )}
      </main>
    </div>
  )
}
