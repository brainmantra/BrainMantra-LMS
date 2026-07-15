import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

const LEVEL_LABELS = {
  beginner: 'Beginner',
  l1: 'Level 1', l2: 'Level 2', l3: 'Level 3', l4: 'Level 4',
  l5: 'Level 5', l6: 'Level 6', l7: 'Level 7', l8: 'Level 8',
  alumni: 'Alumni', gm: 'Grand Master (GM)'
}

const SECTION_LABELS = {
  abacus: '🧮 Abacus',
  bead_fun: '🧮 Bead Fun',
  activity: '⚡ Activity',
  visual: '👁 Visual',
  multiplication: '✖ Multiplication',
  division: '➗ Division',
  tables: '📋 Tables',
  form_the_question: '✏ Form The Question',
  teacher_input: '👨‍🏫 Teacher Section',
  teacher_day: '🌟 Special Day',
}

export default function StudentAnswersTab({ apiInstance, isTeacherPortal = false }) {
  const renderAnswerString = (str) => {
    if (!str) return '(No Answer)'
    try {
      const parsed = JSON.parse(str)
      if (Array.isArray(parsed)) return parsed.join(' ➔ ')
    } catch (e) {}
    return str
  }

  const [responses, setResponses] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Filters state
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('')
  const [dayNumber, setDayNumber] = useState('')
  const [sectionName, setSectionName] = useState('')
  const [isCorrect, setIsCorrect] = useState('')
  
  // Sorting & Pagination state
  const [sortBy, setSortBy] = useState('answered_at')
  const [sortOrder, setSortOrder] = useState('DESC')
  const [page, setPage] = useState(1)
  const limit = 50

  const fetchResponses = useCallback(async (isExport = false) => {
    try {
      const params = new URLSearchParams({
        search,
        level,
        day_number: dayNumber,
        section_name: sectionName,
        is_correct: isCorrect,
        sortBy,
        sortOrder,
        page: page.toString(),
        limit: limit.toString(),
        exportAll: isExport ? 'true' : 'false'
      })

      const path = isTeacherPortal ? '/teachers/responses' : '/admin/responses'
      const res = await apiInstance.get(`${path}?${params}`)
      return res.data
    } catch (err) {
      toast.error('Failed to fetch student answers.')
      return null
    }
  }, [search, level, dayNumber, sectionName, isCorrect, sortBy, sortOrder, page, isTeacherPortal, apiInstance])

  const loadData = useCallback(async () => {
    setLoading(true)
    const data = await fetchResponses(false)
    if (data) {
      setResponses(data.responses || [])
      setTotalCount(data.totalCount || 0)
    }
    setLoading(false)
  }, [fetchResponses])

  const handleGrade = async (responseId, level, isCorrect) => {
    try {
      const path = isTeacherPortal ? `/teachers/responses/${responseId}/grade` : `/admin/responses/${responseId}/grade`
      await apiInstance.post(path, { is_correct: isCorrect, level })
      toast.success('Response graded successfully!')
      loadData()
    } catch (e) {
      toast.error('Failed to grade response.')
    }
  }

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSort = (field) => {
    const order = sortBy === field && sortOrder === 'DESC' ? 'ASC' : 'DESC'
    setSortBy(field)
    setSortOrder(order)
    setPage(1)
  }

  // Export to Excel
  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const data = await fetchResponses(true)
      if (!data || !data.responses.length) {
        toast.error('No answers to export.')
        return
      }

      const rows = data.responses.map((r, i) => ({
        'S.No': i + 1,
        'Student Name': r.student_name,
        'Mobile Number': r.student_mobile,
        'Level': LEVEL_LABELS[r.level] || r.level,
        'Day': `Day ${r.day_number}`,
        'Section': SECTION_LABELS[r.section_name] || r.section_name,
        'Question': r.question_snapshot,
        'Student Answer': renderAnswerString(r.student_answer),
        'Correct Answer': renderAnswerString(r.correct_answer),
        'Result': r.is_correct ? 'Correct' : 'Wrong',
        'Time (s)': r.time_taken_seconds || 0,
        'Submitted At': new Date(r.answered_at).toLocaleString()
      }))

      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Answers')
      XLSX.writeFile(workbook, `Student_Answers_Report_${Date.now()}.xlsx`)
      toast.success('Excel report downloaded successfully.')
    } catch {
      toast.error('Error exporting Excel.')
    } finally {
      setExporting(false)
    }
  }

  // Export to PDF
  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const data = await fetchResponses(true)
      if (!data || !data.responses.length) {
        toast.error('No answers to export.')
        return
      }

      const doc = new jsPDF('l', 'mm', 'a4') // Landscape
      doc.setFontSize(16)
      doc.text('Brain Mantra — Student Submissions Report', 14, 15)
      doc.setFontSize(10)
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22)

      const tableColumn = [
        'Student Name', 'Mobile', 'Level', 'Day', 'Section', 'Question', 'Student Ans', 'Correct Ans', 'Result', 'Time'
      ]

      const tableRows = data.responses.map(r => [
        r.student_name,
        r.student_mobile,
        LEVEL_LABELS[r.level] || r.level,
        `Day ${r.day_number}`,
        r.section_name,
        r.question_snapshot,
        renderAnswerString(r.student_answer),
        renderAnswerString(r.correct_answer),
        r.is_correct ? 'Correct' : 'Wrong',
        `${r.time_taken_seconds || 0}s`
      ])

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 28,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillBox: [108, 99, 255] }
      })

      doc.save(`Student_Answers_Report_${Date.now()}.pdf`)
      toast.success('PDF report downloaded successfully.')
    } catch {
      toast.error('Error exporting PDF.')
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.ceil(totalCount / limit)

  return (
    <div className="animate-slide-up">
      {/* Tab Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>Student Submitted Answers</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Browse, filter, and export detailed question-level submissions from all students.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleExportExcel} disabled={exporting || responses.length === 0}>
            🟢 Export to Excel
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleExportPDF} disabled={exporting || responses.length === 0}>
            🔴 Export to PDF
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search Student</label>
            <input 
              placeholder="Name or mobile..." 
              value={search} 
              onChange={e => { setSearch(e.target.value); setPage(1) }} 
            />
          </div>

          {!isTeacherPortal && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Level</label>
              <select value={level} onChange={e => { setLevel(e.target.value); setPage(1) }}>
                <option value="">All Levels</option>
                {Object.entries(LEVEL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Day Number</label>
            <input 
              type="number" 
              min="1" 
              max="100" 
              placeholder="e.g. 1" 
              value={dayNumber} 
              onChange={e => { setDayNumber(e.target.value); setPage(1) }} 
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Section</label>
            <select value={sectionName} onChange={e => { setSectionName(e.target.value); setPage(1) }}>
              <option value="">All Sections</option>
              {Object.entries(SECTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Status</label>
            <select value={isCorrect} onChange={e => { setIsCorrect(e.target.value); setPage(1) }}>
              <option value="">All Results</option>
              <option value="true">Correct Only</option>
              <option value="false">Wrong Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner" />
        </div>
      ) : responses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)' }}>No student submissions found matching the criteria.</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('student_name')}>
                    Student {sortBy === 'student_name' && (sortOrder === 'DESC' ? '▼' : '▲')}
                  </th>
                  <th>Level</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('day_number')}>
                    Day {sortBy === 'day_number' && (sortOrder === 'DESC' ? '▼' : '▲')}
                  </th>
                  <th>Section</th>
                  <th>Question Snapshot</th>
                  <th>Student Answer</th>
                  <th>Correct Answer</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('is_correct')}>
                    Result {sortBy === 'is_correct' && (sortOrder === 'DESC' ? '▼' : '▲')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('time_taken_seconds')}>
                    Time {sortBy === 'time_taken_seconds' && (sortOrder === 'DESC' ? '▼' : '▲')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('answered_at')}>
                    Submitted At {sortBy === 'answered_at' && (sortOrder === 'DESC' ? '▼' : '▲')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {responses.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.student_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.student_mobile}</div>
                    </td>
                    <td><span className="badge badge-info">{LEVEL_LABELS[r.level] || r.level}</span></td>
                    <td><span className="badge badge-muted">Day {r.day_number}</span></td>
                    <td style={{ fontSize: '0.85rem' }}>{SECTION_LABELS[r.section_name] || r.section_name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{r.question_snapshot}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: r.is_correct === true ? 'var(--success)' : r.is_correct === false ? 'var(--error)' : 'var(--warning)', whiteSpace: 'pre-wrap' }}>
                      {renderAnswerString(r.student_answer)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--success)', whiteSpace: 'pre-wrap' }}>
                      {renderAnswerString(r.correct_answer)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
                        <span className={`badge ${r.is_correct === true ? 'badge-success' : r.is_correct === false ? 'badge-error' : 'badge-warning'}`}>
                          {r.is_correct === true ? 'Correct' : r.is_correct === false ? 'Wrong' : 'Pending Review'}
                        </span>
                        {r.is_correct === null && (
                          <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.2rem' }}>
                            <button
                              className="btn btn-sm"
                              style={{ padding: '2px 8px', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer' }}
                              onClick={() => handleGrade(r.id, r.level, true)}
                            >
                              ✓ Correct
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ padding: '2px 8px', background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error)', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer' }}
                              onClick={() => handleGrade(r.id, r.level, false)}
                            >
                              ✕ Wrong
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{r.time_taken_seconds}s</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(r.answered_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: '1.5rem' }}>
              <button 
                className="page-btn" 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1}
              >
                ◀ Prev
              </button>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages}
              </span>
              <button 
                className="page-btn" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                disabled={page === totalPages}
              >
                Next ▶
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
