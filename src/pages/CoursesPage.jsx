import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StudentLayout from '../components/StudentLayout'

export default function CoursesPage() {
  const { student } = useAuth()
  const navigate = useNavigate()

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
            style={{
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 280,
              position: 'relative',
              overflow: 'hidden',
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
                  {student?.days_completed || 0}% Complete
                </span>
              </div>
              
              {/* Progress bar */}
              <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '1.25rem' }}>
                <div style={{ width: `${student?.days_completed || 0}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--primary), var(--primary-light))' }} />
              </div>

              <button 
                className="btn btn-primary btn-block btn-lg"
                onClick={() => navigate('/challenge')}
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
