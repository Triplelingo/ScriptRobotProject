import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function UploadPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [scripts, setScripts] = useState([])
  const navigate = useNavigate()

  // DB에서 대본 목록 불러오기
  useEffect(() => {
    fetch("http://localhost:8000/api/scripts")
      .then(res => res.json())
      .then(data => setScripts(data))
      .catch(err => console.error("대본 목록 불러오기 실패:", err))
  }, [])

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setSelectedFile(file)

    const text = await file.text()
    const user = JSON.parse(localStorage.getItem('loginUser') || '{}')

    try {
      const res = await fetch("http://localhost:8000/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.user_id || 1,
          title: file.name.replace('.txt', ''),
          content: text
        })
      })
      const data = await res.json()
      if (data.success) {
        fetch("http://localhost:8000/api/scripts")
          .then(r => r.json())
          .then(d => setScripts(d))
      }
    } catch (err) {
      console.error("업로드 실패:", err)
    }
  }

  return (
    <div className="upload-page">
      <h1>대본 업로드</h1>
      <p>
        영어 대본 파일(.txt)을 업로드하면
        등장인물과 감정을 자동으로 분석합니다.
      </p>
      <label className="upload-box">
        <input
          type="file"
          accept=".txt"
          hidden
          onChange={handleFileChange}
        />
        <div>
          <h2>파일을 클릭하여 업로드</h2>
          <p>.txt 파일만 업로드 가능</p>
          {selectedFile && (
            <div className="file-name">
              업로드 파일: {selectedFile.name}
            </div>
          )}
        </div>
      </label>

      <section className="recent-section">
        <h2>최근 업로드된 대본</h2>
        <div className="script-list">
          {scripts.map((script) => (
            <div className="script-card" key={script.script_id}>
              <div className="script-icon">📝</div>
              <div className="script-info">
                <h3>{script.title}</h3>
                <p>{script.created_at}</p>
              </div>
              <span className="status-chip">
                {script.status || '분석 중'}
              </span>
              <button
                className="practice-btn"
                disabled={script.status !== '분석 완료'}
                style={{
                  opacity: script.status !== '분석 완료' ? 0.4 : 1,
                  cursor: script.status !== '분석 완료' ? 'not-allowed' : 'pointer'
                }}
                onClick={() => script.status === '분석 완료' && navigate('/preview', { state: { script_id: script.script_id } })}
              >
                {script.status !== '분석 완료' ? '분석 중...' : '연습 시작'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default UploadPage