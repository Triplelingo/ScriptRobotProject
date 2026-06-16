import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

function PracticePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const incomingLines = location.state?.lines || []
  const chosenRole = location.state?.chosenRole || 'Sara'

  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const lastSpokenIndexRef = useRef(-1)

  const [scriptData, setScriptData] = useState(
    incomingLines.map(line => ({
      ...line,
      isRobot: line.character !== chosenRole,
      avatar: line.character !== chosenRole ? '🤖' : '나',
      scores: null
    }))
  )

  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [robotStatus, setRobotStatus] = useState('듣기 모드') 
  const [currentRobotEmotion, setCurrentRobotEmotion] = useState('joy')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    const currentLine = scriptData[currentLineIndex]
    if (currentLine) {
      const isRobotTurn = currentLine.character !== chosenRole

      if (isRobotTurn) {
        setRobotStatus('말하기 모드')
        setCurrentRobotEmotion(currentLine.emotion)
        
        if (lastSpokenIndexRef.current !== currentLineIndex) {
          lastSpokenIndexRef.current = currentLineIndex;

          const triggerRobotVoice = async () => {
            try {
              const formData = new FormData()
              formData.append("text", currentLine.text)
              formData.append("emotion", currentLine.emotion)
              formData.append("character", currentLine.character)

          const settings = JSON.parse(localStorage.getItem('ttsSettings') || '{}')
          await fetch("http://localhost:8000/api/robot/speak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: currentLine.text,
              emotion: currentLine.emotion,
              character: currentLine.character,
              voice: settings.voice || 'Jenny',
              speed: settings.speed || 1.0
            })
          })
            } catch (error) {
              console.error("Failed to execute robot audio voice stream:", error)
            }
          }
          triggerRobotVoice()
        }
      } else {
        setRobotStatus('듣기 모드')
        if (currentLineIndex > 0) {
          const prevLine = scriptData[currentLineIndex - 1]
          setCurrentRobotEmotion(prevLine.emotion)
        } else {
          setCurrentRobotEmotion(currentLine.emotion)
        }
      }
    }
  }, [currentLineIndex, scriptData, chosenRole])

  const getEmotionEmoji = (emotion) => {
    if (emotion === 'joy') return '😊'
    if (emotion === 'fear') return '😨'
    if (emotion === 'surprise') return '😲'
    if (emotion === 'anger') return '😡'
    if (emotion === 'sadness') return '😢'
    if (emotion === 'disgust') return '🤢'
    return '😐'
  }

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current.stop()
      fetch("http://localhost:8000/api/robot/end_recording", { method: "POST" })
        .catch(err => console.error("end_recording 전송 실패:", err))
      setIsRecording(false)
      setIsAnalyzing(true)  // 추가
    } else {
      audioChunksRef.current = []
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' })

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data)
        }

        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
          const activeLineText = scriptData[currentLineIndex].text
          const formData = new FormData()
          formData.append("file", audioBlob, "user_voice.wav")
          formData.append("reference_text", activeLineText)

          try {
            const response = await fetch("http://localhost:8000/api/evaluate", {
              method: "POST",
              body: formData,
            })
            const data = await response.json()
            if (data.status === "success") {
              setScriptData(prevData =>
                prevData.map((line, idx) =>
                  idx === currentLineIndex
                    ? {
                        ...line,
                        scores: {
                          pronunciation: Math.round(data.pronunciation),
                          fluency: Math.round(data.fluency),
                          accuracy: Math.round(data.accuracy)
                        },
                        realTranscripts: data.user_text,
                        aiFeedback: data.feedback,
                        wordsDetail: data.words,
                        audioUrl: data.audio_url  // 추가
                      }
                    : line
                )
              )
              setIsAnalyzing(false)  // 추가
            } else {
              setIsAnalyzing(false)  // 추가
              alert("음성 인식에 실패했습니다. 다시 말씀해 주세요.")
            }
          } catch (error) {
            console.error("서버 연결 오류:", error)
            alert("서버 연결 실패.")
          }
        }

        mediaRecorderRef.current.start()
        setIsRecording(true)
        // 녹음 시작 시 standby 전송 → LED 켜짐
        fetch("http://localhost:8000/api/robot/standby", { method: "POST" })
          .catch(err => console.error("standby 전송 실패:", err))

      } catch (err) {
        console.error("마이크 오류:", err)
        alert("마이크 사용 권한을 확인해 주세요.")
      }
    }
  }

  const handlePrevLine = () => {
    if (currentLineIndex > 0) setCurrentLineIndex(currentLineIndex - 1)
  }

  const handleNextLine = async () => {
    if (currentLineIndex < scriptData.length - 1) {
      const nextIndex = currentLineIndex + 1
      setCurrentLineIndex(nextIndex)
    }
  }

  const handleFinishPractice = async () => {
    const user = JSON.parse(localStorage.getItem('loginUser') || '{}')
    const script_id = location.state?.script_id
    
    const userLines = scriptData.filter(line => line.scores !== null && line.scores !== undefined)
    const totalLines = userLines.length
    const avgScore = totalLines > 0
      ? Math.round(userLines.reduce((acc, line) => acc + (line.scores?.pronunciation || 0), 0) / totalLines)
      : 0

    try {
      await fetch("http://localhost:8000/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.user_id || 1,
          script_id: script_id || 3,
          chosen_role: chosenRole,
          total_lines: totalLines,
          average_score: avgScore
        })
      })
    } catch (err) {
      console.error("세션 저장 실패:", err)
    }

    navigate('/result', { state: { fullSessionScript: scriptData } })
  }

  const isLastLine = currentLineIndex === scriptData.length - 1
  const activeLine = scriptData[currentLineIndex]

  return (
    <div className="character-page" style={{ backgroundColor: '#0B1224', color: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <header className="script-title" style={{ background: '#0F172A', borderBottom: '1px solid #1E293B', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
        <button onClick={() => { alert("연습 내용이 저장되지 않습니다. 대본 목록으로 이동합니다."); navigate('/upload') }} style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '18px', cursor: 'pointer' }}>✕ 종료</button>
        <button onClick={() => navigate('/settings')} style={{ background: 'transparent', border: '1px solid #94A3B8', color: '#94A3B8', fontSize: '14px', cursor: 'pointer', borderRadius: '8px', padding: '6px 12px', marginLeft: '12px' }}>⚙️ 설정</button>
        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
          Multi-Emotion Evaluation Bench 
          <span style={{ fontSize: '14px', color: '#64748B', marginLeft: '12px' }}>Role: <b style={{color: '#3B82F6'}}>{chosenRole}</b> ({currentLineIndex + 1} / {scriptData.length})</span>
        </div>
        <div style={{ width: '120px', height: '6px', background: '#1E293B', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${((currentLineIndex + 1) / scriptData.length) * 100}%`, height: '100%', background: '#2563EB' }}></div>
        </div>
      </header>

      <div className="character-container" style={{ maxWidth: '1600px', width: '100%', margin: '0 auto', display: 'flex', gap: '32px', padding: '32px', flex: 1, boxSizing: 'border-box' }}>
        <div className="script-list" style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
          {scriptData.map((line, index) => {
            if (index > currentLineIndex) return null
            const isActive = index === currentLineIndex
            const isMe = line.character === chosenRole
            const alignment = !isMe ? 'flex-start' : 'flex-end'

            return (
              <div key={line.id} style={{ display: 'flex', justifyContent: alignment, gap: '16px', opacity: isActive ? 1 : 0.4 }}>
                {!isMe && <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🤖</div>}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: !isMe ? 'flex-start' : 'flex-end', maxWidth: '75%' }}>
                  <span style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '6px' }}>{line.character} ({line.emotion})</span>
                  <div style={{ padding: '16px 20px', borderRadius: '16px', fontSize: '18px', background: !isMe ? '#1A2333' : '#3B1F71', color: '#FFFFFF', border: isActive && isMe ? '1px solid #3B82F6' : '1px solid transparent' }}>
                    {line.text}
                    {line.scores && (
                      <div style={{ marginTop: '12px', borderTop: '1px solid #4C1D95', paddingTop: '8px', fontSize: '14px', color: '#10B981' }}>
                        <div>발음 정확도: {line.scores.pronunciation}점 ✓</div>
                        <div>흐름 유창성: {line.scores.fluency}점 ✓</div>
                      </div>
                    )}
                    {isActive && isMe && isAnalyzing && (
                      <div style={{ marginTop: '10px', fontSize: '14px', color: '#F59E0B' }}>
                        ⏳ 발음 분석 중...
                      </div>
                    )}
                  </div>
                </div>
                {isMe && <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#6D28D9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>나</div>}
              </div>
            )
          })}
        </div>

        <aside style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '320px' }}>
          <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '16px', padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ width: '110px', height: '110px', borderRadius: '50%', border: `3px solid ${isRecording ? '#EF4444' : '#2563EB'}`, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E293B' }}><span style={{ fontSize: '44px' }}>🤖</span></div>
            <h3 style={{ fontSize: '20px', margin: '0 0 8px 0' }}>로봇 상태</h3>
            <span style={{ color: robotStatus === '말하기 모드' ? '#10B981' : '#3B82F6', fontWeight: 'bold' }}>● {robotStatus}</span>
          </div>
          <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '16px', padding: '20px' }}>
            <span style={{ fontSize: '14px', color: '#94A3B8', display: 'block', marginBottom: '12px' }}>매칭 타겟 감정</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '24px', fontWeight: 'bold' }}>
              <span>{getEmotionEmoji(currentRobotEmotion)}</span><span style={{ textTransform: 'uppercase', color: '#60A5FA' }}>{currentRobotEmotion}</span>
            </div>
          </div>
        </aside>
      </div>

      <footer style={{ background: '#0F172A', borderTop: '1px solid #1E293B', padding: '20px 40px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px', position: 'sticky', bottom: 0 }}>
        <button onClick={handlePrevLine} disabled={currentLineIndex === 0} style={{ padding: '12px 24px', background: '#1E293B', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: currentLineIndex === 0 ? 0.4 : 1 }}>⏮ 이전 대사</button>
        <button 
          onClick={toggleRecording} 
          disabled={activeLine.character !== chosenRole} 
          style={{ 
            padding: '14px 48px', background: isRecording ? '#DC2626' : '#16A34A', color: '#FFFFFF', border: 'none', borderRadius: '24px', fontSize: '18px', fontWeight: 'bold', 
            cursor: activeLine.character === chosenRole ? 'pointer' : 'not-allowed', opacity: activeLine.character !== chosenRole ? 0.3 : 1
          }}
        >
          {isRecording ? '🛑 녹음 중지' : '🎙️ 녹음 시작'}
        </button>
        {isLastLine ? (
          <button onClick={handleFinishPractice} style={{ padding: '12px 24px', background: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>연습 완료 🏁</button>
        ) : (
          <button onClick={handleNextLine} style={{ padding: '12px 24px', background: '#1E293B', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>다음 대사 ⏭</button>
        )}
      </footer>
    </div>
  )
}

export default PracticePage