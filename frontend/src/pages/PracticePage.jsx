import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import VolumeControl from '../components/VolumeControl'   // 상단 import에 추가

// 로봇(RPi5)에 대사 재생 요청 후, 로봇이 말하는 시간만큼 대기
// 반환값: 'ok'(정상) | 'no_robot'(RPi 미연결) | 'error'(TTS·서버 오류)
const speakOnRobot = async (line) => {
  const savedSettings = JSON.parse(localStorage.getItem('practiceSettings') || '{}')

  const res = await fetch('http://localhost:8000/api/robot/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: line.text,
      emotion: line.emotion || 'neutral',
      character: line.character,
      voice: savedSettings.ttsVoice || 'Jenny',
      speed: savedSettings.ttsSpeed || 1.0,
    }),
  })
  if (!res.ok) return 'error'                      // 서버 내부 에러

  const data = await res.json()
  if (data.status === 'no_robot') return 'no_robot' // 로봇 미연결
  if (data.status !== 'sent') return 'error'        // TTS 합성 실패 등

  // 로봇이 실제로 말하는 동안 대기 (+0.3초: aplay 기동·네트워크 여유분)
  await new Promise((resolve) => setTimeout(resolve, (data.duration || 0) * 1000 + 300))
  return 'ok'
}

function PracticePage() {
  const navigate = useNavigate()
  const location = useLocation()

  const scriptId = location.state?.scriptId || 1
  const chosenRole = location.state?.chosenRole || 'Alex'

  const [scriptTitle, setScriptTitle] = useState('')
  const [scriptData, setScriptData] = useState([])
  const [loading, setLoading] = useState(true)

  const currentAudioRef = useRef(null)
  const abortControllerRef = useRef(null)

  const [isRecording, setIsRecording] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const lastSpokenIndexRef = useRef(-1)

  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [robotStatus, setRobotStatus] = useState('대기 중')
  const [connWarning, setConnWarning] = useState('')   // 연결 경고 전용 (비어 있으면 경고 없음)
  const [currentRobotEmotion, setCurrentRobotEmotion] = useState('neutral')
  const [hasStarted, setHasStarted] = useState(false)
  

  // =========================================================
  // 오디오 정리 및 제어 헬퍼 (상단 선언으로 참조 오류 방지)
  // =========================================================
  const stopAllAudio = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current = null
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  const playBrowserVoice = (text, character = '') => {
    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 1.0
    utterance.pitch = 1.0

    const voices = window.speechSynthesis.getVoices()
    const englishVoices = voices.filter((v) => v.lang.startsWith('en'))

    const maleCharacters = ['Alex', 'Romeo', 'Jack', 'Interviewer', 'Examiner', 'Jake']
    const isMale = maleCharacters.includes(character)

    const preferredVoice =
      englishVoices.find((v) =>
        isMale
          ? v.name.includes('David') || v.name.includes('Guy') || v.name.includes('Male')
          : v.name.includes('Jenny') || v.name.includes('Zira') || v.name.includes('Natural')
      ) || englishVoices[0]

    if (preferredVoice) {
      utterance.voice = preferredVoice
    }

    window.speechSynthesis.speak(utterance)
  }

  const getEmotionEmoji = (emotion) => {
    switch (emotion?.toLowerCase()) {
      case 'joy': return '😊'
      case 'fear': return '😨'
      case 'surprise': return '😲'
      case 'anger': return '😡'
      case 'sadness': return '😢'
      case 'disgust': return '🤢'
      default: return '😐'
    }
  }

  const getEmotionColor = (emotion) => {
    switch (emotion?.toLowerCase()) {
      case 'joy': return '#F59E0B'
      case 'fear': return '#6366F1'
      case 'surprise': return '#EC4899'
      case 'anger': return '#EF4444'
      case 'sadness': return '#38BDF8'
      case 'disgust': return '#10B981'
      default: return '#94A3B8'
    }
  }

  // =========================================================
  // 1. 대본 불러오기
  // =========================================================
  useEffect(() => {
    if (location.state?.customLines && location.state.customLines.length > 0) {
      setScriptData(location.state.customLines)
      if (location.state?.scriptTitle) {
        setScriptTitle(location.state.scriptTitle)
      }
      setLoading(false)
      return
    }

    const fetchScript = async () => {
      try {
        setLoading(true)
        const res = await fetch(`http://localhost:8000/api/scripts/${scriptId}`)
        if (!res.ok) throw new Error('대본 데이터를 불러오지 못했습니다.')
        const data = await res.json()

        setScriptTitle(data.title)
        setScriptData(data.lines || [])
        setCurrentLineIndex(0)
      } catch (err) {
        console.error('Failed to load practice script:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchScript()
  }, [scriptId, location.state])

  // =========================================================
  // 2. 대사 변경 시 로봇 음성 처리 (단일 정돈된 Effect)
  // =========================================================
    // 대사 재생 공통 처리: 로봇으로 재생, 실패 시 화면에 경고 (노트북 대체 재생 없음)
  const playLineOnRobot = async (line) => {
    stopAllAudio()
    setTtsLoading(true)   // 로봇이 말하는 동안 버튼 잠금

    try {
      const result = await speakOnRobot(line)

      if (result === 'ok') setConnWarning('')                          // 성공 시 경고 해제 (모드 표시는 건드리지 않음)
      else if (result === 'no_robot') setConnWarning('⚠️ 로봇 연결 안 됨')
      else setConnWarning('⚠️ 음성 생성 실패')
    } catch (e) {
      console.warn('로봇 재생 요청 실패:', e)
      setConnWarning('⚠️ 서버 연결 안 됨')                            // fetch 자체 실패 = uvicorn 꺼짐
    } finally {
      setTtsLoading(false)
    }
  }

  useEffect(() => {
    if (!hasStarted || scriptData.length === 0) return

    const currentLine = scriptData[currentLineIndex]
    if (!currentLine) return

    const isRobotTurn = currentLine.character !== chosenRole
    setCurrentRobotEmotion(currentLine.emotion || 'neutral')

    if (isRobotTurn) {
      setRobotStatus('말하기 모드')

      if (lastSpokenIndexRef.current !== currentLineIndex) {
        lastSpokenIndexRef.current = currentLineIndex

        const triggerRobotVoice = () => playLineOnRobot(currentLine)

      triggerRobotVoice()
        
      }
    } else {
      setRobotStatus('듣기 모드')
      stopAllAudio()
    }
  }, [currentLineIndex, scriptData, chosenRole, hasStarted])

    // 3초마다 서버·로봇 연결 상태 확인 → 끊기면 즉시 경고 표시
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/robot/status')
        const data = await res.json()
        setConnWarning(data.connected ? '' : '⚠️ 로봇 연결 안 됨')   // 연결되면 경고만 지움
      } catch {
        setConnWarning('⚠️ 서버 연결 안 됨')
      }
    }

    checkConnection()                                  // 화면 진입 즉시 1회 확인
    const timer = setInterval(checkConnection, 3000)   // 이후 3초 간격 반복
    return () => clearInterval(timer)                  // 페이지 나갈 때 타이머 정리
  }, [])

  // =========================================================
  // 3. 사용자 음성 녹음 및 발음 평가
  // =========================================================
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    } else {
      audioChunksRef.current = []
      try {
        const savedSettings = JSON.parse(localStorage.getItem('practiceSettings') || '{}')
        const sensitivity = savedSettings.micSensitivity || 'normal'

        let audioConstraints = { echoCancellation: true }

        if (sensitivity === 'high') {
          audioConstraints = { ...audioConstraints, autoGainControl: true, noiseSuppression: false }
        } else if (sensitivity === 'low') {
          audioConstraints = { ...audioConstraints, autoGainControl: false, noiseSuppression: true }
        } else {
          audioConstraints = { ...audioConstraints, autoGainControl: true, noiseSuppression: true }
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' })

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data)
        }

        mediaRecorderRef.current.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop())

          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
          const targetIndex = currentLineIndex
          const activeLineText = scriptData[targetIndex]?.text || ''

          setIsEvaluating(true)

          const formData = new FormData()
          formData.append('file', audioBlob, 'user_voice.wav')
          formData.append('reference_text', activeLineText)

          try {
            const response = await fetch('http://localhost:8000/api/evaluate', {
              method: 'POST',
              body: formData,
            })

            const data = await response.json()

            if (data.status === 'success') {
              setScriptData((prevData) =>
                prevData.map((line, idx) =>
                  idx === targetIndex
                    ? {
                        ...line,
                        scores: {
                          pronunciation: Math.round(data.pronunciation),
                          fluency: Math.round(data.fluency),
                          accuracy: Math.round(data.accuracy),
                        },
                        realTranscripts: data.user_text,
                        aiFeedback: data.feedback,
                        wordsDetail: data.words,
                      }
                    : line
                )
              )
            } else {
              alert('음성 인식에 실패했습니다. 대사를 명확하게 다시 말씀해 주세요.')
            }
          } catch (error) {
            console.error('Evaluation request error:', error)
          } finally {
            setIsEvaluating(false)
          }
        }

        mediaRecorderRef.current.start()
        setIsRecording(true)
      } catch (err) {
        alert('마이크 사용 권한을 확인해 주세요.')
      }
    }
  }

  // =========================================================
  // 4. 네비게이션 제어
  // =========================================================
  const handlePrevLine = () => {
    if (currentLineIndex > 0 && !isRecording && !isEvaluating) {
      setCurrentLineIndex(currentLineIndex - 1)
    }
  }

  const handleNextLine = () => {
    const activeLine = scriptData[currentLineIndex]
    const isMyTurn = activeLine.character === chosenRole

    if (isMyTurn && !activeLine.scores) {
      alert('현재 대사를 먼저 녹음하고 평가를 완료해주세요.')
      return
    }

    if (currentLineIndex < scriptData.length - 1) {
      setCurrentLineIndex(currentLineIndex + 1)
    }
  }

  const handleFinishPractice = () => {
    stopAllAudio()
    const practicedLines = scriptData.filter((line) => line.scores !== undefined && line.scores !== null)

    if (practicedLines.length === 0) {
      alert('먼저 대사를 녹음하고 평가를 완료해주세요.')
      return
    }

    navigate('/result', {
      state: {
        fullSessionScript: scriptData,
        scriptId,
        scriptTitle,
        chosenRole,
      },
    })
  }

  const handleExit = () => {
    stopAllAudio()
    navigate(-1)
  }

  // =========================================================
  // 5. 로딩 및 빈 대본 상태
  // =========================================================
  if (loading) {
    return (
      <div style={{ backgroundColor: '#0B1224', color: '#FFFFFF', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '38px', marginBottom: '14px' }}>🎭</div>
          <h2>대본을 불러오는 중입니다...</h2>
        </div>
      </div>
    )
  }

  if (scriptData.length === 0) {
    return (
      <div style={{ backgroundColor: '#0B1224', color: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
        <h2>대본 데이터가 존재하지 않습니다.</h2>
        <button onClick={() => navigate('/upload')} style={{ padding: '12px 20px', border: 'none', borderRadius: '9px', background: '#2563EB', color: '#FFFFFF', fontWeight: '700', cursor: 'pointer' }}>
          대본 목록으로 돌아가기
        </button>
      </div>
    )
  }

  const isLastLine = currentLineIndex === scriptData.length - 1
  const activeLine = scriptData[currentLineIndex]
  const isMyTurn = activeLine.character === chosenRole
  const progress = ((currentLineIndex + 1) / scriptData.length) * 100

  const completedMyLines = scriptData.filter((line) => line.character === chosenRole && line.scores).length
  const totalMyLines = scriptData.filter((line) => line.character === chosenRole).length
  const currentScore = activeLine.scores

  return (
    <div style={{ backgroundColor: '#0B1224', color: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      {/* 상단 Header */}
      <header style={{ background: '#0F172A', borderBottom: '1px solid #1E293B', padding: '18px 28px' }}>
        <div style={{ maxWidth: '1500px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <button
              onClick={handleExit}
              disabled={isRecording || isEvaluating}
              style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}
            >
              ✕ 연습 종료
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '19px', fontWeight: '800' }}>{scriptTitle}</div>
              <div style={{ marginTop: '4px', fontSize: '13px', color: '#94A3B8' }}>
                내 역할: <strong style={{ color: '#60A5FA' }}>{chosenRole}</strong>
              </div>
            </div>

            <div style={{ textAlign: 'right', minWidth: '120px' }}>
              <div style={{ fontSize: '15px', fontWeight: '800' }}>
                {currentLineIndex + 1} / {scriptData.length}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px' }}>
                진행률 {Math.round(progress)}%
              </div>
            </div>
          </div>

          <div style={{ height: '6px', background: '#1E293B', borderRadius: '20px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#2563EB', transition: 'width 0.25s ease' }} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ width: '100%', maxWidth: '1500px', margin: '0 auto', flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 330px', gap: '28px', padding: '28px', boxSizing: 'border-box' }}>
        {/* 왼쪽 대화 영역 */}
        <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: isMyTurn ? '#172554' : '#111827', border: isMyTurn ? '1px solid #2563EB' : '1px solid #334155', borderRadius: '16px', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '700', marginBottom: '5px' }}>현재 차례</div>
              <div style={{ fontSize: '21px', fontWeight: '800', color: isMyTurn ? '#60A5FA' : '#34D399' }}>
                {isMyTurn ? '🎙️ 내 차례입니다' : '🤖 AI 상대역 차례입니다'}
              </div>
            </div>

            <div style={{ padding: '9px 14px', borderRadius: '10px', background: '#0F172A', fontSize: '13px', fontWeight: '700', color: '#CBD5E1' }}>
              {isMyTurn
                ? currentScore ? '✓ 평가 완료' : isEvaluating ? '분석 중' : isRecording ? '녹음 중' : '녹음 대기'
                : ttsLoading ? 'TTS 재생 중' : 'AI 대사'}
            </div>
          </div>

          {/* 이전 대사 (최대 2줄) */}
          {currentLineIndex > 0 && (
            <div style={{ opacity: 0.45 }}>
              {scriptData.slice(Math.max(0, currentLineIndex - 2), currentLineIndex).map((line) => {
                const isMine = line.character === chosenRole
                return (
                  <div key={line.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: '10px' }}>
                    <div style={{ maxWidth: '65%', background: isMine ? '#312E81' : '#1E293B', borderRadius: '14px', padding: '12px 16px' }}>
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>{line.character}</div>
                      <div style={{ fontSize: '14px' }}>{line.text}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 현재 대사 박스 */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '820px', background: '#0F172A', border: isMyTurn ? '2px solid #2563EB' : '2px solid #10B981', borderRadius: '22px', padding: '34px', boxShadow: '0 15px 35px rgba(0,0,0,0.18)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: isMyTurn ? '#2563EB' : '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                    {isMyTurn ? '나' : '🤖'}
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: '800' }}>{activeLine.character}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '3px' }}>대사 #{activeLine.id}</div>
                  </div>
                </div>

                <div style={{ padding: '8px 13px', borderRadius: '10px', background: '#111827', color: getEmotionColor(activeLine.emotion), fontWeight: '800', fontSize: '13px' }}>
                  {getEmotionEmoji(activeLine.emotion)} {activeLine.emotion?.toUpperCase()}
                </div>
              </div>

              <div style={{ fontSize: '26px', lineHeight: '1.6', fontWeight: '700', color: '#F8FAFC', textAlign: 'center', padding: '30px 20px' }}>
                "{activeLine.text}"
              </div>

              {/* 대사 다시 듣기 버튼 */}
              {!isMyTurn && (
                <div style={{ textAlign: 'center', marginTop: '-10px', marginBottom: '20px' }}>
                  <button
                    type="button"
                    onClick={() => playLineOnRobot(activeLine)}   // 다시 듣기도 로봇으로 재생 (실패 시 화면 경고)
                    disabled={ttsLoading}                          // 로봇이 말하는 중 연타 방지
                    style={{
                      background: '#1E293B',
                      border: '1px solid #334155',
                      color: '#93C5FD',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: ttsLoading ? 'not-allowed' : 'pointer',   // 재생 중엔 클릭 불가 커서
                      opacity: ttsLoading ? 0.4 : 1,                    // 재생 중엔 흐리게 표시
                    }}
                  >
                    🔊 대사 다시 듣기
                  </button>
                </div>
              )}

              {/* 평가 상태 */}
              {isEvaluating && (
                <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: '#172554', color: '#93C5FD', textAlign: 'center', fontWeight: '700' }}>
                  🔍 Azure가 발음을 분석하고 있습니다...
                </div>
              )}

              {/* 평가 결과 */}
              {currentScore && (
                <div style={{ marginTop: '24px', paddingTop: '22px', borderTop: '1px solid #1E293B' }}>
                  <div style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '12px', textAlign: 'center' }}>
                    현재 대사 평가 결과
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <ScoreBox label="Accuracy" value={currentScore.accuracy} />
                    <ScoreBox label="Fluency" value={currentScore.fluency} />
                    <ScoreBox label="Pronunciation" value={currentScore.pronunciation} />
                  </div>
                  {activeLine.realTranscripts && (
                    <div style={{ marginTop: '16px', padding: '13px 15px', borderRadius: '10px', background: '#111827', fontSize: '13px', color: '#CBD5E1' }}>
                      <strong>인식된 문장:</strong> {activeLine.realTranscripts}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* 오른쪽 상태 패널 */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '16px', padding: '26px', textAlign: 'center' }}>
            <div style={{ width: '100px', height: '100px', margin: '0 auto 16px', borderRadius: '50%', border: `3px solid ${isRecording ? '#EF4444' : isMyTurn ? '#2563EB' : '#10B981'}`, background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '42px' }}>
              {isMyTurn ? '🎙️' : '🤖'}
            </div>
            <div style={{
                fontSize: '18px',
                fontWeight: '800',
                marginBottom: '7px',
                color: connWarning ? '#F87171' : undefined,   // 경고가 있을 때만 빨간색
              }}
            >
              {connWarning || robotStatus}                    {/* 경고 우선 표시, 없으면 말하기/듣기 모드 */}
            </div>
            <VolumeControl /> 
            <div style={{ fontSize: '12px', color: '#64748B' }}>
              {isMyTurn ? '버튼을 눌러 대사를 녹음하세요.' : 'AI 상대역의 대사를 듣고 다음으로 이동하세요.'}
            </div>
          </div>

          <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '16px', padding: '22px' }}>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '12px' }}>현재 감정</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '34px' }}>{getEmotionEmoji(currentRobotEmotion)}</div>
              <div>
                <div style={{ fontSize: '19px', fontWeight: '800', color: getEmotionColor(currentRobotEmotion), textTransform: 'uppercase' }}>
                  {currentRobotEmotion}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  이 감정을 살려 말해보세요.
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '16px', padding: '22px' }}>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '10px' }}>내 연습 진행</div>
            <div style={{ fontSize: '25px', fontWeight: '800' }}>
              {completedMyLines}
              <span style={{ color: '#64748B', fontSize: '15px' }}> / {totalMyLines}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
              평가 완료한 내 대사
            </div>
          </div>
        </aside>
      </div>

      {/* Footer 버튼 바 */}
      <footer style={{ background: '#0F172A', borderTop: '1px solid #1E293B', padding: '18px 28px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '18px' }}>
          <button
            onClick={handlePrevLine}
            disabled={currentLineIndex === 0 || isRecording || isEvaluating}
            style={{
              padding: '13px 22px',
              border: 'none',
              borderRadius: '10px',
              background: '#1E293B',
              color: '#FFFFFF',
              fontWeight: '700',
              cursor: currentLineIndex === 0 ? 'not-allowed' : 'pointer',
              opacity: currentLineIndex === 0 ? 0.4 : 1,
            }}
          >
            ⏮ 이전 대사
          </button>

          <button
            onClick={toggleRecording}
            disabled={!isMyTurn || isEvaluating || ttsLoading}
            style={{
              padding: '14px 48px',
              background: isEvaluating ? '#94A3B8' : isRecording ? '#DC2626' : '#EF4444',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '24px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: isMyTurn && !isEvaluating && !ttsLoading ? 'pointer' : 'not-allowed',
              opacity: !isMyTurn || isEvaluating || ttsLoading ? 0.4 : 1,
            }}
          >
            {isEvaluating ? '⏳ 평가 중...' : isRecording ? '🛑 녹음 중지' : '🎙️ 녹음 시작'}
          </button>

          {isLastLine ? (
            <button
              onClick={handleFinishPractice}
              disabled={isMyTurn && !currentScore}
              style={{
                padding: '13px 24px',
                border: 'none',
                borderRadius: '10px',
                background: isMyTurn && !currentScore ? '#334155' : '#10B981',
                color: '#FFFFFF',
                fontWeight: '800',
                cursor: isMyTurn && !currentScore ? 'not-allowed' : 'pointer',
              }}
            >
              연습 완료 🏁
            </button>
          ) : (
            <button
              onClick={handleNextLine}
              disabled={currentLineIndex === scriptData.length - 1 || isEvaluating || ttsLoading}
              style={{
                padding: '13px 22px',
                border: 'none',
                borderRadius: '10px',
                background: '#1E293B',
                color: '#FFFFFF',
                fontWeight: '700',
                cursor: isEvaluating || ttsLoading || currentLineIndex === scriptData.length - 1 ? 'not-allowed' : 'pointer',
                opacity: isEvaluating || ttsLoading || currentLineIndex === scriptData.length - 1 ? 0.4 : 1,
              }}
            >
              다음 대사 ⏭
            </button>
          )}
        </div>
      </footer>

      {/* 🌟 브라우저 오디오 권한 잠금 해제 오버레이 */}
      {!hasStarted && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(11, 18, 36, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#0F172A',
              border: '1px solid #1E293B',
              borderRadius: '24px',
              padding: '40px 48px',
              textAlign: 'center',
              maxWidth: '460px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎭</div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '10px' }}>연습 준비 완료!</h2>
            <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '28px', lineHeight: '1.6' }}>
              '{chosenRole}' 역할로 대화 연습을 시작합니다.
              <br />
              시작 버튼을 누르면 상대역의 대사가 재생됩니다.
            </p>

            <button
              type="button"
              onClick={() => {
                const unlockAudio = new Audio()
                unlockAudio.play().catch(() => {})
                setHasStarted(true)
              }}
              style={{
                width: '100%',
                padding: '14px 28px',
                background: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '800',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
              }}
            >
              연습 시작하기 ▶
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// =========================================================
// 점수 카드
// =========================================================
function ScoreBox({ label, value }) {
  const scoreColor =
    value >= 85 ? '#10B981' : value >= 70 ? '#60A5FA' : value >= 60 ? '#F59E0B' : '#EF4444'

  return (
    <div
      style={{
        background: '#111827',
        borderRadius: '12px',
        padding: '15px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '22px',
          fontWeight: '900',
          color: scoreColor,
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: '11px',
          color: '#94A3B8',
          marginTop: '4px',
        }}
      >
        {label}
      </div>
    </div>
  )
}

export default PracticePage