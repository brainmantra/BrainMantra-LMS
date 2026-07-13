import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function StudentLayout({ children }) {
  const { student, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // PWA Install Event state
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    const handlePrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

  const handleInstall = async () => {
    setSettingsOpen(false)
    if (!deferredPrompt) {
      toast.success('App is already installed or PWA is not supported by your browser.')
      return
    }
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      toast.success('Thank you for installing our App!')
    }
  }

  const handleLogoutClick = () => {
    logout()
    localStorage.removeItem('abacus_student')
    localStorage.removeItem('abacus_admin_token')
    localStorage.removeItem('abacus_teacher_token')
    localStorage.removeItem('abacus_teacher')
    toast.success('Logged out successfully.')
    navigate('/')
  }

  // Active path checker
  const isActive = (path) => location.pathname === path

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

  return (
    <div className="admin-layout" data-sidebar={sidebarOpen ? 'open' : 'closed'} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Sidebar Overlay (Mobile only - close on click outside) */}
      {sidebarOpen && typeof window !== 'undefined' && window.innerWidth <= 991 && (
        <div 
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.5)', zIndex: 40, backdropFilter: 'blur(3px)'
          }} 
        />
      )}

      {/* Sidebar container */}
      <aside 
        className="admin-sidebar student-sidebar"
        style={{ transition: 'transform 0.3s ease, width 0.3s ease', display: 'block' }}
      >
        <div className="admin-sidebar__logo" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <h2>Brain Mantra</h2>
          <p>Student Dashboard</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 100px)', justifyContent: 'space-between' }}>
          <div>
            <button 
              className={`admin-nav-item${isActive('/challenge') ? ' active' : ''}`}
              onClick={() => { navigate('/challenge'); setMenuOpen(false); }}
            >
              <span>🧮</span>
              <span>Dashboard</span>
            </button>

            <button 
              className={`admin-nav-item${isActive('/courses') ? ' active' : ''}`}
              onClick={() => { navigate('/courses'); setMenuOpen(false); }}
            >
              <span>📚</span>
              <span>My Courses</span>
            </button>

          </div>

          <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              className="btn btn-primary btn-block btn-sm"
              onClick={handleInstall}
              style={{ justifyContent: 'center', fontSize: '0.8rem' }}
            >
              📲 Install App
            </button>
            <button 
              className="btn btn-ghost btn-block btn-sm"
              onClick={handleLogoutClick}
              style={{ justifyContent: 'center', color: 'var(--text-secondary)' }}
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div 
        className="admin-main student-main"
        style={{
          padding: '1.5rem',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          transition: 'margin-left 0.3s ease'
        }}
      >
        
        {/* Header navigation bar */}
        <header 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap',
            gap: '1rem',
            position: 'relative'
          }}
        >
          {/* Hamburger menu toggle - always visible */}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '1.4rem', cursor: 'pointer',
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '8px', transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            ☰
          </button>

          {/* Right aligned Profile details and settings */}
          <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto', alignItems: 'center', position: 'relative' }}>
            
            {/* Profile Dropdown Toggle */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => { setProfileOpen(!profileOpen); setSettingsOpen(false); }}
                style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary), var(--accent-gold))',
                  color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.95rem', boxShadow: '0 2px 10px rgba(0,0,0,0.15)'
                }}
                title="View Profile Details"
              >
                {student?.name ? student.name[0].toUpperCase() : '👤'}
              </button>

              {profileOpen && (
                <>
                  <div onClick={() => setProfileOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 100 }} />
                  <div 
                    className="card animate-pop"
                    style={{
                      position: 'absolute', right: 0, marginTop: '0.5rem', width: 260,
                      padding: '1.25rem', zIndex: 101, border: '1px solid var(--border-strong)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.3)', background: 'var(--bg-elevated)'
                    }}
                  >
                    <h3 style={{ fontSize: '1.05rem', marginBottom: '0.2rem', color: 'var(--text-primary)' }}>{student?.name}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--primary-light)', fontWeight: 600, marginBottom: '0.75rem' }}>
                      {LEVEL_LABELS[student?.level] || student?.level || 'Active Student'}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <div>👤 <strong>Username:</strong> {student?.username || '—'}</div>
                      <div>📞 <strong>Contact:</strong> {student?.mobile || '—'}</div>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        </header>

        {/* Page Inner Content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </div>

      {/* Embedded CSS overrides for student sidebar layout */}
      <style>{`
        /* Desktop: sidebar open */
        [data-sidebar='open'] .student-sidebar {
          transform: translateX(0);
          width: 240px;
        }
        [data-sidebar='open'] .student-main {
          margin-left: 240px;
        }
        /* Desktop: sidebar closed */
        [data-sidebar='closed'] .student-sidebar {
          transform: translateX(-240px);
          width: 240px;
        }
        [data-sidebar='closed'] .student-main {
          margin-left: 0;
        }
        /* Mobile overrides */
        @media (max-width: 991px) {
          [data-sidebar='open'] .student-sidebar {
            transform: translateX(0);
            position: fixed;
            z-index: 50;
          }
          [data-sidebar='closed'] .student-sidebar {
            transform: translateX(-240px);
          }
          [data-sidebar='open'] .student-main,
          [data-sidebar='closed'] .student-main {
            margin-left: 0 !important;
          }
        }
      `}</style>

    </div>
  )
}
