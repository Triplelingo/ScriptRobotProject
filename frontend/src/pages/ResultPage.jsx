import { useEffect, useMemo, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getLoggedInUser } from '../utils/auth'

function ResultPage() {
  const navigate = useNavigate()
  const location = useLocation()

  // Guard against React 18 StrictMode double-invoking the DB save
  const hasSavedRef = useRef(false)

  // =========================================================
  // 1. PracticePage에서 전달받은 현재 연습 정보
  // =========================================================
  const sessionScript = location.state?.fullSessionScript || []
  const scriptId = location.state?.scriptId
  const scriptTitleFromState = location.state?.scriptTitle || ''
  const chosenRoleFromState = location.state?.chosenRole || ''

  // HistoryPage의 "상세 보기"로 들어온 경우 사용
  const resultId = location.state?.resultId

  // =========================================================
  // 2. 과거 기록 조회 상태
  // =========================================================
  const [historyResult, setHistoryResult] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  // 현재 연습 결과 저장 상태
  const [saveStatus, setSaveStatus] = useState('')

  // =========================================================
  // 3. 실제 평가 완료된 사용자 대사만 추출
  // =========================================================
  const userLines = useMemo(() => {
    return sessionScript.filter(
      (line) => line.scores !== undefined && line.scores !== null
    )
  }, [sessionScript])

  // =========================================================
  // 4. 현재 연습 점수 계산
  // =========================================================
  const totalAccuracy = userLines.reduce(
    (acc, line) => acc + (line.scores?.accuracy || 0),
    0
  )

  const totalFluency = userLines.reduce(
    (acc, line) => acc + (line.scores?.fluency || 0),
    0
  )

  const totalPronunciation = userLines.reduce(
    (acc, line) => acc + (line.scores?.pronunciation || 0),
    0
  )

  const lineCount = userLines.length || 1

  const avgAccuracy = Math.round(totalAccuracy / lineCount)
  const avgFluency = Math.round(totalFluency / lineCount)
  const avgPronunciation = Math.round(totalPronunciation / lineCount)

  const grandAverage = Math.round(
    (avgAccuracy + avgFluency + avgPronunciation) / 3
  )

  // =========================================================
  // 다시 연습하기 (이전 평가 기록 초기화 후 전달)
  // =========================================================
  const handleRetryPractice = () => {
    const resetScript = (sessionScript || []).map((line) => {
      const { scores, realTranscripts, aiFeedback, wordsDetail, ...cleanLine } = line
      return cleanLine
    })

    navigate('/practice', {
      state: {
        scriptId: scriptId || location.state?.scriptId,
        scriptTitle: scriptTitleFromState || location.state?.scriptTitle,
        chosenRole: chosenRoleFromState || location.state?.chosenRole,
        customLines: resetScript,
      },
    })
  }

  // =========================================================
  // 5. 현재 실제 연습 결과를 MySQL에 자동 저장
  // =========================================================
  useEffect(() => {
    // 과거 기록 상세 보기 상태이거나 평가된 라인이 없는 경우 저장 건너뜀
    if (resultId) return
    if (userLines.length === 0) return

    // 중복 저장 방지 Guard
    if (hasSavedRef.current) return

    if (!scriptId) {
      console.error('연습 결과를 저장할 scriptId가 없습니다.')
      setSaveStatus('error')
      return
    }

    const loggedInUser = getLoggedInUser()

    if (!loggedInUser?.user_id) {
      console.error('로그인 사용자 정보를 찾을 수 없습니다.')
      setSaveStatus('login-error')
      return
    }

    hasSavedRef.current = true

    const savePracticeResult = async () => {
      try {
        setSaveStatus('saving')

        const response = await fetch('http://localhost:8000/practice-results', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: loggedInUser.user_id,
            script_id: scriptId,
            role_name: chosenRoleFromState,
            score: grandAverage,
            accuracy_score: avgAccuracy,
            fluency_score: avgFluency,
            pronunciation_score: avgPronunciation,
            practiced_lines: userLines.length,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(
            errorData.detail || '연습 결과 저장에 실패했습니다.'
          )
        }

        const data = await response.json()
        console.log('연습 결과 DB 저장 성공:', data)
        setSaveStatus('saved')
      } catch (error) {
        console.error('연습 결과 저장 오류:', error)
        setSaveStatus('error')
      }
    }

    savePracticeResult()
  }, [
    resultId,
    scriptId,
    chosenRoleFromState,
    grandAverage,
    avgAccuracy,
    avgFluency,
    avgPronunciation,
    userLines.length,
  ])

  // =========================================================
  // 6. HistoryPage 상세보기용 과거 결과 불러오기
  // =========================================================
  useEffect(() => {
    if (!resultId) return

    const fetchHistoryDetail = async () => {
      try {
        setHistoryLoading(true)
        setHistoryError('')

        const response = await fetch(
          `http://localhost:8000/practice-results/detail/${resultId}`
        )

        if (!response.ok) {
          throw new Error('연습 기록을 불러오지 못했습니다.')
        }

        const data = await response.json()
        setHistoryResult(data.result)
      } catch (error) {
        console.error('상세 기록 조회 실패:', error)
        setHistoryError('연습 상세 기록을 불러오지 못했습니다.')
      } finally {
        setHistoryLoading(false)
      }
    }

    fetchHistoryDetail()
  }, [resultId])

  // =========================================================
  // 7. 현재 결과 / 과거 결과 공통 출력 데이터
  // =========================================================
  const isHistoryMode = Boolean(resultId)

  const displayTitle = isHistoryMode
    ? historyResult?.title || '연습 기록'
    : scriptTitleFromState || '연습 결과'

  const displayRole = isHistoryMode
    ? historyResult?.role_name || '-'
    : chosenRoleFromState || '-'

  const displayScore = isHistoryMode
    ? historyResult?.score || 0
    : userLines.length
    ? grandAverage
    : 0

  const displayAccuracy = isHistoryMode
    ? historyResult?.accuracy_score || 0
    : userLines.length
    ? avgAccuracy
    : 0

  const displayFluency = isHistoryMode
    ? historyResult?.fluency_score || 0
    : userLines.length
    ? avgFluency
    : 0

  const displayPronunciation = isHistoryMode
    ? historyResult?.pronunciation_score || 0
    : userLines.length
    ? avgPronunciation
    : 0

  const displayLines = isHistoryMode
    ? historyResult?.practiced_lines || 0
    : userLines.length

  const categoryScores = [
    {
      label: '종합 발음 정확도 (Accuracy)',
      score: displayAccuracy,
      color: '#2563EB',
    },
    {
      label: '리듬 및 유창성 (Fluency)',
      score: displayFluency,
      color: '#8B5CF6',
    },
    {
      label: '음소 조음 대조 (Pronunciation)',
      score: displayPronunciation,
      color: '#10B981',
    },
  ]

  const getWordStyle = (errorType) => {
    if (errorType === 'Mispronunciation') {
      return { color: '#F59E0B', bg: '#FEF3C7' }
    }
    if (errorType === 'Omission') {
      return { color: '#EF4444', bg: '#FEE2E2' }
    }
    return { color: '#10B981', bg: '#D1FAE5' }
  }

  // =========================================================
  // 로딩 및 에러 화면
  // =========================================================
  if (isHistoryMode && historyLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8FAFC',
          color: '#64748B',
        }}
      >
        연습 기록을 불러오는 중입니다...
      </div>
    )
  }

  if (isHistoryMode && historyError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8FAFC',
          gap: '20px',
        }}
      >
        <h2>{historyError}</h2>
        <button onClick={() => navigate('/history')}>연습 기록으로 돌아가기</button>
      </div>
    )
  }

  return (
    <div
      className="character-page"
      style={{
        backgroundColor: '#F8FAFC',
        minHeight: '100vh',
        paddingBottom: '60px',
        color: '#1E293B',
        fontFamily: 'sans-serif',
      }}
    >
      {/* 상단 Header */}
      <header
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          padding: '20px 40px',
        }}
      >
        <button
          onClick={() => {
            if (isHistoryMode) {
              navigate('/history')
            } else {
              handleRetryPractice()
            }
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748B',
            fontSize: '15px',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          ← {isHistoryMode ? '연습 기록으로' : '다시 연습하기'}
        </button>

        <div
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: '22px',
            fontWeight: '800',
            marginRight: '100px',
          }}
        >
          연습 결과
        </div>
      </header>

      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '40px 20px',
        }}
      >
      {/* 제목 */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <h1 
            style={{ 
              margin: '0 0 8px 0', 
              fontSize: '28px',
              fontWeight: '800',
              color: '#0F172A' // 🌟 Explicit dark color so it doesn't blend into the light background
            }}
          >
            {displayTitle}
          </h1>
          <p style={{ margin: 0, color: '#475569', fontSize: '15px', fontWeight: '600' }}>
            역할: {displayRole}
          </p>
        </div>

        {/* 저장 상태 표시 */}
        {!isHistoryMode && saveStatus === 'saving' && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: '#EFF6FF',
              color: '#2563EB',
            }}
          >
            연습 기록을 저장하고 있습니다...
          </div>
        )}

        {!isHistoryMode && saveStatus === 'saved' && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: '#ECFDF5',
              color: '#047857',
            }}
          >
            ✓ 연습 기록이 저장되었습니다.
          </div>
        )}

        {!isHistoryMode && saveStatus === 'error' && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: '#FEF2F2',
              color: '#DC2626',
            }}
          >
            연습 결과를 저장하지 못했습니다.
          </div>
        )}

        {!isHistoryMode && saveStatus === 'login-error' && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: '#FEF2F2',
              color: '#DC2626',
            }}
          >
            로그인 사용자 정보를 찾을 수 없어 기록을 저장하지 못했습니다.
          </div>
        )}

        {/* 종합 점수 */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '20px',
            padding: '32px',
            display: 'flex',
            alignItems: 'center',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              paddingRight: '40px',
              borderRight: '1px solid #E2E8F0',
              minWidth: '130px',
            }}
          >
            <div
              style={{
                fontSize: '64px',
                fontWeight: '900',
                color:
                  displayScore >= 80
                    ? '#10B981'
                    : displayScore >= 60
                    ? '#2563EB'
                    : '#F59E0B',
                lineHeight: 1,
              }}
            >
              {displayScore}
            </div>
            <div
              style={{
                fontSize: '14px',
                color: '#64748B',
                marginTop: '8px',
                fontWeight: '600',
              }}
            >
              종합 평균
            </div>
          </div>

          <div style={{ paddingLeft: '40px', flex: 1 }}>
            <h2 
              style={{ 
                fontSize: '20px', 
                fontWeight: '800',
                margin: '0 0 16px 0',
                color: '#0F172A' // 🌟 Explicit dark color so it doesn't wash out inside the white card
              }}
            >
              연습 결과 요약
            </h2>

            <div style={{ display: 'flex', gap: '48px' }}>
              <div>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: '800',
                    color: '#2563EB',
                  }}
                >
                  {displayLines} 대사
                </div>
                <div style={{ fontSize: '13px', color: '#94A3B8' }}>평가 완료</div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: '800',
                    color: '#10B981',
                  }}
                >
                  {displayScore}점
                </div>
                <div style={{ fontSize: '13px', color: '#94A3B8' }}>
                  최종 종합 점수
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 영역별 점수 */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '20px',
            padding: '28px',
            marginBottom: '32px',
          }}
        >
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 24px 0' }}>
            영역별 획득 점수
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {categoryScores.map((item) => (
              <div key={item.label}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '7px',
                    fontWeight: '600',
                    fontSize: '14px',
                  }}
                >
                  <span>{item.label}</span>
                  <span>{item.score}점</span>
                </div>

                <div
                  style={{
                    height: '9px',
                    background: '#E2E8F0',
                    borderRadius: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${item.score}%`,
                      background: item.color,
                      borderRadius: '10px',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 대사별 AI 피드백 (현재 연습 세션일 때만 표시) */}
        {!isHistoryMode && (
          <>
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '20px',
                padding: '28px',
                marginBottom: '32px',
              }}
            >
              <h3 style={{ fontSize: '18px', margin: '0 0 20px 0' }}>
                감정 대사별 AI 피드백
              </h3>

              {userLines.map((line) => (
                <div
                  key={line.id}
                  style={{
                    padding: '14px 0',
                    borderBottom: '1px solid #F1F5F9',
                  }}
                >
                  <div style={{ fontWeight: '700', color: '#8B5CF6' }}>
                    대사 {line.id} · {line.character} · {line.emotion}
                  </div>
                  <div
                    style={{
                      marginTop: '6px',
                      color: '#475569',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {line.aiFeedback || 'AI 피드백이 없습니다.'}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>
                각 대사별 발음 피드백
              </h3>

              {userLines.map((line) => (
                <div
                  key={line.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: '18px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: '20px',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '58px',
                        height: '58px',
                        flexShrink: 0,
                        borderRadius: '50%',
                        background: '#2563EB',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                      }}
                    >
                      {line.scores?.pronunciation || 0}
                    </div>

                    <div>
                      <div style={{ fontWeight: '700', marginBottom: '6px' }}>
                        "{line.text}"
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748B' }}>
                        Accuracy {line.scores?.accuracy || 0}점 · Fluency{' '}
                        {line.scores?.fluency || 0}점 · Pronunciation{' '}
                        {line.scores?.pronunciation || 0}점
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      borderTop: '1px solid #F1F5F9',
                      marginTop: '18px',
                      paddingTop: '16px',
                    }}
                  >
                    {line.wordsDetail?.map((word, index) => {
                      const wordStyle = getWordStyle(word.error_type)
                      return (
                        <span
                          key={index}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            background: wordStyle.bg,
                            color: wordStyle.color,
                            fontSize: '13px',
                            fontWeight: '600',
                          }}
                        >
                          {word.word} ({Math.round(word.accuracy)}점)
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 과거 상세 기록 안내 */}
        {isHistoryMode && (
          <div
            style={{
              padding: '18px',
              background: '#EFF6FF',
              borderRadius: '12px',
              color: '#475569',
              fontSize: '14px',
            }}
          >
            이 기록은 MySQL에 저장된 실제 연습 결과입니다. 현재 DB에는 종합 점수와
            영역별 점수까지만 저장하고 있기 때문에 과거 세션의 대사별 AI 피드백은
            표시되지 않습니다.
          </div>
        )}

        {/* 하단 버튼 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
            marginTop: '40px',
          }}
        >
          {isHistoryMode ? (
            <button
              onClick={() => navigate('/history')}
              style={{
                width: '180px',
                padding: '14px',
                border: 'none',
                borderRadius: '12px',
                background: '#2563EB',
                color: '#FFFFFF',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              연습 기록으로
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleRetryPractice}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                다시 연습하기 🔄
              </button>

              <button
                type="button"
                onClick={() => navigate('/upload')}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#1E293B',
                  color: '#FFFFFF',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                대본 목록으로
              </button>

              <button
                onClick={() => navigate('/history')}
                style={{
                  width: '180px',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  fontWeight: '700',
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                연습 기록 보기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResultPage