import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

function PreviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const script_id = location.state?.script_id

  const [filter, setFilter] = useState('전체')
  const [editingId, setEditingId] = useState(null)
  const [editedCount, setEditedCount] = useState(0)
  const [title, setTitle] = useState('')
  const [lines, setLines] = useState([])
  const [characters, setCharacters] = useState(['전체'])

  const emotions = [
    { name: 'joy', emoji: '😊' },
    { name: 'sadness', emoji: '😢' },
    { name: 'anger', emoji: '😠' },
    { name: 'fear', emoji: '😨' },
    { name: 'surprise', emoji: '😮' },
    { name: 'disgust', emoji: '🤢' },
    { name: 'neutral', emoji: '😐' }
  ]

useEffect(() => {
  if (!script_id) return
  
  fetch(`http://localhost:8000/api/scripts/${script_id}`)
    .then(res => res.json())
    .then(async data => {
      setTitle(data.title)
      const chars = ['전체', ...new Set(data.lines.map(l => l.character))]
      setCharacters(chars)
      
      // script_lines에 저장
      await fetch(`http://localhost:8000/api/scripts/${script_id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: data.lines })
      })
      
      // 저장 후 line_id 포함해서 다시 불러오기
      const linesRes = await fetch(`http://localhost:8000/api/scripts/${script_id}/lines`)
      const linesData = await linesRes.json()
      setLines(linesData)
    })
    .catch(err => console.error("대본 불러오기 실패:", err))
}, [script_id])

  const filteredLines = filter === '전체' ? lines : lines.filter(l => l.character === filter)

  const changeEmotion = (line_id, emotion) => {
    setLines(lines.map(line => line.line_id === line_id ? { ...line, emotion } : line))
    setEditedCount(prev => prev + 1)
    setEditingId(null)
      
    // DB에 감정 업데이트
    fetch(`http://localhost:8000/api/lines/${line_id}/emotion`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emotion })
    }).catch(err => console.error("감정 업데이트 실패:", err))
  }

  const getEmoji = (emotion) => emotions.find(e => e.name === emotion)?.emoji

  return (
    <div className="preview-page">
      <div className="preview-header">
        <div>
          <h1>{title || '파싱된 대본 미리보기'}</h1>
          <p>
            자동 분석된 등장인물·감정 분류 결과를 확인하세요.
            <strong> 감정 태그를 클릭</strong>하면 수정할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="preview-summary">
        <div className="summary-box">👥 <strong>{characters.length - 1}명</strong><span>등장인물</span></div>
        <div className="summary-box">💬 <strong>{lines.length}줄</strong><span>총 대사</span></div>
        <div className="summary-box">🎭 <strong>완료</strong><span>감정 분류</span></div>
        <div className="summary-box">✏️ <strong>{editedCount}건</strong><span>수동 수정</span></div>
      </div>

      <div className="filter-row">
        <span>필터:</span>
        {characters.map(char => (
          <button
            key={char}
            className={filter === char ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter(char)}
          >
            {char}
          </button>
        ))}
      </div>

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
                  <span className="mini-avatar blue">{line.character[0]}</span>
                  {line.character}
                </div>
              </td>
              <td>{line.text}</td>
              <td className="emotion-cell">
                <button
                  className={`emotion-button ${line.emotion}`}
                  onClick={() => setEditingId(editingId === line.line_id ? null : line.line_id)}
                >
                  {getEmoji(line.emotion)} {line.emotion}
                </button>
                {editingId ===  line.line_id && (
                  <div className="emotion-menu">
                    <p>감정 선택</p>
                    {emotions.map(emo => (
                      <button
                        key={emo.name}
                        className={line.emotion === emo.name ? 'emotion-option selected' : 'emotion-option'}
                        onClick={() => changeEmotion(line.line_id, emo.name)}
                      >
                        <span>{emo.emoji}</span>
                        {emo.name}
                        {line.emotion === emo.name && <b>✓</b>}
                      </button>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="preview-buttons">
        <button
          className="go-character-btn"
          onClick={() => navigate('/character', { state: { script_id, lines } })}
        >
          인물 배정으로 →
        </button>
        <button
          className="go-upload-btn"
          onClick={() => navigate('/upload')}
        >
          대본 목록으로
        </button>
      </div>
    </div>
  )
}

export default PreviewPage