import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

function CharacterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { script_id, lines = [] } = location.state || {}
  const [selected, setSelected] = useState(null)

  // lines에서 캐릭터별 감정 목록 추출
  const characterMap = {}
  lines.forEach(line => {
    if (!characterMap[line.character]) {
      characterMap[line.character] = new Set()
    }
    characterMap[line.character].add(line.emotion)
  })

  const characters = Object.entries(characterMap).map(([name, emotions]) => ({
    name,
    emotions: [...emotions],
    gender: name === 'Alex' ? 'Male' : 'Female',
  }))

  const getEmotionBadgeStyle = (emotion) => {
    switch(emotion) {
      case 'joy': return { bg: '#FEF3C7', color: '#D97706', emoji: '😊' }
      case 'fear': return { bg: '#E0E7FF', color: '#4F46E5', emoji: '😨' }
      case 'surprise': return { bg: '#FCE7F3', color: '#DB2777', emoji: '😲' }
      case 'anger': return { bg: '#FEE2E2', color: '#DC2626', emoji: '😡' }
      case 'sadness': return { bg: '#E0F2FE', color: '#0284C7', emoji: '😢' }
      case 'disgust': return { bg: '#D1FAE5', color: '#059669', emoji: '🤢' }
      default: return { bg: '#F1F5F9', color: '#475569', emoji: '😐' }
    }
  }

  const handleStartPractice = () => {
    if (!selected) {
      alert('역할을 선택해주세요!')
      return
    }
    navigate('/practice', { state: { chosenRole: selected, script_id, lines } })
  }

  return (
    <div className="character-page" style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#1E293B', fontFamily: 'sans-serif' }}>
      <div className="script-title" style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', textAlign: 'center', padding: '26px', fontSize: '24px', fontWeight: '800' }}>
        등장인물 배정
      </div>

      <section className="character-container" style={{ maxWidth: '900px', margin: '0 auto', padding: '60px 20px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: '800', marginBottom: '12px', textAlign: 'center' }}>등장인물 배정</h1>
        <p style={{ fontSize: '18px', color: '#64748B', marginBottom: '48px', textAlign: 'center' }}>
          연습할 역할을 선택하세요. 나머지 역할은 로봇이 자동으로 수행합니다.
        </p>

        <div className="character-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {characters.map((character) => {
            const isSelected = selected === character.name
            return (
              <div
                key={character.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: '24px',
                  background: '#FFFFFF',
                  border: isSelected ? '3px solid #2563EB' : '1px solid #E2E8F0',
                  borderRadius: '20px', padding: '24px 32px', cursor: 'pointer',
                  boxShadow: isSelected ? '0 0 0 4px #DBEAFE' : '0 2px 4px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setSelected(character.name)}
              >
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: isSelected ? '#2563EB' : '#E2E8F0',
                  color: isSelected ? '#FFFFFF' : '#64748B',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', fontWeight: 'bold', flexShrink: 0
                }}>
                  {character.name === 'Alex' ? '👨' : '👩'}
                </div>

                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 4px 0' }}>
                    {character.name} <span style={{ fontSize: '14px', color: '#94A3B8', fontWeight: 'normal' }}>({character.gender})</span>
                  </h2>
                  <span style={{ fontSize: '14px', color: '#64748B' }}>{character.description}</span>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxWidth: '340px', justifyContent: 'flex-end' }}>
                  {character.emotions.map((emotion) => {
                    const styleConfig = getEmotionBadgeStyle(emotion)
                    return (
                      <span key={emotion} style={{
                        padding: '6px 12px', borderRadius: '8px', fontSize: '12px',
                        fontWeight: '700', textTransform: 'uppercase',
                        background: styleConfig.bg, color: styleConfig.color,
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        border: `1px solid ${styleConfig.color}40`
                      }}>
                        <span>{styleConfig.emoji}</span>
                        <span>{emotion}</span>
                      </span>
                    )
                  })}
                </div>

                {isSelected && (
                  <strong style={{ color: '#2563EB', fontSize: '16px', marginLeft: '12px', whiteSpace: 'nowrap' }}>
                    ✓ 선택됨
                  </strong>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={handleStartPractice}
          style={{
            display: 'block', margin: '48px auto 0', width: '100%', maxWidth: '400px',
            padding: '18px', border: 'none', borderRadius: '16px',
            backgroundColor: '#2563EB', color: '#FFFFFF', fontSize: '20px',
            fontWeight: '800', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)', transition: 'background-color 0.15s'
          }}
        >
          연습 시작하기
        </button>

        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'block',
            margin: '16px auto 0',
            width: '100%',
            maxWidth: '400px',
            padding: '14px',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            backgroundColor: '#FFFFFF',
            color: '#64748B',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          ← 뒤로가기
        </button>
      </section>
    </div>
  )
}

export default CharacterPage