import { useLocation, useNavigate } from 'react-router-dom'

function ResultPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const sessionScript = location.state?.fullSessionScript || []

  // Filter out any lines that contain recorded scores from Azure
  const userLines = sessionScript.filter(line => line.scores !== undefined && line.scores !== null)

  const totalAccuracy = userLines.reduce((acc, line) => acc + (line.scores?.accuracy || 0), 0)
  const totalFluency = userLines.reduce((acc, line) => acc + (line.scores?.fluency || 0), 0)
  const totalPronunciation = userLines.reduce((acc, line) => acc + (line.scores?.pronunciation || 0), 0)
  
  const lineCount = userLines.length || 1
  const avgAccuracy = Math.round(totalAccuracy / lineCount)
  const avgFluency = Math.round(totalFluency / lineCount)
  const avgPronunciation = Math.round(totalPronunciation / lineCount)
  const grandAverage = Math.round((avgAccuracy + avgFluency + avgPronunciation) / 3)

  const categoryScores = [
    { label: '종합 발음 정확도 (Accuracy)', score: userLines.length ? avgAccuracy : 0, color: '#2563EB' },
    { label: '리듬 및 유창성 (Fluency)', score: userLines.length ? avgFluency : 0, color: '#8B5CF6' },
    { label: '음소 조음 대조 (Pronunciation)', score: userLines.length ? avgPronunciation : 0, color: '#10B981' }
  ]

  const getWordStyle = (errorType) => {
    if (errorType === "Mispronunciation") return { color: '#F59E0B', bg: '#FEF3C7' }
    if (errorType === "Omission") return { color: '#EF4444', bg: '#FEE2E2' }
    return { color: '#10B981', bg: '#D1FAE5' }
  }

  return (
    <div className="character-page" style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', paddingBottom: '60px', color: '#1E293B', fontFamily: 'sans-serif' }}>
      <header className="script-title" style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', padding: '20px 40px' }}>
        <button onClick={() => navigate('/practice')} style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>← 다시 연습하기</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: '22px', fontWeight: '800', marginRight: '80px' }}>Multi-Emotion Evaluation Report</div>
      </header>

      <div className="character-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 20px' }}>
        <div className="script-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '32px', display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ textAlign: 'center', paddingRight: '40px', borderRight: '1px solid #E2E8F0', minWidth: '120px' }}>
            <div style={{ fontSize: '64px', fontWeight: '900', color: userLines.length ? '#10B981' : '#94A3B8', lineHeight: '1' }}>{userLines.length ? grandAverage : 0}</div>
            <div style={{ fontSize: '14px', color: '#64748B', marginTop: '8px', fontWeight: '600' }}>종합 가중 평균</div>
          </div>
          <div style={{ paddingLeft: '40px', flex: 1 }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 12px 0' }}>Multi-Emotion Script Summary Log</h2>
            <div style={{ display: 'flex', gap: '48px' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#2563EB' }}>{userLines.length} 대사 완료</div>
                <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>연습 완료 대사 개수</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#10B981' }}>실시간 자동 측정</div>
                <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>Azure + Ollama 파이프라인</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px', marginBottom: '40px' }}>
          <div style={{ flex: 1, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 20px 0' }}>영역별 획득 점수</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {categoryScores.map((item) => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '600', marginBottom: '6px' }}>
                    <span>{item.label}</span><span>{item.score}점</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${item.score}%`, height: '100%', background: item.color }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 20px 0' }}>감정 대사별 AI 피드백</h3>
            <div style={{ maxHeight: '220px', overflowY: 'auto', fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>
              {userLines.map((line) => (
                <div key={line.id} style={{ marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                  <span style={{ fontWeight: 'bold', color: '#8B5CF6' }}>[대사 {line.id} - {line.character} ({line.emotion.toUpperCase()})]</span>
                  <div style={{ whiteSpace: 'pre-line', marginTop: '4px', fontStyle: 'italic', fontSize: '13px' }}>{line.aiFeedback}</div>
                </div>
              ))}
              {userLines.length === 0 && "마이크 테스트 기록이 비어있습니다."}
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 20px 0' }}>각 대사별 조음 음소 피드백</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {userLines.map((line) => (
              <div key={line.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', color: '#FFFFFF', background: '#2563EB' }}>
                    {line.scores?.pronunciation || 0}
                  </div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#1E293B', marginBottom: '4px' }}>"{line.text}"</div>
                    <div style={{ fontSize: '13px', color: '#64748B' }}>
                      역할: <b>{line.character}</b> · 감정: <span style={{ color: '#EF4444', fontWeight: 'bold' }}>{line.emotion}</span> · 정확도 {line.scores?.accuracy || 0} · 유창성 {line.scores?.fluency || 0}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
                  {line.wordsDetail?.map((w, wIdx) => {
                    const styleConfig = getWordStyle(w.error_type);
                    return (
                      <span key={wIdx} style={{ fontSize: '13px', padding: '6px 10px', borderRadius: '8px', background: styleConfig.bg, color: styleConfig.color, border: `1px solid ${styleConfig.color}`, fontWeight: '600' }}>
                        {w.word} ({w.accuracy}점)
                      </span>
                    )
                  })}
                </div>
                    {line.audioUrl && (
                      <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                        <span style={{ fontSize: '13px', color: '#64748B', marginRight: '8px' }}>내 녹음 듣기:</span>
                        <audio controls src={line.audioUrl} style={{ height: '32px', verticalAlign: 'middle' }} />
                      </div>
                    )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '40px' }}>
          <button style={{ width: '180px', padding: '14px 0', fontSize: '16px', borderRadius: '12px', cursor: 'pointer', border: 'none', background: '#2563EB', color: '#FFFFFF', fontWeight: 'bold' }} onClick={() => navigate('/practice')}>다시 연습하기</button>
          <button style={{ width: '180px', padding: '14px 0', fontSize: '16px', borderRadius: '12px', cursor: 'pointer', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#64748B', fontWeight: '800' }} onClick={() => navigate('/')}>대본 목록으로</button>
        </div>
      </div>
    </div>
  )
}

export default ResultPage