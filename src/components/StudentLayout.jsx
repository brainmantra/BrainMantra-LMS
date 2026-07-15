import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { calculateAchievements } from '../utils/achievements'

export default function StudentLayout({ children }) {
  const { student, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [days, setDays] = useState([])
  const [streak, setStreak] = useState(0)
  const [longestStreak, setLongestStreak] = useState(0)
  const [equippedFrame, setEquippedFrame] = useState(null)
  const [equippedTheme, setEquippedTheme] = useState(null)

  useEffect(() => {
    let mounted = true
    if (student?.id) {
      api.get(`/students/${student.id}/progress`)
        .then(res => {
          if (mounted) {
            setDays(res.data.days || [])
            setStreak(res.data.streak ?? 0)
            setLongestStreak(res.data.longestStreak ?? 0)
          }
        })
        .catch(() => {})

      api.get(`/students/${student.id}/quests`)
        .then(res => {
          if (mounted) {
            setEquippedFrame(res.data.equipped_frame || null)
            setEquippedTheme(res.data.equipped_theme || null)
          }
        })
        .catch(() => {})
    }
    return () => { mounted = false }
  }, [student])

  useEffect(() => {
    document.body.classList.remove('theme-cyberpunk', 'theme-deep_forest')
    if (equippedTheme) {
      document.body.classList.add(`theme-${equippedTheme}`)
    }
    return () => {
      document.body.classList.remove('theme-cyberpunk', 'theme-deep_forest')
    }
  }, [equippedTheme])

  const achievements = calculateAchievements(days, streak, longestStreak)
  const earnedBadges = achievements.filter(b => b.earned)

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
        style={{ transition: 'transform 0.3s ease, width 0.3s ease', display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'space-between', boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', overflow: 'hidden' }}>
          {/* Sidebar Logo */}
          <div className="admin-sidebar__logo" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start', marginBottom: '0.5rem', width: '100%' }}>
            <img src="/brand-logo.jpeg" alt="Brain Mantra Logo" style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 4 }} />
            <h2 style={{ fontSize: '0.95rem', lineHeight: 1.2 }}>Brain Mantra</h2>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1 }}>Student Portal</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', overflowY: 'auto' }}>
            {/* Nav section label */}
            <div style={{ padding: '0.5rem 1.5rem 0.25rem', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Navigation</div>

            <button 
              className={`admin-nav-item${isActive('/challenge') ? ' active' : ''}`}
              onClick={() => { navigate('/challenge'); setSidebarOpen(window.innerWidth > 991 ? sidebarOpen : false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              <span style={{ fontSize: '1.1rem', width: 22, textAlign: 'center' }}>🧮</span>
              <span>Dashboard</span>
              {isActive('/challenge') && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)' }} />}
            </button>

            <button 
              className={`admin-nav-item${isActive('/courses') ? ' active' : ''}`}
              onClick={() => { navigate('/courses'); setSidebarOpen(window.innerWidth > 991 ? sidebarOpen : false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              <span style={{ fontSize: '1.1rem', width: 22, textAlign: 'center' }}>📚</span>
              <span>My Courses</span>
              {isActive('/courses') && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)' }} />}
            </button>

            <button 
              className={`admin-nav-item${isActive('/profile') ? ' active' : ''}`}
              onClick={() => { navigate('/profile'); setSidebarOpen(window.innerWidth > 991 ? sidebarOpen : false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              <span style={{ fontSize: '1.1rem', width: 22, textAlign: 'center' }}>
                {student?.profile_picture
                  ? <img src={student.profile_picture} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                  : '👤'
                }
              </span>
              <span>My Profile</span>
              {isActive('/profile') && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)' }} />}
            </button>
          </div>
        </div>

        <div style={{ padding: '0 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '1rem', width: '100%' }}>
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,122,0,0.3), transparent)', marginBottom: '0.5rem' }} />
          <button 
            className="btn btn-primary btn-block btn-sm"
            onClick={handleInstall}
            style={{ justifyContent: 'center', fontSize: '0.8rem', borderRadius: 10 }}
          >
            📲 Install App
          </button>
          <button 
            className="btn btn-ghost btn-block btn-sm"
            onClick={handleLogoutClick}
            style={{ justifyContent: 'center', color: 'var(--text-secondary)', borderRadius: 10 }}
          >
            🚪 Sign Out
          </button>
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
        
        {/* Header navigation bar - glassmorphic */}
        <header 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
            padding: '0.75rem 1rem',
            background: 'var(--bg-card)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 16,
            border: '1px solid var(--border)',
            borderTop: '1px solid var(--border-strong)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.05) inset',
            flexWrap: 'wrap',
            gap: '1rem',
            position: 'sticky',
            top: '1rem',
            zIndex: 30,
          }}
        >
          {/* Hamburger menu toggle */}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: sidebarOpen ? 'rgba(255,122,0,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${sidebarOpen ? 'rgba(255,122,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color: sidebarOpen ? 'var(--primary-light)' : 'var(--text-secondary)',
              fontSize: '1.1rem', cursor: 'pointer',
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '10px', transition: 'all 0.2s ease',
              boxShadow: sidebarOpen ? '0 0 12px rgba(255,122,0,0.2)' : 'none'
            }}
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>

          {/* Center brand indicator */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '0.95rem',
              background: 'linear-gradient(135deg, var(--primary-bright), var(--primary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 8px rgba(255,122,0,0.3))'
            }}>Brain Mantra</span>
          </div>

          {/* Right side: profile */}
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>

            {/* Profile avatar dropdown */}
            <div style={{ position: 'relative' }}>
              {/* Avatar — click opens dropdown; long-press or direct icon navigates to /profile */}
              <button 
                onClick={() => { setProfileOpen(!profileOpen); setSettingsOpen(false); }}
                className={equippedFrame ? `avatar-frame-${equippedFrame}` : ''}
                style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: student?.profile_picture ? 'transparent' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                  color: 'white', fontWeight: 800, border: '2px solid rgba(255,122,0,0.4)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(255,122,0,0.35), 0 0 0 1px rgba(255,122,0,0.2)',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box', padding: 0,
                }}
                title="View profile menu"
              >
                {student?.profile_picture
                  ? <img src={student.profile_picture} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : (student?.name ? student.name[0].toUpperCase() : '👤')
                }
              </button>

              {profileOpen && (
                <>
                  <div onClick={() => setProfileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
                  <div 
                    className="animate-pop"
                    style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 10px)',
                      width: 280, zIndex: 101,
                      background: 'var(--bg-card)',
                      backdropFilter: 'blur(30px)',
                      WebkitBackdropFilter: 'blur(30px)',
                      border: '1px solid var(--border)',
                      borderRadius: 16,
                      boxShadow: 'var(--shadow-lg), 0 0 0 1px rgba(255,122,0,0.08)',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Profile Header */}
                    <div style={{
                      padding: '1.25rem 1.25rem 1rem',
                      background: 'linear-gradient(135deg, rgba(255,122,0,0.1), transparent)',
                      borderBottom: '1px solid var(--border)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div 
                          className={equippedFrame ? `avatar-frame-${equippedFrame}` : ''}
                          style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: student?.profile_picture ? 'transparent' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.2rem', fontWeight: 800, color: '#fff',
                            boxShadow: '0 4px 12px rgba(255,122,0,0.4)',
                            boxSizing: 'border-box', overflow: 'hidden',
                            border: '2px solid rgba(255,122,0,0.4)'
                          }}
                        >
                          {student?.profile_picture
                            ? <img src={student.profile_picture} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : (student?.name ? student.name[0].toUpperCase() : '👤')
                          }
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{student?.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)', fontWeight: 600 }}>
                            {LEVEL_LABELS[student?.level] || student?.level || 'Student'}
                          </div>
                        </div>
                      </div>
                      {/* View Full Profile CTA */}
                      <button
                        onClick={() => { setProfileOpen(false); navigate('/profile'); }}
                        style={{
                          marginTop: '0.85rem', width: '100%',
                          padding: '0.5rem', borderRadius: 10,
                          border: '1px solid rgba(255,122,0,0.3)',
                          background: 'rgba(255,122,0,0.08)', color: 'var(--primary-bright)',
                          fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,122,0,0.16)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,122,0,0.08)'}
                      >
                        👤 View Full Profile
                      </button>
                    </div>

                    {/* Profile Details */}
                    <div style={{ padding: '0.75rem 1.25rem 1rem' }}>
                      {[['👤', 'Username', student?.username], ['📞', 'Contact', student?.mobile]].map(([icon, label, val]) => (
                        <div key={label} style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.4rem 0',
                          fontSize: '0.82rem', color: 'var(--text-secondary)',
                          borderBottom: '1px solid var(--border)'
                        }}>
                          <span>{icon}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{val || '—'}</span>
                        </div>
                      ))}

                      {/* Achievements display */}
                      <div style={{ marginTop: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                          🏆 Achievements ({earnedBadges.length})
                        </div>
                        {earnedBadges.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Complete days to earn badges!
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.2rem' }}>
                            {earnedBadges.map(badge => (
                              <span 
                                key={badge.id} 
                                style={{ fontSize: '1.25rem', cursor: 'help' }} 
                                title={`${badge.title}: ${badge.desc}`}
                              >
                                {badge.icon}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        className="btn btn-ghost btn-sm btn-block"
                        onClick={handleLogoutClick}
                        style={{ marginTop: '0.75rem', justifyContent: 'center', color: 'var(--error)', borderColor: 'rgba(239,68,68,0.2)' }}
                      >
                        🚪 Sign Out
                      </button>
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
