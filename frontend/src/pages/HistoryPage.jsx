import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function HistoryPage() {
  const navigate = useNavigate()

  const [sessionHistory, setSessionHistory] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  // =========================================================
  // 1. 로그인 사용자 가져오기
  // =========================================================
  const getLoggedInUser = () => {
    const possibleKeys = [
      'loginUser',
      'user',
      'currentUser'
    ]

    for (const key of possibleKeys) {
      const value = localStorage.getItem(key)

      if (!value) continue

      try {
        const parsed = JSON.parse(value)

        if (parsed?.user?.user_id) {
          return parsed.user
        }

        if (parsed?.user_id) {
          return parsed
        }
      } catch (error) {
        console.error(
          `${key} 로그인 정보 파싱 실패:`,
          error
        )
      }
    }

    return null
  }

  // =========================================================
  // 2. 실제 DB 연습 기록 불러오기
  // =========================================================
  useEffect(() => {
    const fetchPracticeHistory = async () => {
      const loggedInUser =
        getLoggedInUser()

      if (!loggedInUser?.user_id) {
        setError(
          '로그인 사용자 정보를 찾을 수 없습니다.'
        )

        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        const response = await fetch(
          `http://localhost:8000/practice-results/${loggedInUser.user_id}`
        )

        if (!response.ok) {
          throw new Error(
            '연습 기록 조회에 실패했습니다.'
          )
        }

        const data = await response.json()

        setSessionHistory(
          data.results || []
        )
      } catch (error) {
        console.error(
          '연습 기록 조회 오류:',
          error
        )

        setError(
          '연습 기록을 불러오지 못했습니다.'
        )
      } finally {
        setLoading(false)
      }
    }

    fetchPracticeHistory()
  }, [])

  // =========================================================
  // 3. 실제 데이터 통계 계산
  // =========================================================
  const totalSessions =
    sessionHistory.length

  const averageScore =
    totalSessions > 0
      ? Math.round(
          sessionHistory.reduce(
            (sum, item) =>
              sum + (item.score || 0),
            0
          ) / totalSessions
        )
      : 0

  const highestScore =
    totalSessions > 0
      ? Math.max(
          ...sessionHistory.map(
            (item) =>
              item.score || 0
          )
        )
      : 0

  const totalLinesPracticed =
    sessionHistory.reduce(
      (sum, item) =>
        sum +
        (item.practiced_lines || 0),
      0
    )

  // =========================================================
  // 4. 점수 색상
  // =========================================================
  const getScoreColor = (score) => {
    if (score >= 85) {
      return {
        background: '#D1FAE5',
        color: '#047857'
      }
    }

    if (score >= 70) {
      return {
        background: '#DBEAFE',
        color: '#1D4ED8'
      }
    }

    if (score >= 60) {
      return {
        background: '#FEF3C7',
        color: '#B45309'
      }
    }

    return {
      background: '#FEE2E2',
      color: '#DC2626'
    }
  }

  // =========================================================
  // 5. 날짜 출력
  // =========================================================
  const formatDate = (dateString) => {
    if (!dateString) return '-'

    const normalized =
      dateString.replace(' ', 'T')

    const date =
      new Date(normalized)

    if (Number.isNaN(date.getTime())) {
      return dateString
    }

    return date.toLocaleString(
      'ko-KR',
      {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }
    )
  }

  // =========================================================
  // 6. 로딩
  // =========================================================
  if (loading) {
    return (
      <div
        style={{
          minHeight: '70vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#64748B'
        }}
      >
        연습 기록을 불러오는 중입니다...
      </div>
    )
  }

  return (
    <div
      className="character-page"
      style={{
        backgroundColor: '#F8FAFC',
        minHeight: '100vh',
        paddingBottom: '80px',
        color: '#1E293B',
        fontFamily: 'sans-serif'
      }}
    >
      <div
        style={{
          maxWidth: '1040px',
          margin: '0 auto',
          padding: '40px 20px'
        }}
      >
        {/* =====================================================
            제목
        ===================================================== */}
        <div
          style={{
            marginBottom: '32px'
          }}
        >
          <h1
            style={{
              fontSize: '28px',
              fontWeight: '800',
              margin: '0 0 8px 0'
            }}
          >
            연습 기록
          </h1>

          <p
            style={{
              fontSize: '14px',
              color: '#64748B',
              margin: 0
            }}
          >
            실제 연습 세션과 발음 평가 기록을
            확인하세요.
          </p>
        </div>

        {/* 에러 */}
        {error && (
          <div
            style={{
              background: '#FEF2F2',
              color: '#DC2626',
              padding: '14px 18px',
              borderRadius: '10px',
              marginBottom: '24px'
            }}
          >
            {error}
          </div>
        )}

        {/* =====================================================
            통계 카드
        ===================================================== */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '20px',
            marginBottom: '48px'
          }}
        >
          {/* 총 연습 */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                fontSize: '24px',
                marginBottom: '8px'
              }}
            >
              📋
            </div>

            <strong
              style={{
                fontSize: '28px',
                color: '#2563EB'
              }}
            >
              {totalSessions}회
            </strong>

            <div
              style={{
                marginTop: '5px',
                fontSize: '13px',
                color: '#64748B',
                fontWeight: '600'
              }}
            >
              총 연습 횟수
            </div>
          </div>

          {/* 평균 */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                fontSize: '24px',
                marginBottom: '8px'
              }}
            >
              📊
            </div>

            <strong
              style={{
                fontSize: '28px',
                color: '#10B981'
              }}
            >
              {averageScore}점
            </strong>

            <div
              style={{
                marginTop: '5px',
                fontSize: '13px',
                color: '#64748B',
                fontWeight: '600'
              }}
            >
              평균 점수
            </div>
          </div>

          {/* 최고점 */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                fontSize: '24px',
                marginBottom: '8px'
              }}
            >
              🏆
            </div>

            <strong
              style={{
                fontSize: '28px',
                color: '#B45309'
              }}
            >
              {highestScore}점
            </strong>

            <div
              style={{
                marginTop: '5px',
                fontSize: '13px',
                color: '#64748B',
                fontWeight: '600'
              }}
            >
              최고 점수
            </div>
          </div>

          {/* 총 대사 */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                fontSize: '24px',
                marginBottom: '8px'
              }}
            >
              💬
            </div>

            <strong
              style={{
                fontSize: '28px',
                color: '#7C3AED'
              }}
            >
              {totalLinesPracticed}줄
            </strong>

            <div
              style={{
                marginTop: '5px',
                fontSize: '13px',
                color: '#64748B',
                fontWeight: '600'
              }}
            >
              총 연습 대사
            </div>
          </div>
        </div>

        {/* =====================================================
            세션 히스토리
        ===================================================== */}
        <div>
          <h2
            style={{
              fontSize: '19px',
              fontWeight: '800',
              marginBottom: '20px'
            }}
          >
            세션 히스토리
          </h2>

          {sessionHistory.length === 0 ? (
            <div
              style={{
                background: '#FFFFFF',
                border:
                  '1px dashed #CBD5E1',
                borderRadius: '16px',
                padding: '60px 20px',
                textAlign: 'center'
              }}
            >
              <div
                style={{
                  fontSize: '40px',
                  marginBottom: '14px'
                }}
              >
                🎙️
              </div>

              <h3
                style={{
                  margin:
                    '0 0 8px 0'
                }}
              >
                아직 저장된 연습 기록이
                없습니다.
              </h3>

              <p
                style={{
                  color: '#64748B',
                  marginBottom: '20px'
                }}
              >
                대본을 연습하고 완료하면 실제
                결과가 자동으로 여기에
                저장됩니다.
              </p>

              <button
                onClick={() =>
                  navigate('/upload')
                }
                style={{
                  padding:
                    '11px 20px',
                  border: 'none',
                  borderRadius: '9px',
                  background: '#2563EB',
                  color: '#FFFFFF',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                연습 시작하기
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              {sessionHistory.map(
                (session) => {
                  const scoreStyle =
                    getScoreColor(
                      session.score
                    )

                  return (
                    <div
                      key={
                        session.result_id
                      }
                      style={{
                        background:
                          '#FFFFFF',
                        border:
                          '1px solid #E2E8F0',
                        borderRadius:
                          '16px',
                        padding:
                          '20px 24px',
                        display: 'flex',
                        alignItems:
                          'center',
                        gap: '20px'
                      }}
                    >
                      {/* 점수 */}
                      <div
                        style={{
                          width: '54px',
                          height: '54px',
                          borderRadius:
                            '50%',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems:
                            'center',
                          justifyContent:
                            'center',
                          background:
                            scoreStyle.background,
                          color:
                            scoreStyle.color,
                          fontSize:
                            '17px',
                          fontWeight:
                            '800'
                        }}
                      >
                        {session.score}
                      </div>

                      {/* 정보 */}
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0
                        }}
                      >
                        <h3
                          style={{
                            fontSize:
                              '16px',
                            fontWeight:
                              '700',
                            margin:
                              '0 0 6px 0'
                          }}
                        >
                          {session.title ||
                            `대본 ${session.script_id}`}
                        </h3>

                        <div
                          style={{
                            fontSize:
                              '13px',
                            color:
                              '#64748B',
                            marginBottom:
                              '7px'
                          }}
                        >
                          {session.role_name ||
                            '역할 없음'}
                          {' · '}
                          대사{' '}
                          {
                            session.practiced_lines
                          }
                          줄
                          {' · '}
                          {formatDate(
                            session.practiced_at
                          )}
                        </div>

                        <div
                          style={{
                            display:
                              'flex',
                            gap: '16px',
                            flexWrap:
                              'wrap',
                            fontSize:
                              '12px',
                            color:
                              '#64748B'
                          }}
                        >
                          <span>
                            Accuracy{' '}
                            <b>
                              {
                                session.accuracy_score
                              }
                            </b>
                          </span>

                          <span>
                            Fluency{' '}
                            <b>
                              {
                                session.fluency_score
                              }
                            </b>
                          </span>

                          <span>
                            Pronunciation{' '}
                            <b>
                              {
                                session.pronunciation_score
                              }
                            </b>
                          </span>
                        </div>
                      </div>

                      {/* 상세 */}
                      <button
                        onClick={() =>
                          navigate(
                            '/result',
                            {
                              state: {
                                resultId:
                                  session.result_id
                              }
                            }
                          )
                        }
                        style={{
                          padding:
                            '9px 16px',
                          borderRadius:
                            '8px',
                          border:
                            '1px solid #CBD5E1',
                          background:
                            '#FFFFFF',
                          color:
                            '#475569',
                          fontWeight:
                            '700',
                          cursor:
                            'pointer',
                          flexShrink: 0
                        }}
                      >
                        상세 보기
                      </button>
                    </div>
                  )
                }
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HistoryPage