import { useLocation, useNavigate} from 'react-router-dom'

function ResultPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const sessionScript =
    location.state?.fullSessionScript ||
    []

  const scriptId =
    location.state?.scriptId

  const scriptTitle =
    location.state?.scriptTitle ||
    '연습 결과'

  const chosenRole =
    location.state?.chosenRole ||
    ''

  const userLines =
    sessionScript.filter(
      (line) =>
        line.scores !== undefined &&
        line.scores !== null
    )

  const totalAccuracy =
    userLines.reduce(
      (acc, line) =>
        acc +
        (line.scores?.accuracy || 0),
      0
    )

  const totalFluency =
    userLines.reduce(
      (acc, line) =>
        acc +
        (line.scores?.fluency || 0),
      0
    )

  const totalPronunciation =
    userLines.reduce(
      (acc, line) =>
        acc +
        (
          line.scores
            ?.pronunciation || 0
        ),
      0
    )

  const lineCount =
    userLines.length || 1

  const avgAccuracy =
    Math.round(
      totalAccuracy / lineCount
    )

  const avgFluency =
    Math.round(
      totalFluency / lineCount
    )

  const avgPronunciation =
    Math.round(
      totalPronunciation /
        lineCount
    )

  const grandAverage =
    Math.round(
      (
        avgAccuracy +
        avgFluency +
        avgPronunciation
      ) / 3
    )

  const categoryScores = [
    {
      label:
        '종합 발음 정확도 (Accuracy)',
      score: userLines.length
        ? avgAccuracy
        : 0,
      color: '#2563EB'
    },
    {
      label:
        '리듬 및 유창성 (Fluency)',
      score: userLines.length
        ? avgFluency
        : 0,
      color: '#8B5CF6'
    },
    {
      label:
        '음소 조음 대조 (Pronunciation)',
      score: userLines.length
        ? avgPronunciation
        : 0,
      color: '#10B981'
    }
  ]

  const getWordStyle = (
    errorType
  ) => {
    if (
      errorType ===
      'Mispronunciation'
    ) {
      return {
        color: '#F59E0B',
        bg: '#FEF3C7'
      }
    }

    if (
      errorType === 'Omission'
    ) {
      return {
        color: '#EF4444',
        bg: '#FEE2E2'
      }
    }

    return {
      color: '#10B981',
      bg: '#D1FAE5'
    }
  }

  return (
    <div
      className="character-page"
      style={{
        backgroundColor:
          '#F8FAFC',
        minHeight: '100vh',
        paddingBottom: '60px',
        color: '#1E293B'
      }}
    >
      <header
        style={{
          background: '#FFFFFF',
          borderBottom:
            '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          padding: '20px 40px'
        }}
      >
        <button
          onClick={() =>
            navigate('/practice', {
              state: {
                scriptId,
                chosenRole
              }
            })
          }
        >
          ← 다시 연습하기
        </button>

        <div
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: '22px',
            fontWeight: '800'
          }}
        >
          Multi-Emotion Evaluation
          Report
        </div>
      </header>

      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '40px 20px'
        }}
      >
        <div
          style={{
            marginBottom: '28px'
          }}
        >
          <h1>
            {scriptTitle}
          </h1>

          <p>
            역할: {chosenRole}
          </p>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border:
              '1px solid #E2E8F0',
            borderRadius: '20px',
            padding: '32px',
            display: 'flex',
            alignItems: 'center',
            marginBottom: '32px'
          }}
        >
          <div
            style={{
              textAlign: 'center',
              paddingRight: '40px',
              borderRight:
                '1px solid #E2E8F0'
            }}
          >
            <div
              style={{
                fontSize: '64px',
                fontWeight: '900',
                color:
                  userLines.length
                    ? '#10B981'
                    : '#94A3B8'
              }}
            >
              {userLines.length
                ? grandAverage
                : 0}
            </div>

            <div>
              종합 평균
            </div>
          </div>

          <div
            style={{
              paddingLeft: '40px'
            }}
          >
            <h2>
              연습 결과 요약
            </h2>

            <p>
              {userLines.length}개 대사
              평가 완료
            </p>

            <p>
              Script ID:{' '}
              {scriptId || '-'}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '24px',
            marginBottom: '40px'
          }}
        >
          <div
            style={{
              flex: 1,
              background: '#FFFFFF',
              border:
                '1px solid #E2E8F0',
              borderRadius: '20px',
              padding: '28px'
            }}
          >
            <h3>
              영역별 획득 점수
            </h3>

            {categoryScores.map(
              (item) => (
                <div
                  key={item.label}
                  style={{
                    marginBottom:
                      '20px'
                  }}
                >
                  <div
                    style={{
                      display:
                        'flex',
                      justifyContent:
                        'space-between'
                    }}
                  >
                    <span>
                      {item.label}
                    </span>

                    <span>
                      {item.score}점
                    </span>
                  </div>

                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      background:
                        '#E2E8F0',
                      borderRadius:
                        '4px'
                    }}
                  >
                    <div
                      style={{
                        width: `${item.score}%`,
                        height:
                          '100%',
                        background:
                          item.color
                      }}
                    />
                  </div>
                </div>
              )
            )}
          </div>

          <div
            style={{
              flex: 1,
              background: '#FFFFFF',
              border:
                '1px solid #E2E8F0',
              borderRadius: '20px',
              padding: '28px'
            }}
          >
            <h3>
              감정 대사별 AI 피드백
            </h3>

            {userLines.map(
              (line) => (
                <div
                  key={line.id}
                  style={{
                    marginBottom:
                      '14px'
                  }}
                >
                  <strong>
                    대사 {line.id} -{' '}
                    {line.character}
                  </strong>

                  <div>
                    {line.aiFeedback ||
                      '피드백 없음'}
                  </div>
                </div>
              )
            )}

            {userLines.length ===
              0 && (
              <p>
                연습 평가 기록이
                없습니다.
              </p>
            )}
          </div>
        </div>

        <div>
          <h3>
            각 대사별 조음 음소
            피드백
          </h3>

          {userLines.map(
            (line) => (
              <div
                key={line.id}
                style={{
                  background:
                    '#FFFFFF',
                  border:
                    '1px solid #E2E8F0',
                  borderRadius:
                    '16px',
                  padding: '24px',
                  marginBottom:
                    '20px'
                }}
              >
                <div>
                  <strong>
                    "
                    {line.text}
                    "
                  </strong>
                </div>

                <p>
                  역할:{' '}
                  {line.character}
                  {' · '}
                  감정:{' '}
                  {line.emotion}
                  {' · '}
                  Accuracy{' '}
                  {
                    line.scores
                      ?.accuracy
                  }
                  {' · '}
                  Fluency{' '}
                  {
                    line.scores
                      ?.fluency
                  }
                  {' · '}
                  Pronunciation{' '}
                  {
                    line.scores
                      ?.pronunciation
                  }
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  {line.wordsDetail?.map(
                    (
                      word,
                      index
                    ) => {
                      const style =
                        getWordStyle(
                          word.error_type
                        )

                      return (
                        <span
                          key={index}
                          style={{
                            padding:
                              '6px 10px',
                            borderRadius:
                              '8px',
                            background:
                              style.bg,
                            color:
                              style.color
                          }}
                        >
                          {word.word}{' '}
                          (
                          {
                            word.accuracy
                          }
                          점)
                        </span>
                      )
                    }
                  )}
                </div>
              </div>
            )
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent:
              'center',
            gap: '16px',
            marginTop: '40px'
          }}
        >
          <button
            onClick={() =>
              navigate('/practice', {
                state: {
                  scriptId,
                  chosenRole
                }
              })
            }
          >
            다시 연습하기
          </button>

          <button
            onClick={() =>
              navigate('/upload')
            }
          >
            대본 목록으로
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResultPage