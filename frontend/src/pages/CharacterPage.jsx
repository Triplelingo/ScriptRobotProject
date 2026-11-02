import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

function CharacterPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const scriptId = location.state?.scriptId || 1
  const initialTitle =
    location.state?.scriptTitle ||
    'Multi-Emotion Evaluation Bench'

  const [scriptTitle, setScriptTitle] =
    useState(initialTitle)

  const [characterList, setCharacterList] =
    useState([])

  const [selected, setSelected] =
    useState('')

  const [totalLines, setTotalLines] =
    useState(0)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  // =========================================================
  // 감정 Badge 설정 (기존 스타일 그대로 유지)
  // =========================================================
  const getEmotionBadgeStyle = (emotion) => {
    switch (emotion?.toLowerCase()) {
      case 'joy':
        return {
          bg: '#FEF3C7',
          color: '#D97706',
          emoji: '😊',
          label: 'JOY'
        }

      case 'fear':
        return {
          bg: '#E0E7FF',
          color: '#4F46E5',
          emoji: '😨',
          label: 'FEAR'
        }

      case 'surprise':
        return {
          bg: '#FCE7F3',
          color: '#DB2777',
          emoji: '😲',
          label: 'SURPRISE'
        }

      case 'anger':
        return {
          bg: '#FEE2E2',
          color: '#DC2626',
          emoji: '😡',
          label: 'ANGER'
        }

      case 'sadness':
        return {
          bg: '#E0F2FE',
          color: '#0284C7',
          emoji: '😢',
          label: 'SADNESS'
        }

      case 'disgust':
        return {
          bg: '#D1FAE5',
          color: '#059669',
          emoji: '🤢',
          label: 'DISGUST'
        }

      default:
        return {
          bg: '#F1F5F9',
          color: '#475569',
          emoji: '😐',
          label: 'NEUTRAL'
        }
    }
  }

  // =========================================================
  // 인물별 통계 및 감정 데이터 파싱 헬퍼 함수
  // =========================================================
  const processLines = (lines) => {
    if (!lines || lines.length === 0) {
      setCharacterList([])
      setTotalLines(0)
      setSelected('')
      setError('대본에서 등장인물을 찾을 수 없습니다.')
      setLoading(false)
      return
    }

    setTotalLines(lines.length)

    // 등장인물 중복 제거
    const distinctNames = Array.from(
      new Set(
        lines.map(
          (line) => line.character
        ).filter(Boolean)
      )
    )

    if (distinctNames.length === 0) {
      setCharacterList([])
      setTotalLines(0)
      setSelected('')
      setError('대본에서 등장인물을 찾을 수 없습니다.')
      setLoading(false)
      return
    }

    // 인물별 정보 및 감정 목록 생성
    const dynamicCharacters = distinctNames.map((name, index) => {
      const charLines = lines.filter((line) => line.character === name)

      const charEmotions = Array.from(
        new Set(
          charLines.map((line) => line.emotion || 'neutral')
        )
      )

      return {
        id: index + 1,
        name,
        linesCount: charLines.length,
        emotions: charEmotions,
        avatar: index % 2 === 0 ? '🎭' : '🎬'
      }
    })

    setCharacterList(dynamicCharacters)
    setSelected(dynamicCharacters[0]?.name || '')
    setLoading(false)
  }

  // =========================================================
  // 대본 등장인물 데이터 불러오기
  // =========================================================
  useEffect(() => {
    // 🌟 PreviewPage에서 수정한 감정 대본이 전달된 경우 그대로 사용
    if (location.state?.customLines && location.state.customLines.length > 0) {
      if (location.state?.scriptTitle) {
        setScriptTitle(location.state.scriptTitle)
      }
      processLines(location.state.customLines)
      return
    }

    // 수정본이 없는 경우 백엔드에서 원본 데이터 fetch
    const fetchCharacters = async () => {
      try {
        setLoading(true)
        setError('')

        const response = await fetch(
          `http://localhost:8000/api/scripts/${scriptId}`
        )

        if (!response.ok) {
          throw new Error('대본 정보를 가져오지 못했습니다.')
        }

        const data = await response.json()
        const lines = data.lines || []

        if (data.title) setScriptTitle(data.title)
        processLines(lines)
      } catch (err) {
        console.error('Failed to load character list:', err)
        setError('등장인물 정보를 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchCharacters()
  }, [scriptId, location.state])

  // =========================================================
  // 선택된 캐릭터 & 모드
  // =========================================================
  const selectedCharacter =
    characterList.find(
      (character) =>
        character.name === selected
    )

  const isListenOnly = selected === 'LISTEN_ONLY'

  // =========================================================
  // 연습 시작
  // =========================================================
  const handleStartPractice = () => {
    if (!selected) {
      alert('연습할 역할을 선택해 주세요.')
      return
    }

    navigate('/practice', {
      state: {
        scriptId: scriptId,
        scriptTitle: scriptTitle,
        chosenRole: selected, // 'LISTEN_ONLY' 또는 선택된 캐릭터 이름 전달
        customLines: location.state?.customLines // 수정된 감정 데이터를 PracticePage로 계속 전달
      }
    })
  }

  // =========================================================
  // Loading
  // =========================================================
  if (loading) {
    return (
      <div
        style={{
          backgroundColor: '#F8FAFC',
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎭</div>
          <h2 style={{ color: '#475569', fontSize: '18px' }}>
            등장인물을 분석하고 있습니다...
          </h2>
        </div>
      </div>
    )
  }

  // =========================================================
  // Error
  // =========================================================
  if (error) {
    return (
      <div
        style={{
          backgroundColor: '#F8FAFC',
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>⚠️</div>
          <h2>{error}</h2>
          <button
            onClick={() => navigate('/upload')}
            style={{
              marginTop: '20px',
              padding: '12px 20px',
              border: 'none',
              borderRadius: '10px',
              background: '#2563EB',
              color: '#FFFFFF',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            대본 목록으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="character-page"
      style={{
        backgroundColor: '#F8FAFC',
        minHeight: '100vh',
        color: '#1E293B',
        fontFamily: 'sans-serif',
        paddingBottom: '80px'
      }}
    >
      {/* =====================================================
          대본 제목 영역
      ===================================================== */}
      <div
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0'
        }}
      >
        <div
          style={{
            maxWidth: '1000px',
            margin: '0 auto',
            padding: '22px 20px',
            display: 'flex',
            alignItems: 'center',
            position: 'relative'
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              position: 'absolute',
              left: '20px',
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            ← 돌아가기
          </button>

          <div
            style={{
              textAlign: 'center',
              width: '100%'
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: '#94A3B8',
                fontWeight: '700',
                marginBottom: '4px'
              }}
            >
              연습 대본
            </div>

            <div
              style={{
                fontSize: '20px',
                fontWeight: '800'
              }}
            >
              {scriptTitle}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          Main
      ===================================================== */}
      <section
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '50px 20px'
        }}
      >
        {/* 제목 */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '34px'
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 18px',
              borderRadius: '18px',
              background: '#DBEAFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px'
            }}
          >
            🎭
          </div>

          <h2
            style={{
              fontSize: '28px',
              fontWeight: '800',
              color: '#0F172A',
              marginBottom: '8px',
              textAlign: 'center'
            }}
          >
            등장인물 배정
          </h2>

          <p
            style={{
              fontSize: '16px',
              color: '#64748B',
              margin: 0
            }}
          >
            내가 연기할 역할을 선택하거나, 대사 듣기만 진행할 수 있습니다.
            <br />
            선택하지 않은 인물은 AI가 자동으로 연기합니다.
          </p>
        </div>

        {/* =====================================================
            대본 요약
        ===================================================== */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '18px 24px',
            marginBottom: '28px',
            display: 'flex',
            justifyContent: 'center',
            gap: '50px'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <strong
              style={{
                display: 'block',
                fontSize: '20px',
                color: '#2563EB'
              }}
            >
              {characterList.length}명
            </strong>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              등장인물
            </span>
          </div>

          <div
            style={{
              width: '1px',
              background: '#E2E8F0'
            }}
          />

          <div style={{ textAlign: 'center' }}>
            <strong
              style={{
                display: 'block',
                fontSize: '20px',
                color: '#10B981'
              }}
            >
              {totalLines}줄
            </strong>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              전체 대사
            </span>
          </div>
        </div>

        {/* =====================================================
            캐릭터 선택 목록
        ===================================================== */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {characterList.map((character) => {
            const isSelected = selected === character.name

            return (
              <div
                key={character.name}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(character.name)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    setSelected(character.name)
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '22px',
                  background: '#FFFFFF',
                  border: isSelected
                    ? '2px solid #2563EB'
                    : '1px solid #E2E8F0',
                  borderRadius: '18px',
                  padding: '22px 26px',
                  cursor: 'pointer',
                  boxShadow: isSelected
                    ? '0 0 0 4px rgba(37, 99, 235, 0.08)'
                    : '0 2px 4px rgba(15, 23, 42, 0.02)',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: isSelected ? '#2563EB' : '#F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '27px',
                    flexShrink: 0
                  }}
                >
                  {character.avatar}
                </div>

                {/* 인물 정보 */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '6px'
                    }}
                  >
                    <h2
                      style={{
                        fontSize: '20px',
                        fontWeight: '800',
                        color: '#0F172A',
                        margin: 0
                      }}
                    >
                      {character.name}
                    </h2>

                    {isSelected && (
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: '20px',
                          background: '#DBEAFE',
                          color: '#2563EB',
                          fontSize: '11px',
                          fontWeight: '800'
                        }}
                      >
                        내 역할
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: '13px',
                      color: '#64748B'
                    }}
                  >
                    대사 {character.linesCount}개 ·{' '}
                    {isSelected
                      ? '사용자가 직접 연기'
                      : '선택 시 사용자가 연기'}
                  </div>
                </div>

                {/* 감정들 (Badge) */}
                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                    maxWidth: '310px'
                  }}
                >
                  {character.emotions.map((emotion) => {
                    const config = getEmotionBadgeStyle(emotion)

                    return (
                      <span
                        key={emotion}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          background: config.bg,
                          color: config.color,
                          fontSize: '11px',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>{config.emoji}</span>
                        <span>{config.label}</span>
                      </span>
                    )
                  })}
                </div>

                {/* 선택 표시 (Radio Checkbox) */}
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    border: isSelected
                      ? '2px solid #2563EB'
                      : '2px solid #CBD5E1',
                    background: isSelected ? '#2563EB' : '#FFFFFF',
                    color: '#FFFFFF',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: '14px',
                    fontWeight: '800',
                    flexShrink: 0
                  }}
                >
                  {isSelected ? '✓' : ''}
                </div>
              </div>
            )
          })}

          {/* =====================================================
              그냥 듣기 (말하기 기능 없음) 카드
          ===================================================== */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setSelected('LISTEN_ONLY')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                setSelected('LISTEN_ONLY')
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '22px',
              background: '#FFFFFF',
              border: isListenOnly
                ? '2px solid #2563EB'
                : '1px solid #E2E8F0',
              borderRadius: '18px',
              padding: '22px 26px',
              cursor: 'pointer',
              boxShadow: isListenOnly
                ? '0 0 0 4px rgba(37, 99, 235, 0.08)'
                : '0 2px 4px rgba(15, 23, 42, 0.02)',
              transition: 'all 0.15s ease'
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: isListenOnly ? '#2563EB' : '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '27px',
                flexShrink: 0
              }}
            >
              🎧
            </div>

            {/* 인물 정보 */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '6px'
                }}
              >
                <h2
                  style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: '#0F172A',
                    margin: 0
                  }}
                >
                  그냥 듣기 (말하기 기능 없음)
                </h2>

                {isListenOnly && (
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: '20px',
                      background: '#DBEAFE',
                      color: '#2563EB',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}
                  >
                    선택됨
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: '13px',
                  color: '#64748B'
                }}
              >
                녹음이나 발화 평가 없이, AI의 자연스러운 대화 음성을 연속해서 청취합니다.
              </div>
            </div>

            {/* 배지 */}
            <div
              style={{
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                maxWidth: '310px'
              }}
            >
              <span
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: '#F1F5F9',
                  color: '#475569',
                  fontSize: '11px',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>🎙️</span>
                <span>마이크 미사용</span>
              </span>
            </div>

            {/* 선택 표시 */}
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                border: isListenOnly
                  ? '2px solid #2563EB'
                  : '2px solid #CBD5E1',
                background: isListenOnly ? '#2563EB' : '#FFFFFF',
                color: '#FFFFFF',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '14px',
                fontWeight: '800',
                flexShrink: 0
              }}
            >
              {isListenOnly ? '✓' : ''}
            </div>
          </div>
        </div>

        {/* =====================================================
            선택 완료 영역
        ===================================================== */}
        {selected && (
          <div
            style={{
              marginTop: '28px',
              padding: '18px 22px',
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '14px',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                fontSize: '14px',
                color: '#1E40AF'
              }}
            >
              선택한 모드
            </div>

            <div
              style={{
                fontSize: '20px',
                fontWeight: '800',
                color: '#1D4ED8',
                marginTop: '4px'
              }}
            >
              {isListenOnly ? '🎧 그냥 듣기 (말하기 기능 없음)' : selectedCharacter?.name}
            </div>

            <div
              style={{
                fontSize: '13px',
                color: '#64748B',
                marginTop: '5px'
              }}
            >
              {isListenOnly
                ? '모든 대사를 AI 음성으로 연속해서 감상합니다.'
                : `${selectedCharacter?.linesCount}개의 대사를 직접 연습합니다.`}
            </div>
          </div>
        )}

        {/* =====================================================
            연습 버튼
        ===================================================== */}
        <button
          onClick={handleStartPractice}
          disabled={!selected}
          style={{
            display: 'block',
            margin: '32px auto 0',
            width: '100%',
            maxWidth: '420px',
            padding: '17px',
            border: 'none',
            borderRadius: '14px',
            backgroundColor: selected ? '#2563EB' : '#CBD5E1',
            color: '#FFFFFF',
            fontSize: '18px',
            fontWeight: '800',
            cursor: selected ? 'pointer' : 'not-allowed',
            boxShadow: selected
              ? '0 4px 12px rgba(37, 99, 235, 0.2)'
              : 'none'
          }}
        >
          {selected
            ? isListenOnly
              ? '🎧 그냥 듣기 모드로 시작'
              : `${selected} 역할로 연습 시작`
            : '연습할 역할을 선택하세요'}
        </button>
      </section>
    </div>
  )
}

export default CharacterPage