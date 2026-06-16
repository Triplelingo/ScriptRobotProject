import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function HistoryPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('loginUser') || '{}')
    if (!user.user_id) return

    fetch(`http://localhost:8000/api/sessions/${user.user_id}`)
      .then(res => res.json())
      .then(data => setSessions(data))
      .catch(err => console.error("기록 불러오기 실패:", err))
  }, [])

  const totalSessions = sessions.length
  const avgScore = sessions.length
    ? Math.round(sessions.reduce((acc, s) => acc + s.average_score, 0) / sessions.length)
    : 0
  const highestScore = sessions.length
    ? Math.max(...sessions.map(s => s.average_score))
    : 0
  const totalLines = sessions.reduce((acc, s) => acc + s.total_lines, 0)

  const getScoreColor = (score) => {
    if (score >= 85) return '#2563EB'
    if (score >= 70) return '#F59E0B'
    return '#EF4444'
  }

  return (
    <div className="character-page" style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', paddingBottom: '80px', color: '#1E293B' }}>

      <div className="character-container" style={{ maxWidth: '1040px', margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1E293B', margin: '0 0 8px 0' }}>연습 기록</h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>지금까지의 연습 세션과 발음 평가 기록을 확인하세요.</p>
        </div>

        <div className="preview-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '48px' }}>
          {[
            { icon: '📋', value: `${totalSessions}회`, label: '총 연습 횟수', color: '#2563EB' },
            { icon: '📊', value: `${avgScore}점`, label: '평균 점수', color: '#10B981' },
            { icon: '🏆', value: `${highestScore}점`, label: '최고 점수', color: '#B45309' },
            { icon: '💬', value: `${totalLines}줄`, label: '총 연습 대사', color: '#7C3AED' },
          ].map((stat) => (
            <div key={stat.label} className="summary-box" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '24px', marginBottom: '8px' }}>{stat.icon}</span>
              <strong style={{ fontSize: '28px', fontWeight: '800', color: stat.color, display: 'block' }}>{stat.value}</strong>
              <span style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', fontWeight: '600' }}>{stat.label}</span>
            </div>
          ))}
        </div>

        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1E293B', marginBottom: '20px' }}>세션 히스토리</h2>
          <div className="script-list" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {sessions.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94A3B8', padding: '40px' }}>연습 기록이 없습니다.</div>
            )}
            {sessions.map((session) => (
              <div key={session.session_id} className="script-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '18px 28px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', background: `${getScoreColor(session.average_score)}20`, color: getScoreColor(session.average_score), flexShrink: 0 }}>
                  {session.average_score}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1E293B', margin: '0 0 4px 0' }}>{session.title}</h3>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                    {session.chosen_role} 역할 · 대사 {session.total_lines}줄 · {session.created_at.slice(0, 10)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HistoryPage