import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function UploadPage() {
  const navigate = useNavigate()

  const [selectedCategory, setSelectedCategory] = useState('전체')

  const recentScripts = [
    {
      id: 1,
      title: 'Romeo and Juliet - Act 2',
      characters: '등장인물 2명',
      lines: '대사 6줄',
      date: '2026-04-10',
      status: '분석 완료',
      category: '영화/드라마',
      level: '중급',
      duration: '약 5분'
    },
    {
      id: 2,
      title: 'The Importance of Being Earnest',
      characters: '등장인물 2명',
      lines: '대사 32줄',
      date: '2026-04-08',
      status: '분석 완료',
      category: '영화/드라마',
      level: '중급',
      duration: '약 10분'
    },
    {
      id: 3,
      title: 'Emotion Practice Script',
      characters: '등장인물 2명',
      lines: '대사 5줄',
      date: '2026-04-05',
      status: '분석 중',
      category: '감정연습',
      level: '초급',
      duration: '약 3분'
    },
    {
      id: 4,
      title: 'The Devil Wears Prada - Miranda & Emily',
      characters: '등장인물 2명',
      lines: '대사 12줄',
      date: '2026-09-09',
      status: '분석 완료',
      category: '영화/드라마',
      level: '중급',
      duration: '약 6분'
    },
    {
      id: 5,
      title: 'Job Interview Practice',
      characters: '등장인물 2명 (Interviewer, Applicant)',
      lines: '대사 28줄',
      date: '2026-09-11',
      status: '분석 완료',
      category: '면접',
      level: '중급',
      duration: '약 10분'
    },
    {
      id: 6,
      title: 'Topic Speaking Interview (OPIc)',
      characters: '등장인물 2명 (Examiner, Student)',
      lines: '대사 28줄',
      date: '2026-09-11',
      status: '분석 완료',
      category: 'OPIc',
      level: '중급',
      duration: '약 10분'
    },
    {
      id: 7,
      title: 'Daily Conversation - Meeting a Friend',
      characters: '등장인물 2명 (Mia, Jake)',
      lines: '대사 23줄',
      date: '2026-09-11',
      status: '분석 완료',
      category: '일상회화',
      level: '초급',
      duration: '약 7분'
    },
    {
      id: 8,
      title: 'Daily Conversation - At a Cafe',
      characters: '등장인물 2명 (Staff, Sophie)',
      lines: '대사 9줄',
      date: '2026-09-11',
      status: '분석 완료',
      category: '일상회화',
      level: '초급',
      duration: '약 5분'
    },
    {
      id: 9,
      title: 'Daily Conversation - Shopping for Clothes',
      characters: '등장인물 3명 (Sarah, Friend, Staff)',
      lines: '대사 38줄',
      date: '2026-09-11',
      status: '분석 완료',
      category: '일상회화',
      level: '중급',
      duration: '약 12분'
    }
  ]

  const categories = [
    '전체',
    '일상회화',
    '면접',
    'OPIc',
    '영화/드라마'
  ]

  // 분석 완료된 대본만 가져오기
  const completedScripts = recentScripts.filter(
    (script) => script.status === '분석 완료'
  )

  // 카테고리까지 적용
  const filteredScripts = completedScripts.filter((script) => {
    if (selectedCategory === '전체') {
      return true
    }

    return script.category === selectedCategory
  })

  const handlePreview = (script) => {
    navigate('/preview', {
      state: {
        scriptId: script.id,
        scriptTitle: script.title
      }
    })
  }

  const handlePractice = (script) => {
    navigate('/character', {
      state: {
        scriptId: script.id,
        scriptTitle: script.title
      }
    })
  }

  return (
    <div className="upload-page">

      <div className="page-header">
        <h1>대본 목록</h1>
        <p>연습할 대본을 선택하세요.</p>
      </div>

      <section className="recent-section">

        {/* 카테고리 버튼 */}
        <div className="category-tabs">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={
                selectedCategory === category
                  ? 'category-btn active'
                  : 'category-btn'
              }
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {/* 현재 보이는 대본 개수 */}
        <div className="script-count">
          총 {filteredScripts.length}개의 대본
        </div>

        {/* 대본 목록 */}
        <div className="script-list">
          {filteredScripts.length > 0 ? (
            filteredScripts.map((script) => (
              <div className="script-card" key={script.id}>

                <div className="script-icon">
                  📝
                </div>

                <div className="script-info">
                  <h3>{script.title}</h3>

                  <p className="script-meta">
                    {script.category}
                    {' · '}
                    {script.level}
                    {' · '}
                    {script.duration}
                  </p>

                  <p className="script-detail">
                    {script.characters}
                    {' · '}
                    {script.lines}
                    {' · '}
                    {script.date}
                  </p>
                </div>

                <span className="status-chip complete">
                  분석 완료
                </span>

                <div className="script-actions">

                  <button
                    type="button"
                    className="preview-btn"
                    onClick={() => handlePreview(script)}
                  >
                    미리보기
                  </button>

                  <button
                    type="button"
                    className="practice-btn"
                    onClick={() => handlePractice(script)}
                  >
                    연습 시작
                  </button>

                </div>

              </div>
            ))
          ) : (
            <div className="empty-script-message">
              해당 카테고리에 등록된 대본이 없습니다.
            </div>
          )}
        </div>

      </section>

    </div>
  )
}

export default UploadPage