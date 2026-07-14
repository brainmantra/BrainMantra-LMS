import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StudentLayout from '../components/StudentLayout'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { calculateAchievements } from '../utils/achievements'
import { CertificateTemplate } from '../components/CertificateTemplate'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const LEVEL_LABELS = {
  beginner: '🌱 Beginner', l1: '⭐ Level 1', l2: '⭐⭐ Level 2',
  l3: '⭐⭐⭐ Level 3', l4: '🔥 Level 4', l5: '🔥🔥 Level 5',
  l6: '💎 Level 6', l7: '💎💎 Level 7', l8: '🏆 Level 8',
  gm: '👑 Grand Master', alumni: '🎓 Alumni',
}

const GENDER_OPTIONS = [
  { value: 'male',             label: '👦 Male' },
  { value: 'female',           label: '👧 Female' },
  { value: 'other',            label: '🌈 Other' },
  { value: 'prefer_not_to_say', label: '🤐 Prefer not to say' },
]

function calcAge(dob) {
  if (!dob) return null
  const d = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

export default function StudentProfilePage() {
  const { student, login } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const certRef = useRef(null)

  const handleDownloadCertificate = async () => {
    if (!certRef.current) return
    const toastId = toast.loading('Generating your certificate...')
    try {
      const canvas = await html2canvas(certRef.current, { scale: 2 })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`${student.name}_100_Days_Abacus.pdf`)
      toast.success('Certificate Downloaded!', { id: toastId })
      try {
        import('../utils/sound.js').then(s => s.playFanfare())
      } catch(e) {}
    } catch (err) {
      toast.error('Failed to generate certificate', { id: toastId })
    }
  }

  // Profile data
  const [profile, setProfile]       = useState(null)
  const [days, setDays]             = useState([])
  const [streak, setStreak]         = useState(0)
  const [longestStreak, setLongest] = useState(0)
  const [loading, setLoading]       = useState(true)

  // Edit state
  const [editing, setEditing]     = useState(false)
  const [dob, setDob]             = useState('')
  const [gender, setGender]       = useState('')
  const [preview, setPreview]     = useState(null)  // base64 preview
  const [picBase64, setPicBase64] = useState(null)  // to send to backend
  const [saving, setSaving]       = useState(false)

  // Achievements
  const achievements = useMemo(
    () => calculateAchievements(days, streak, longestStreak),
    [days, streak, longestStreak]
  )
  const earnedBadges = achievements.filter(b => b.earned)

  // Stats
  const stats = useMemo(() => {
    const completed = days.filter(d => d.completed)
    const totalAcc  = completed.reduce((s, d) => s + parseFloat(d.accuracy || 0), 0)
    const avgAcc    = completed.length ? Math.round(totalAcc / completed.length) : 0
    const totalTime = completed.reduce((s, d) => s + (d.time_taken_seconds || 0), 0)
    const totalXp   = completed.reduce((s, d) => s + (d.xp_earned || 0), 0)
    return { count: completed.length, avgAcc, totalTime, totalXp }
  }, [days])

  useEffect(() => {
    if (!student?.id) return
    let mounted = true
    Promise.all([
      api.get(`/students/${student.id}/profile`),
      api.get(`/students/${student.id}/progress`),
    ]).then(([pRes, prRes]) => {
      if (!mounted) return
      setProfile(pRes.data)
      setDob(pRes.data.date_of_birth ? pRes.data.date_of_birth.split('T')[0] : '')
      setGender(pRes.data.gender || '')
      setDays(prRes.data.days || [])
      setStreak(prRes.data.streak ?? 0)
      setLongest(prRes.data.longestStreak ?? 0)
    }).catch(() => toast.error('Could not load profile.'))
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [student])

  // Handle photo file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB. Please compress it first.')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPreview(ev.target.result)
      setPicBase64(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {}
      if (dob    !== (profile?.date_of_birth ? profile.date_of_birth.split('T')[0] : '')) body.date_of_birth    = dob || null
      if (gender !== (profile?.gender || ''))                                               body.gender          = gender || null
      if (picBase64)                                                                        body.profile_picture = picBase64

      if (Object.keys(body).length === 0) {
        toast('No changes to save.')
        setEditing(false)
        return
      }

      const res = await api.put(`/students/${student.id}/profile`, body)
      setProfile(res.data)

      // Sync to AuthContext & localStorage so avatar updates everywhere
      const updated = { ...student, ...res.data }
      login(updated)

      toast.success('Profile updated! ✨')
      setEditing(false)
      setPicBase64(null)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setDob(profile?.date_of_birth ? profile.date_of_birth.split('T')[0] : '')
    setGender(profile?.gender || '')
    setPreview(null)
    setPicBase64(null)
  }

  const avatarSrc  = preview || profile?.profile_picture || null
  const equippedFrame = profile?.equipped_frame || null
  const age        = calcAge(profile?.date_of_birth)

  if (loading) {
    return (
      <StudentLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <div className="spinner" />
        </div>
      </StudentLayout>
    )
  }

  return (
    <StudentLayout>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 0' }}>

        {/* ── Back Button ── */}
        <button
          onClick={() => navigate('/challenge')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--text-secondary)', borderRadius: 10, padding: '0.4rem 0.9rem',
            fontSize: '0.82rem', cursor: 'pointer', marginBottom: '1.5rem',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--primary-bright)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          ← Back to Dashboard
        </button>

        {/* ── Hero Card ── */}
        <div style={{
          borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(255,122,0,0.08) 0%, rgba(30,38,60,0.6) 60%, rgba(0,0,0,0.02) 100%)',
          border: '1px solid rgba(255,122,0,0.15)',
          padding: '2.5rem',
          marginBottom: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Ambient glow */}
          <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,122,0,0.1), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-30%', left: '-5%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.07), transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>

            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                className={equippedFrame ? `avatar-frame-${equippedFrame}` : ''}
                style={{
                  width: 110, height: 110, borderRadius: '50%',
                  background: avatarSrc ? 'transparent' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: avatarSrc ? undefined : '2.8rem',
                  fontWeight: 800, color: '#fff',
                  border: '3px solid rgba(255,122,0,0.4)',
                  boxShadow: '0 8px 32px rgba(255,122,0,0.3)',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  cursor: editing ? 'pointer' : 'default',
                  transition: 'transform 0.2s',
                }}
                onClick={() => editing && fileRef.current?.click()}
                title={editing ? 'Click to change photo' : ''}
              >
                {avatarSrc
                  ? <img src={avatarSrc} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (profile?.name?.[0]?.toUpperCase() || '👤')
                }
                {editing && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.8rem', borderRadius: '50%',
                  }}>
                    📷
                  </div>
                )}
              </div>
              {editing && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                      position: 'absolute', bottom: 4, right: 4,
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'var(--primary)', border: '2px solid var(--bg-base)',
                      color: '#fff', fontSize: '0.8rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title="Upload Photo"
                  >📷</button>
                </>
              )}
            </div>

            {/* Name & Info */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {profile?.name}
                </h1>
                {equippedFrame && (
                  <span style={{ fontSize: '0.7rem', background: 'rgba(255,122,0,0.12)', border: '1px solid rgba(255,122,0,0.3)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                    ✦ Custom Frame
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                <span className="badge badge-primary badge-3d">{LEVEL_LABELS[profile?.level] || profile?.level}</span>
                <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem' }}>
                  @{profile?.username}
                </span>
                {age !== null && (
                  <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem' }}>
                    🎂 {age} years old
                  </span>
                )}
                {profile?.gender && (
                  <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem' }}>
                    {GENDER_OPTIONS.find(g => g.value === profile.gender)?.label || profile.gender}
                  </span>
                )}
              </div>

              {/* Inline edit form */}
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 380 }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Date of Birth</label>
                    <input
                      type="date"
                      value={dob}
                      onChange={e => setDob(e.target.value)}
                      max={new Date(Date.now() - 3 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                      style={{
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,122,0,0.3)',
                        borderRadius: 10, padding: '0.5rem 0.75rem', color: 'var(--text-primary)',
                        fontSize: '0.9rem', width: '100%', outline: 'none',
                        colorScheme: 'dark',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Gender</label>
                    <select
                      value={gender}
                      onChange={e => setGender(e.target.value)}
                      style={{
                        background: 'rgba(20,25,40,0.95)', border: '1px solid rgba(255,122,0,0.3)',
                        borderRadius: 10, padding: '0.5rem 0.75rem', color: 'var(--text-primary)',
                        fontSize: '0.9rem', width: '100%', outline: 'none', cursor: 'pointer',
                      }}
                    >
                      <option value="">— Select gender —</option>
                      {GENDER_OPTIONS.map(g => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      style={{
                        flex: 1, padding: '0.55rem', borderRadius: 10, border: 'none',
                        background: 'linear-gradient(135deg, var(--primary), var(--primary-bright))',
                        color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.7 : 1,
                      }}
                    >
                      {saving ? 'Saving…' : '✓ Save Changes'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      style={{
                        padding: '0.55rem 1rem', borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)',
                        fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {profile?.date_of_birth && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      📅 Born: {new Date(profile.date_of_birth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                  {profile?.registration_date && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      🗓 Joined: {new Date(profile.registration_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                  {!profile?.date_of_birth && !profile?.gender && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                      Add your date of birth and gender to personalise your profile.
                    </p>
                  )}
                  <button
                    onClick={() => setEditing(true)}
                    style={{
                      marginTop: '0.5rem', alignSelf: 'flex-start',
                      padding: '0.45rem 1rem', borderRadius: 10,
                      border: '1px solid rgba(255,122,0,0.3)',
                      background: 'rgba(255,122,0,0.06)', color: 'var(--primary-bright)',
                      fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,122,0,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,122,0,0.06)'}
                  >
                    ✏️ Edit Profile
                  </button>
                </div>
              )}
            </div>

            {/* XP Counter */}
            <div style={{
              background: 'rgba(255,122,0,0.06)', border: '1px solid rgba(255,122,0,0.2)',
              borderRadius: 16, padding: '1.25rem 1.5rem', textAlign: 'center', minWidth: 130,
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-gold)', lineHeight: 1 }}>
                {profile?.xp_total || 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total XP</div>
              <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                🔥 {streak}-day streak
              </div>
              {profile?.league_tier && (
                <div style={{ marginTop: '0.4rem' }}>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: profile.league_tier === 'Bronze' ? 'rgba(205,127,50,0.15)' : profile.league_tier === 'Gold' ? 'rgba(245,200,66,0.15)' : 'rgba(192,192,192,0.15)',
                    color: profile.league_tier === 'Bronze' ? '#cd7f32' : profile.league_tier === 'Gold' ? '#f5c842' : '#c0c0c0',
                    border: '1px solid currentColor',
                  }}>
                    {profile.league_tier === 'Bronze' ? '🥉' : profile.league_tier === 'Gold' ? '🥇' : '🥈'} {profile.league_tier}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {stats.count >= 100 && (
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                onClick={handleDownloadCertificate}
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: '#fff',
                  background: 'linear-gradient(135deg, var(--accent-gold), #FF7A00)',
                  border: 'none',
                  borderRadius: '50px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(255,122,0,0.4)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  animation: 'pulseGlow 2s infinite'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                🎓 Download 100 Days Certificate
              </button>
            </div>
          )}

          <CertificateTemplate 
            ref={certRef}
            studentName={profile?.name || student?.name}
            level={LEVEL_LABELS[profile?.level] || profile?.level || 'Abacus Training'}
            date={new Date().toLocaleDateString()}
          />
        </div>

        {/* ── Stats Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { icon: '✅', label: 'Days Done',    value: `${stats.count}/100` },
            { icon: '🎯', label: 'Avg Accuracy', value: `${stats.avgAcc}%` },
            { icon: '🔥', label: 'Streak',       value: `${streak} days` },
            { icon: '⏱',  label: 'Best Streak',  value: `${longestStreak} days` },
            { icon: '⏰',  label: 'Time Spent',   value: `${Math.round(stats.totalTime / 60)} min` },
          ].map(s => (
            <div key={s.label} className="stat-card card-shiny">
              <div className="stat-card__icon">{s.icon}</div>
              <div className="stat-card__value">{s.value}</div>
              <div className="stat-card__label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Personal Info Card ── */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem',
        }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            👤 Personal Information
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Full Name',    value: profile?.name },
              { label: 'Username',     value: `@${profile?.username}` },
              { label: 'Level',        value: LEVEL_LABELS[profile?.level] || profile?.level },
              { label: 'Mobile',       value: profile?.mobile ? `+91 ${profile.mobile.slice(0,5)}*****` : '—' },
              { label: 'Date of Birth', value: profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
              { label: 'Age',          value: age !== null ? `${age} years` : '—' },
              { label: 'Gender',       value: GENDER_OPTIONS.find(g => g.value === profile?.gender)?.label || '—' },
              { label: 'Challenge Day', value: profile?.first_login_date ? `Started ${new Date(profile.first_login_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Not started' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{item.value || '—'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Earned Badges ── */}
        {earnedBadges.length > 0 && (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem',
          }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              🏆 Earned Badges ({earnedBadges.length})
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {earnedBadges.map(b => (
                <div
                  key={b.id}
                  title={b.desc}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: 'rgba(255,122,0,0.06)', border: '1px solid rgba(255,122,0,0.25)',
                    borderRadius: 12, padding: '0.5rem 0.9rem',
                    boxShadow: '0 4px 16px rgba(255,122,0,0.1)',
                  }}
                >
                  <span style={{ fontSize: '1.3rem', filter: 'drop-shadow(0 0 6px rgba(255,122,0,0.5))' }}>{b.icon}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary-bright)' }}>{b.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── All Achievements Grid ── */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '1.5rem',
        }}>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            📋 All Achievements
          </h2>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Your progress towards every milestone in the 100-day challenge.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1rem' }}>
            {achievements.map(badge => {
              const pct = Math.min((badge.current / badge.target) * 100, 100)
              return (
                <div
                  key={badge.id}
                  className="card-3d"
                  style={{
                    background: badge.earned ? 'rgba(255,122,0,0.04)' : 'rgba(255,255,255,0.01)',
                    border: badge.earned ? '1px solid rgba(255,122,0,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 14, padding: '1.1rem',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                    opacity: badge.earned ? 1 : 0.6,
                    boxShadow: badge.earned ? '0 6px 24px rgba(255,122,0,0.12)' : 'none',
                    transition: 'all 0.3s',
                    position: 'relative',
                  }}
                >
                  {badge.earned && (
                    <span style={{
                      position: 'absolute', top: 8, right: 8,
                      fontSize: '0.62rem', fontWeight: 800, color: 'var(--success)',
                      background: 'rgba(16,185,129,0.1)', padding: '2px 5px', borderRadius: 4,
                    }}>EARNED</span>
                  )}
                  <div style={{
                    fontSize: '2.2rem', marginBottom: '0.6rem',
                    filter: badge.earned ? 'drop-shadow(0 0 8px rgba(255,122,0,0.5))' : 'grayscale(100%)',
                  }}>{badge.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 4 }}>{badge.title}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{badge.desc}</div>
                  <div style={{ width: '100%', height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: badge.earned ? 'var(--success)' : 'linear-gradient(90deg,var(--primary),var(--primary-bright))', borderRadius: 3, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {badge.current} / {badge.target}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </StudentLayout>
  )
}
