import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

function PreviewPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const scriptId = location.state?.scriptId || 1

  const [scriptTitle, setScriptTitle] = useState('')
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')
  const [editingId, setEditingId] = useState(null)
  const [editedCount, setEditedCount] = useState(0)

  // Standard emotion list matching your UI
  const emotions = [
    { name: 'joy', emoji: '😊' },
    { name: 'sadness', emoji: '😢' },
    { name: 'anger', emoji: '😡' },
    { name: 'fear', emoji: '😨' },
    { name: 'surprise', emoji: '😲' },
    { name: 'disgust', emoji: '🤢' },
    { name: 'neutral', emoji: '😐' }
  ]

  useEffect(() => {
    const fetchScript = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/scripts/${scriptId}`)
        if (!res.ok) throw new Error('대본을 불러오지 못했습니다.')

        const data = await res.json()
        setScriptTitle(data.title)
        setLines(data.lines || [])
      } catch (err) {
        console.error('Failed to load preview script:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchScript()
  }, [scriptId])

  const uniqueCharacters = Array.from(new Set(lines.map(line => line.character)))
  const charactersFilterList = ['전체', ...uniqueCharacters]

  const filteredLines =
    filter === '전체'
      ? lines
      : lines.filter(line => line.character === filter)

  // 🌟 Handles changing emotion instantly
  const changeEmotion = (id, newEmotion) => {
    setLines(prevLines =>
      prevLines.map(line =>
        line.id === id ? { ...line, emotion: newEmotion } : line
      )
    )
    setEditedCount(prev => prev + 1)
    setEditingId(null) // Close the menu
  }

  const getEmoji = (emotion) => {
    return emotions.find(e => e.name === emotion?.toLowerCase())?.emoji || '😐'
  }

  if (loading) {
    return (
      <div className="preview-page" style={{ padding: '40px', textAlign: 'center' }}>
        <h2>대본 분석 데이터를 불러오는 중입니다...</h2>
      </div>
    )
  }

  return (
    <div className="preview-page">
      <div className="preview-header">
        <div>
          <h1>파싱된 대본 미리보기: {scriptTitle}</h1>
          <p>
            자동 분석된 등장인물·감정 분류 결과를 확인하세요.
            <strong> 감정 태그를 클릭</strong>하면 화면에서 수정할 수 있습니다.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="preview-summary">
        <div className="summary-box">
          👥 <strong>{uniqueCharacters.length}명</strong>
          <span>등장인물</span>
        </div>
        <div className="summary-box">
          💬 <strong>{lines.length}줄</strong>
          <span>총 대사</span>
        </div>
        <div className="summary-box">
          🎭 <strong>완료</strong>
          <span>감정 분류</span>
        </div>
        <div className="summary-box">
          ✏️ <strong>{editedCount}건</strong>
          <span>수동 수정</span>
        </div>
      </div>

      {/* Character Analysis */}
      <div className="character-analysis">
        <h2>등장인물 분석</h2>
        <div className="analysis-cards">
          {uniqueCharacters.map((charName, idx) => {
            const charLines = lines.filter(line => line.character === charName)
            const charEmotions = Array.from(new Set(charLines.map(line => line.emotion)))
            const isFirst = idx % 2 === 0

            return (
              <div key={charName} className="analysis-card">
                <div className={isFirst ? 'avatar blue' : 'avatar purple'}>
                  {charName[0]}
                </div>
                <h3>{charName}</h3>
                <p>대사 {charLines.length}줄</p>
                <div>
                  {charEmotions.map(emotion => (
                    <span key={emotion} className={`emotion-chip ${emotion}`}>
                      {getEmoji(emotion)} {emotion}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filter */}
      <div className="filter-row">
        <span>필터:</span>
        {charactersFilterList.map(char => (
          <button
            key={char}
            className={filter === char ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter(char)}
          >
            {char}
          </button>
        ))}
      </div>

      {/* Dialogue Table */}
      <table className="preview-table">
        <thead>
          <tr>
            <th>#</th>
            <th>인물</th>
            <th>대사</th>
            <th>감정 (클릭 수정)</th>
          </tr>
        </thead>
        <tbody>
          {filteredLines.map(line => (
            <tr key={line.id}>
              <td>{line.id}</td>
              <td>
                <div className="character-cell">
                  <span
                    className={
                      line.character === uniqueCharacters[0]
                        ? 'mini-avatar blue'
                        : 'mini-avatar purple'
                    }
                  >
                    {line.character[0]}
                  </span>
                  {line.character}
                </div>
              </td>
              <td>{line.text}</td>

              {/* 🌟 Emotion Cell */}
              <td className="emotion-cell">
                <button
                  type="button"
                  className={`emotion-button ${line.emotion}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingId(editingId === line.id ? null : line.id)
                  }}
                >
                  <span className="emotion-emoji">{getEmoji(line.emotion)}</span>
                  <span className="emotion-name">{line.emotion}</span>
                </button>

                {/* 🌟 Floating White Dropdown Box (Matching your exact screenshot) */}
                {editingId === line.id && (
                  <div 
                    className="emotion-menu" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="emotion-menu-title">감정 선택</p>
                    <div className="emotion-menu-list">
                      {emotions.map(emo => {
                        const isSelected = line.emotion?.toLowerCase() === emo.name.toLowerCase()
                        return (
                          <button
                            key={emo.name}
                            type="button"
                            className={`emotion-option ${isSelected ? 'selected' : ''}`}
                            onClick={() => changeEmotion(line.id, emo.name)}
                          >
                            <span className="option-label">
                              <span className="option-emoji">{emo.emoji}</span>
                              <span className="option-text">{emo.name}</span>
                            </span>
                            {isSelected && <span className="option-check">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Navigation */}
      <div className="preview-buttons">
        <button
          className="go-character-btn"
          onClick={() =>
            navigate('/character', {
              state: {
                scriptId,
                scriptTitle,
                characters: uniqueCharacters,
                customLines: lines // 🌟 Passes edited emotions forward!
              }
            })
          }
        >
          인물 배정으로 →
        </button>

        <button className="go-upload-btn" onClick={() => navigate('/upload')}>
          대본 목록으로
        </button>
      </div>
    </div>
  )
}

export default PreviewPage