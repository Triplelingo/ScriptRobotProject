import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function UploadPage() {
  const navigate = useNavigate()

  // ========================================
  // 대본 목록 State
  // ========================================

  const [selectedCategory, setSelectedCategory] = useState('전체')
  const [recentScripts, setRecentScripts] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // ========================================
  // 업로드 State
  // ========================================

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('일상회화')
  const [uploadLevel, setUploadLevel] = useState('초급')
  const [uploadFile, setUploadFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  // ========================================
  // 삭제 State
  // ========================================

  const [deletingScriptId, setDeletingScriptId] = useState(null)

  // ========================================
  // 카테고리
  // ========================================

  const categories = [
    '전체',
    '일상회화',
    '면접',
    'OPIc',
    '영화/드라마'
  ]

  // ========================================
  // DB에서 대본 목록 가져오기
  // ========================================


  const fetchScripts = async () => {
  try {
    setIsLoading(true)

    const response = await fetch(
      'http://localhost:8000/scripts'
    )

    if (!response.ok) {
      throw new Error('대본 목록을 불러오지 못했습니다.')
    }

    const data = await response.json()

    const formattedScripts = data.map((script) => {
      const content = script.content || ''

      const dialogueLines = content
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line.trim())
        .filter(
          (line) =>
            line.length > 0 &&
            line.includes(':')
        )

      const characters = new Set()

      dialogueLines.forEach((line) => {
        const character = line
          .split(':', 1)[0]
          .trim()

        if (character) {
          characters.add(character)
        }
      })

      const estimatedMinutes = Math.max(
        1,
        Math.ceil(dialogueLines.length / 3)
      )

      return {
        id: script.script_id,
        title: script.title,

        category: script.category,
        level: script.level,

        characters: `등장인물 ${characters.size}명`,
        lines: `대사 ${dialogueLines.length}줄`,
        duration: `약 ${estimatedMinutes}분`,

        date: script.created_at
          ? String(script.created_at).substring(0, 10)
          : '',

        status: '분석 완료'
      }
    })

    setRecentScripts(formattedScripts)

  } catch (error) {
    console.error('대본 목록 조회 오류:', error)
  } finally {
    setIsLoading(false)
  }
}

useEffect(() => {
  fetchScripts()
}, [])

  // ========================================
  // 분석 완료된 대본
  // ========================================

  const completedScripts = recentScripts.filter(
    (script) =>
      script.status === '분석 완료'
  )

  // ========================================
  // 카테고리 필터
  // ========================================

  const filteredScripts = completedScripts.filter(
    (script) => {

      if (selectedCategory === '전체') {
        return true
      }

      return (
        script.category === selectedCategory
      )
    }
  )

  // ========================================
  // 미리보기
  // ========================================

  const handlePreview = (script) => {
    navigate('/preview', {
      state: {
        scriptId: script.id,
        scriptTitle: script.title
      }
    })
  }

  // ========================================
  // 연습 시작
  // ========================================

  const handlePractice = (script) => {
    navigate('/character', {
      state: {
        scriptId: script.id,
        scriptTitle: script.title
      }
    })
  }

  // ========================================
  // 대본 삭제
  // ========================================

  const handleDelete = async (script) => {

    const confirmed = window.confirm(
      `"${script.title}" 대본을 삭제하시겠습니까?\n\n삭제한 대본은 복구할 수 없습니다.`
    )

    if (!confirmed) {
      return
    }

    try {
      setDeletingScriptId(script.id)

      const response = await fetch(
        `http://localhost:8000/scripts/${script.id}`,
        {
          method: 'DELETE'
        }
      )

      if (!response.ok) {

        let message =
          '대본 삭제에 실패했습니다.'

        try {
          const errorData =
            await response.json()

          if (errorData.detail) {
            message = errorData.detail
          }

        } catch {
          // JSON 응답이 아니면 기본 메시지 사용
        }

        throw new Error(message)
      }

      console.log(
        '대본 삭제 성공:',
        script.id
      )

      // DB에서 최신 목록 다시 불러오기
      await fetchScripts()

      alert('대본이 삭제되었습니다.')

    } catch (error) {

      console.error(
        '대본 삭제 오류:',
        error
      )

      alert(
        error.message ||
        '대본 삭제 중 오류가 발생했습니다.'
      )

    } finally {

      setDeletingScriptId(null)

    }
  }

  // ========================================
  // 업로드 모달 닫기
  // ========================================

  const closeUploadModal = () => {

    if (isUploading) {
      return
    }

    setShowUploadModal(false)
  }

  // ========================================
  // 대본 업로드
  // ========================================

  const handleUpload = async (e) => {
    e.preventDefault()

    // 제목 확인
    if (!uploadTitle.trim()) {
      alert('대본 제목을 입력해주세요.')
      return
    }

    // 파일 확인
    if (!uploadFile) {
      alert('대본 파일을 선택해주세요.')
      return
    }

    // ========================================
    // TXT 파일 확인
    // ========================================

    const extension = uploadFile.name
      .split('.')
      .pop()
      .toLowerCase()

    if (extension !== 'txt') {
      alert(
        '현재는 TXT 파일만 업로드할 수 있습니다.'
      )
      return
    }

    // ========================================
    // 로그인 사용자 확인
    // ========================================

    let loginUser = null

    try {
      const savedUser =
        localStorage.getItem('loginUser')

      if (savedUser) {
        loginUser = JSON.parse(savedUser)
      }

    } catch (error) {

      console.error(
        '로그인 정보 읽기 오류:',
        error
      )

    }

    if (!loginUser || !loginUser.user_id) {
      alert('로그인이 필요합니다.')
      return
    }

    // ========================================
    // FormData
    // ========================================

    const formData = new FormData()

    formData.append(
      'user_id',
      loginUser.user_id
    )

    formData.append(
      'title',
      uploadTitle.trim()
    )

    formData.append(
      'category',
      uploadCategory
    )

    formData.append(
      'level',
      uploadLevel
    )

    formData.append(
      'file',
      uploadFile
    )

    // ========================================
    // 서버 업로드
    // ========================================

    try {
      setIsUploading(true)

      const response = await fetch(
        'http://localhost:8000/scripts/upload',
        {
          method: 'POST',
          body: formData
        }
      )

      // 실패
      if (!response.ok) {

        let message =
          '대본 업로드에 실패했습니다.'

        try {
          const errorData =
            await response.json()

          if (errorData.detail) {
            message = errorData.detail
          }

        } catch {
          // JSON 응답이 아닐 경우
        }

        throw new Error(message)
      }

      // 성공 결과
      const data = await response.json()

      console.log(
        '대본 업로드 성공:',
        data
      )

      // 입력 초기화
      setUploadTitle('')
      setUploadCategory('일상회화')
      setUploadLevel('초급')
      setUploadFile(null)

      // 모달 닫기
      setShowUploadModal(false)

      // 전체 탭으로 변경
      setSelectedCategory('전체')

      // DB에서 최신 목록 가져오기
      await fetchScripts()

      alert(
        '대본이 성공적으로 업로드되었습니다.'
      )

    } catch (error) {

      console.error(
        '대본 업로드 오류:',
        error
      )

      alert(
        error.message ||
        '대본 업로드 중 오류가 발생했습니다.'
      )

    } finally {

      setIsUploading(false)

    }
  }

  // ========================================
  // 화면
  // ========================================

  return (
    <div className="upload-page">

      {/* ==================================
          페이지 헤더
      ================================== */}

      <div className="page-header">

        <div className="page-header-text">

          <h1>
            대본 목록
          </h1>

          <p>
            연습할 대본을 선택하세요.
          </p>

        </div>

        <button
          type="button"
          className="upload-script-btn"
          onClick={() =>
            setShowUploadModal(true)
          }
        >
          + 대본 업로드
        </button>

      </div>

      {/* ==================================
          대본 목록
      ================================== */}

      <section className="recent-section">

        {/* 카테고리 */}

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
              onClick={() =>
                setSelectedCategory(category)
              }
            >
              {category}
            </button>

          ))}

        </div>

        {/* ==================================
            로딩
        ================================== */}

        {isLoading ? (

          <div className="empty-script-message">
            대본을 불러오는 중입니다...
          </div>

        ) : (

          <>

            {/* 대본 개수 */}

            <div className="script-count">
              총 {filteredScripts.length}개의 대본
            </div>

            {/* 대본 카드 */}

            <div className="script-list">

              {filteredScripts.length > 0 ? (

                filteredScripts.map((script) => (

                  <div
                    className="script-card"
                    key={script.id}
                  >

                    {/* 아이콘 */}

                    <div className="script-icon">
                      📝
                    </div>

                    {/* 대본 정보 */}

                    <div className="script-info">

                      <h3>
                        {script.title}
                      </h3>

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

                    {/* 분석 상태 */}

                    <span className="status-chip complete">
                      분석 완료
                    </span>

                    {/* ==================================
                        버튼
                    ================================== */}

                    <div className="script-actions">

                      {/* 미리보기 */}

                      <button
                        type="button"
                        className="preview-btn"
                        onClick={() =>
                          handlePreview(script)
                        }
                      >
                        미리보기
                      </button>

                      {/* 연습 시작 */}

                      <button
                        type="button"
                        className="practice-btn"
                        onClick={() =>
                          handlePractice(script)
                        }
                      >
                        연습 시작
                      </button>

                      {/* 삭제 */}

                      <button
                        type="button"
                        className="delete-script-btn"
                        disabled={
                          deletingScriptId === script.id
                        }
                        onClick={() =>
                          handleDelete(script)
                        }
                      >

                        {deletingScriptId === script.id
                          ? '삭제 중...'
                          : '삭제'}

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

          </>

        )}

      </section>

      {/* ==================================
          대본 업로드 모달
      ================================== */}

      {showUploadModal && (

        <div
          className="upload-modal-overlay"
          onClick={closeUploadModal}
        >

          <div
            className="upload-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* 모달 헤더 */}

            <div className="upload-modal-header">

              <h2>
                대본 업로드
              </h2>

              <button
                type="button"
                className="modal-close-btn"
                onClick={closeUploadModal}
                disabled={isUploading}
              >
                ×
              </button>

            </div>

            {/* ==================================
                업로드 Form
            ================================== */}

            <form onSubmit={handleUpload}>

              {/* 제목 */}

              <div className="form-group">

                <label htmlFor="script-title">
                  대본 제목
                </label>

                <input
                  id="script-title"
                  type="text"
                  value={uploadTitle}
                  onChange={(e) =>
                    setUploadTitle(
                      e.target.value
                    )
                  }
                  placeholder="예: Daily Conversation - At a Restaurant"
                  disabled={isUploading}
                />

              </div>

              {/* 카테고리 */}

              <div className="form-group">

                <label htmlFor="script-category">
                  카테고리
                </label>

                <select
                  id="script-category"
                  value={uploadCategory}
                  onChange={(e) =>
                    setUploadCategory(
                      e.target.value
                    )
                  }
                  disabled={isUploading}
                >

                  <option value="일상회화">
                    일상회화
                  </option>

                  <option value="면접">
                    면접
                  </option>

                  <option value="OPIc">
                    OPIc
                  </option>

                  <option value="영화/드라마">
                    영화/드라마
                  </option>

                </select>

              </div>

              {/* 난이도 */}

              <div className="form-group">

                <label htmlFor="script-level">
                  난이도
                </label>

                <select
                  id="script-level"
                  value={uploadLevel}
                  onChange={(e) =>
                    setUploadLevel(
                      e.target.value
                    )
                  }
                  disabled={isUploading}
                >

                  <option value="초급">
                    초급
                  </option>

                  <option value="중급">
                    중급
                  </option>

                  <option value="고급">
                    고급
                  </option>

                </select>

              </div>

              {/* TXT 파일 */}

              <div className="form-group">

                <label htmlFor="script-file">
                  대본 파일
                </label>

                <input
                  id="script-file"
                  type="file"
                  accept=".txt"
                  onChange={(e) =>
                    setUploadFile(
                      e.target.files?.[0] ||
                      null
                    )
                  }
                  disabled={isUploading}
                />

                <span className="file-help">
                  TXT 파일을 업로드해주세요.
                </span>

                {/* 선택한 파일 */}

                {uploadFile && (

                  <div className="selected-file">

                    <span>
                      📄 {uploadFile.name}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setUploadFile(null)
                      }
                      disabled={isUploading}
                    >
                      삭제
                    </button>

                  </div>

                )}

              </div>

              {/* ==================================
                  모달 버튼
              ================================== */}

              <div className="upload-modal-actions">

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={closeUploadModal}
                  disabled={isUploading}
                >
                  취소
                </button>

                <button
                  type="submit"
                  className="submit-upload-btn"
                  disabled={isUploading}
                >

                  {isUploading
                    ? '업로드 중...'
                    : '업로드'}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  )
}

export default UploadPage