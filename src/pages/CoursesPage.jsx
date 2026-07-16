import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StudentLayout from '../components/StudentLayout'
import { useState, useEffect, useMemo } from 'react'
import api from '../utils/api'
import { getChallengeDay } from '../utils/dateUtils'
import DayCard from '../components/DayCard'
import toast from 'react-hot-toast'

// Helper component for winding map
function WindingLevelMap({ days, currentDay, student, dayMap, onBack, defaultDayNum, validSections }) {
  const allDays = [0, ...Array.from({ length: 100 }, (_, i) => i + 1)]
  const [selectedDayNum, setSelectedDayNum] = useState(defaultDayNum ?? null)

  // Chunk array of days into rows of 5
  const itemsPerRow = 5
  const rows = []
  for (let i = 0; i < allDays.length; i += itemsPerRow) {
    const chunk = allDays.slice(i, i + itemsPerRow)
    const rowIndex = Math.floor(i / itemsPerRow)
    const isReverse = rowIndex % 2 === 1
    rows.push({
      rowIndex,
      items: chunk,
      isReverse
    })
  }

  const getStatus = (dayNum) => {
    const record = dayMap[dayNum]
    if (record?.completed) return 'completed'
    if (record?.section_data) {
      try {
        const sd = typeof record.section_data === 'string' ? JSON.parse(record.section_data) : record.section_data;
        const secKeys = Object.keys(sd);
        // Assuming a minimum of 3 sections for a day to be considered fully attempted
        if (secKeys.length >= 1 && secKeys.every(k => sd[k].status === 'done')) {
          // For Demo Day, we can mark it as completed if they did the sections
          // For regular days, we still require 'completed' flag from full submit, but this handles edge cases
          if (dayNum === 0 || secKeys.length >= 3) return 'completed'
        }
      } catch (e) {}
    }
    
    if (record?.reset_at) {
      const resetTime = new Date(record.reset_at).getTime();
      const now = new Date().getTime();
      if (now - resetTime <= 24 * 60 * 60 * 1000) {
        return 'today'
      }
    }

    if (dayNum === 0) return 'demo'
    if (dayNum === currentDay) return 'today'
    if (record?.opened) return 'opened'
    if (dayNum < currentDay) return 'missed'
    return 'locked'
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '800px', margin: '0 auto', padding: '1rem 0' }}>
      
      {/* Header with back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
        <button 
          className="btn btn-ghost btn-sm" 
          onClick={onBack}
          style={{ fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          ← Back to Courses
        </button>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>100 Days of Abacus Map</h1>
      </div>

      {/* Scrollable Map Track Container */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '40px' }}>
        
        {rows.map(({ rowIndex, items, isReverse }, rIdx) => {
          const isLastRow = rIdx === rows.length - 1
          
          return (
            <div 
              key={rowIndex} 
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                position: 'relative',
                height: '110px',
                flexDirection: isReverse ? 'row-reverse' : 'row',
                zIndex: 2
              }}
            >
              {/* Horizontal connecting background line for this row */}
              {!isLastRow && (
                <div style={{
                  position: 'absolute',
                  left: '10%',
                  right: '10%',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  height: '4px',
                  backgroundImage: 'radial-gradient(circle, var(--primary) 2px, transparent 3px)',
                  backgroundSize: '16px 100%',
                  opacity: 0.35,
                  zIndex: 1
                }} />
              )}
              {/* If it is the last row (Row 20, containing only Day 100), no line needed */}
              {isLastRow && (
                <div style={{
                  position: 'absolute',
                  left: '10%',
                  width: '0%', 
                  top: '50%',
                  transform: 'translateY(-50%)',
                  height: '4px',
                  backgroundImage: 'radial-gradient(circle, var(--primary) 2px, transparent 3px)',
                  backgroundSize: '16px 100%',
                  opacity: 0.35,
                  zIndex: 1
                }} />
              )}

              {/* Vertical connector drops down to the next row */}
              {!isLastRow && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  height: '150px', 
                  width: '4px',
                  backgroundImage: 'radial-gradient(circle, var(--primary) 2px, transparent 3px)',
                  backgroundSize: '100% 16px',
                  opacity: 0.35,
                  zIndex: 1,
                  ...(rowIndex % 2 === 0 ? { right: '10%' } : { left: '10%' })
                }} />
              )}

              {/* Render the Days/Nodes in this row */}
              {items.map((dayNum) => {
                const status = getStatus(dayNum)
                const isClickable = status !== 'locked'
                
                // Color configurations matching the website colors
                const colors = {
                  demo: { bg: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: '#7c3aed', shadow: '#3b0764', glow: '0 0 15px rgba(124,58,237,0.4)' },
                  completed: { bg: 'linear-gradient(135deg, #10b981, #059669)', border: '#10b981', shadow: '#047857', glow: 'none' },
                  today: { bg: 'linear-gradient(135deg, var(--primary-bright), var(--primary-dark))', border: 'var(--primary)', shadow: '#a63a00', glow: '0 0 20px rgba(255,122,0,0.5)', anim: 'glow 2.5s ease-in-out infinite' },
                  opened: { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', border: '#f59e0b', shadow: '#b45309', glow: 'none' },
                  missed: { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', border: '#ef4444', shadow: '#991b1b', glow: 'none' },
                  locked: { bg: 'linear-gradient(135deg, #1e2530, #131720)', border: '#1e2530', shadow: '#0b0d13', glow: 'none' }
                }[status]

                return (
                  <div
                    key={dayNum}
                    onClick={() => {
                      if (!isClickable) {
                        toast.error(`Day ${dayNum} is locked. Complete previous days to unlock!`)
                        return
                      }
                      setSelectedDayNum(dayNum)
                    }}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: colors.bg,
                      border: `2px solid rgba(255,255,255,0.18)`,
                      boxShadow: `0 5px 0 ${colors.shadow}, 0 6px 12px rgba(0,0,0,0.45), ${colors.glow}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: status === 'locked' ? 'rgba(255,255,255,0.18)' : '#fff',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      fontFamily: 'var(--font-display)',
                      cursor: isClickable ? 'pointer' : 'not-allowed',
                      position: 'relative',
                      zIndex: 3,
                      transition: 'all 0.15s ease-in-out',
                      animation: colors.anim || 'none'
                    }}
                    onMouseEnter={e => {
                      if (isClickable) {
                        e.currentTarget.style.transform = 'translateY(-3px)'
                        e.currentTarget.style.boxShadow = `0 8px 0 ${colors.shadow}, 0 10px 20px rgba(0,0,0,0.55), ${colors.glow}`
                      }
                    }}
                    onMouseLeave={e => {
                      if (isClickable) {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = `0 5px 0 ${colors.shadow}, 0 6px 12px rgba(0,0,0,0.45), ${colors.glow}`
                      }
                    }}
                  >
                    {status === 'locked' ? '🔒' : dayNum === 0 ? 'Demo' : dayNum}
                  </div>
                )
              })}
            </div>
          )
        })}

      </div>

      {/* Floating Day Modal Dialog */}
      {selectedDayNum !== null && (
        <div 
          className="modal-overlay" 
          onClick={() => setSelectedDayNum(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.82)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
            overflowY: 'auto'
          }}
        >
          <div 
            className="day-modal-card animate-pop" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              width: '100%', 
              maxWidth: '750px', 
              padding: '2rem 1.5rem', 
              position: 'relative',
              borderRadius: '24px',
              border: '1px solid var(--border-orange)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
              background: 'var(--bg-elevated)',
              textAlign: 'left',
              margin: 'auto'
            }}
          >
            {/* Close Button */}
            <button 
              onClick={() => setSelectedDayNum(null)} 
              style={{ 
                position: 'absolute', 
                top: '15px', 
                right: '15px', 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                background: 'rgba(255,255,255,0.05)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                color: 'var(--text-secondary)', 
                fontSize: '1rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: 'pointer', 
                transition: 'all 0.2s',
                zIndex: 10
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              ✕
            </button>
            
            <DayCard
              dayNumber={selectedDayNum}
              registrationDate={student.first_login_date || student.registration_date}
              dayRecord={dayMap[selectedDayNum]}
              isDemo={selectedDayNum === 0}
              validSections={validSections}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function CoursesPage() {
  const { student } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [activeCourse, setActiveCourse] = useState(location.state?.openDemoDay || location.state?.openDayNum !== undefined ? '100-days-of-abacus' : null)
  const [days, setDays] = useState([])
  const [validSections, setValidSections] = useState(null)
  const [loading, setLoading] = useState(false)

  const currentDay = useMemo(() => getChallengeDay(student?.first_login_date || student?.registration_date), [student])

  const dayMap = useMemo(() => {
    const m = {}
    days.forEach(d => { m[d.day_number] = d })
    return m
  }, [days])

  // Fetch student progress for map mapping and progress bar
  useEffect(() => {
    if (student?.id) {
      setLoading(true)
      api.get(`/students/${student.id}/progress`)
        .then(res => {
          setDays(res.data.days || [])
          setValidSections(res.data.validSections || null)
          setLoading(false)
        })
        .catch(() => {
          toast.error('Could not load course progress.')
          setLoading(false)
        })
    }
  }, [student])

  if (activeCourse === '100-days-of-abacus') {
    if (loading) {
      return (
        <StudentLayout>
          <div className="loading-screen">
            <div className="spinner" />
            <p>Loading course map...</p>
          </div>
        </StudentLayout>
      )
    }

    return (
      <StudentLayout>
          <WindingLevelMap 
            days={days} 
            dayMap={dayMap}
            currentDay={currentDay} 
            student={student} 
            onBack={() => setActiveCourse(null)} 
            defaultDayNum={location.state?.openDemoDay ? 0 : location.state?.openDayNum !== undefined ? location.state.openDayNum : null}
            validSections={validSections}
          />
      </StudentLayout>
    )
  }

  return (
    <StudentLayout>
      <div className="animate-slide-up" style={{ width: '100%' }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', fontWeight: 700 }}>My Courses</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
          Explore your enrolled programs and track your learning progress.
        </p>

        {/* Enrolled Courses Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          
          {/* Card: 100 Days of Abacus */}
          <div 
            className="glass-panel-orange card-3d card-shiny"
            onClick={() => setActiveCourse('100-days-of-abacus')}
            style={{
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 280,
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer'
            }}
          >
            {/* Background design bead decoration */}
            <div style={{
              position: 'absolute', right: '-30px', top: '-30px', width: 120, height: 120,
              borderRadius: '50%', background: 'var(--primary-glow-lg)', filter: 'blur(20px)', zIndex: 0
            }} />

            <div style={{ zIndex: 1 }}>
              {/* Course Icon & Level badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '12px', background: 'rgba(255,122,0,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                  border: '1px solid var(--border-orange)'
                }}>
                  🧮
                </div>
                <span className="badge badge-primary" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                  Enrolled
                </span>
              </div>

              {/* Course titles */}
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                100 Days of Abacus
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.4rem', marginBottom: '1.5rem' }}>
                Develop super-human mental math speed, precision, and confidence through 100 daily practice challenge worksheets.
              </p>
            </div>

            {/* Bottom section with progress and start button */}
            <div style={{ zIndex: 1, borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>Course Progress</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-light)' }}>
                  {(() => {
                    let totalProgress = 0;
                    days.forEach(d => {
                      if (d.completed) {
                        totalProgress += 1;
                      } else if (d.section_data) {
                        try {
                          const sd = typeof d.section_data === 'string' ? JSON.parse(d.section_data) : d.section_data;
                          const secKeys = Object.keys(sd);
                          let completedSecs = 0;
                          secKeys.forEach(k => { if (sd[k].status === 'done') completedSecs++; });
                          if (secKeys.length > 0) {
                            totalProgress += completedSecs / secKeys.length;
                          }
                        } catch (e) {}
                      }
                    });
                    return Math.min(100, Math.floor(totalProgress));
                  })()}% Complete
                </span>
              </div>
              
              {/* Progress bar */}
              <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '1.25rem' }}>
                <div style={{ width: `${(() => {
                  let totalProgress = 0;
                  days.forEach(d => {
                    if (d.completed) {
                      totalProgress += 1;
                    } else if (d.section_data) {
                      try {
                        const sd = typeof d.section_data === 'string' ? JSON.parse(d.section_data) : d.section_data;
                        const secKeys = Object.keys(sd);
                        let completedSecs = 0;
                        secKeys.forEach(k => { if (sd[k].status === 'done') completedSecs++; });
                        if (secKeys.length > 0) {
                          totalProgress += completedSecs / secKeys.length;
                        }
                      } catch (e) {}
                    }
                  });
                  return Math.min(100, Math.floor(totalProgress));
                })()}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--primary), var(--primary-light))' }} />
              </div>

              <button 
                className="btn btn-primary btn-block btn-lg"
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveCourse('100-days-of-abacus')
                }}
                style={{ justifyContent: 'center', fontSize: '0.9rem' }}
              >
                Resume Learning →
              </button>
            </div>

          </div>
        </div>

      </div>
    </StudentLayout>
  )
}
