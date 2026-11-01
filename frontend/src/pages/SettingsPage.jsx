import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function SettingsPage() {
  const navigate = useNavigate()

  // =========================================================
  // 1. 로그인 사용자 정보
  // =========================================================
  const [userProfile, setUserProfile] = useState({
    name: '사용자',
    nickname: '',
    email: '',
    avatarInitials: 'U'
  })

  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editName, setEditName] = useState('')
  const [editNickname, setEditNickname] = useState('')

  // =========================================================
  // 2. 음성 설정
  // =========================================================
  const [ttsSpeed, setTtsSpeed] = useState(1.0)
  const [micSensitivity, setMicSensitivity] = useState('normal')
  const [saved, setSaved] = useState(false)

  // =========================================================
  // 3. 로그인 정보 + 기존 설정 불러오기
  // =========================================================
  useEffect(() => {
    const possibleKeys = ['loginUser', 'user', 'currentUser']
    let foundUser = null

    for (const key of possibleKeys) {
      const value = localStorage.getItem(key)
      if (!value) continue

      try {
        const parsed = JSON.parse(value)
        if (parsed?.user?.user_id) {
          foundUser = parsed.user
          break
        }
        if (parsed?.user_id) {
          foundUser = parsed
          break
        }
      } catch (error) {
        console.error(`${key} 사용자 정보 파싱 실패:`, error)
      }
    }

    if (foundUser) {
      const displayName = foundUser.nickname || foundUser.name || '사용자'
      const initialProfile = {
        name: foundUser.name || '사용자',
        nickname: foundUser.nickname || '',
        email: foundUser.email || '',
        avatarInitials: displayName.charAt(0).toUpperCase() || 'U'
      }
      setUserProfile(initialProfile)
      setEditName(initialProfile.name)
      setEditNickname(initialProfile.nickname)
    }

    const savedSettings = localStorage.getItem('practiceSettings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        if (parsed.ttsSpeed) setTtsSpeed(parsed.ttsSpeed)
        if (parsed.micSensitivity) setMicSensitivity(parsed.micSensitivity)
      } catch (error) {
        console.error('설정 불러오기 실패:', error)
      }
    }
  }, [])

  // =========================================================
  // 4. 설정 저장
  // =========================================================
  const handleSaveSettings = () => {
    const settings = {
      ttsSpeed,
      micSensitivity
    }

    localStorage.setItem('practiceSettings', JSON.stringify(settings))

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
    }, 2000)
  }

  // =========================================================
  // 5. 프로필 수정 저장
  // =========================================================
  const handleSaveProfile = async () => {
    const possibleKeys = ['loginUser', 'user', 'currentUser']
    let currentUserId = null

    for (const key of possibleKeys) {
      const item = localStorage.getItem(key)
      if (!item) continue
      try {
        const parsed = JSON.parse(item)
        if (parsed?.user?.user_id) {
          currentUserId = parsed.user.user_id
          break
        }
        if (parsed?.user_id) {
          currentUserId = parsed.user_id
          break
        }
      } catch (e) {
        console.error(e)
      }
    }

    if (!currentUserId) {
      alert("로그인 사용자 정보를 찾을 수 없습니다.")
      return
    }

    const newName = editName.trim() || userProfile.name
    const newNickname = editNickname.trim()

    try {
      const response = await fetch("http://localhost:8000/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserId,
          name: newName,
          nickname: newNickname
        })
      })

      const data = await response.json()
      if (!response.ok) {
        alert(data.detail || "프로필 수정에 실패했습니다.")
        return
      }

      const updatedProfile = {
        ...userProfile,
        name: newName,
        nickname: newNickname,
        avatarInitials: (newNickname || newName || 'U').charAt(0).toUpperCase()
      }
      setUserProfile(updatedProfile)

      for (const key of possibleKeys) {
        const item = localStorage.getItem(key)
        if (item) {
          try {
            const parsed = JSON.parse(item)
            if (parsed.user) {
              parsed.user.name = newName
              parsed.user.nickname = newNickname
              localStorage.setItem(key, JSON.stringify(parsed))
            } else {
              parsed.name = newName
              parsed.nickname = newNickname
              localStorage.setItem(key, JSON.stringify(parsed))
            }
          } catch (e) {
            console.error(e)
          }
        }
      }

      alert("프로필이 성공적으로 변경되었습니다.")
      setIsEditingProfile(false)
    } catch (error) {
      console.error("Profile update failed:", error)
      alert("서버 연결에 실패했습니다.")
    }
  }

  // =========================================================
  // 6. 로그아웃
  // =========================================================
  const handleLogout = () => {
    localStorage.removeItem('loginUser')
    localStorage.removeItem('user')
    localStorage.removeItem('currentUser')
    navigate('/')
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
        className="character-container"
        style={{
          maxWidth: '850px',
          margin: '0 auto',
          padding: '52px 20px'
        }}
      >
        {/* =====================================================
            페이지 제목 + 상단 돌아가기 버튼
        ===================================================== */}
        <div style={{ marginBottom: '34px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1
              style={{
                fontSize: '30px',
                fontWeight: '800',
                color: '#1E293B',
                margin: '0 0 8px 0'
              }}
            >
              설정
            </h1>

            <p
              style={{
                fontSize: '14px',
                color: '#64748B',
                margin: 0
              }}
            >
              프로필과 연습 환경을 설정하세요.
            </p>
          </div>

          {/* 🌟 상단 대본 목록으로 바로가기 버튼 */}
          <button
            type="button"
            onClick={() => navigate('/upload')}
            style={{
              padding: '10px 18px',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>📜</span>
            <span>대본 목록으로</span>
          </button>
        </div>

        {/* =====================================================
            프로필
        ===================================================== */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '18px',
            padding: '28px',
            marginBottom: '24px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '17px',
              fontWeight: '800',
              marginBottom: '24px'
            }}
          >
            <span>👤</span>
            <span>프로필</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '18px'
              }}
            >
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: '#DBEAFE',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '26px',
                  fontWeight: '800',
                  flexShrink: 0
                }}
              >
                {userProfile.avatarInitials}
              </div>

              <div>
                <div
                  style={{
                    fontSize: '19px',
                    fontWeight: '800',
                    marginBottom: '5px'
                  }}
                >
                  {userProfile.nickname || userProfile.name}
                </div>

                {userProfile.nickname && (
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#94A3B8',
                      marginBottom: '3px'
                    }}
                  >
                    {userProfile.name}
                  </div>
                )}

                <div
                  style={{
                    fontSize: '14px',
                    color: '#64748B'
                  }}
                >
                  {userProfile.email || '이메일 정보 없음'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditingProfile(true)}
              style={{
                padding: '10px 18px',
                border: '1px solid #CBD5E1',
                borderRadius: '10px',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              프로필 수정
            </button>
          </div>
        </div>

        {/* =====================================================
            음성 설정 (TTS 속도 & 마이크 감도)
        ===================================================== */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '18px',
            padding: '28px',
            marginBottom: '24px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '17px',
              fontWeight: '800',
              marginBottom: '26px'
            }}
          >
            <span>🔊</span>
            <span>음성 설정</span>
          </div>

          {/* TTS 속도 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '24px',
              borderBottom: '1px solid #F1F5F9',
              marginBottom: '24px',
              gap: '30px'
            }}
          >
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700' }}>
                TTS 속도
              </div>
              <div style={{ fontSize: '13px', color: '#64748B', marginTop: '5px' }}>
                AI 상대역의 말하기 속도를 조절합니다.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '290px' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>느림</span>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={ttsSpeed}
                onChange={(e) => setTtsSpeed(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#2563EB', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>빠름</span>
              <strong style={{ color: '#2563EB', fontSize: '14px', minWidth: '38px', textAlign: 'right' }}>
                {ttsSpeed.toFixed(1)}x
              </strong>
            </div>
          </div>

          {/* 마이크 감도 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '30px'
            }}
          >
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700' }}>
                마이크 감도
              </div>
              <div style={{ fontSize: '13px', color: '#64748B', marginTop: '5px' }}>
                음성을 감지하는 민감도를 설정합니다.
              </div>
            </div>

            <select
              value={micSensitivity}
              onChange={(e) => setMicSensitivity(e.target.value)}
              style={{
                width: '180px',
                padding: '10px 12px',
                fontSize: '14px',
                fontWeight: '600',
                border: '1px solid #CBD5E1',
                borderRadius: '9px',
                background: '#FFFFFF',
                color: '#1E293B'
              }}
            >
              <option value="low">낮음</option>
              <option value="normal">보통 (권장)</option>
              <option value="high">높음</option>
            </select>
          </div>
        </div>

        {/* =====================================================
            설정 저장 및 네비게이션 버튼 영역
        ===================================================== */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '42px'
          }}
        >
          {saved && (
            <span
              style={{
                color: '#059669',
                fontSize: '14px',
                fontWeight: '700',
                marginRight: 'auto'
              }}
            >
              ✓ 설정이 저장되었습니다.
            </span>
          )}

          {/* 🌟 대본 목록으로 이동 버튼 */}
          <button
            type="button"
            onClick={() => navigate('/upload')}
            style={{
              padding: '12px 22px',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            대본 목록으로
          </button>

          {/* 설정 저장 버튼 */}
          <button
            type="button"
            onClick={handleSaveSettings}
            style={{
              padding: '12px 26px',
              border: 'none',
              borderRadius: '10px',
              background: '#2563EB',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: '800',
              cursor: 'pointer'
            }}
          >
            설정 저장
          </button>
        </div>

        {/* =====================================================
            계정
        ===================================================== */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '18px',
            padding: '28px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '17px',
              fontWeight: '800',
              marginBottom: '20px'
            }}
          >
            <span>🔐</span>
            <span>계정</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700' }}>
                로그아웃
              </div>
              <div style={{ fontSize: '13px', color: '#64748B', marginTop: '5px' }}>
                현재 계정에서 로그아웃합니다.
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: '10px 20px',
                border: '1px solid #FCA5A5',
                borderRadius: '10px',
                background: '#FFFFFF',
                color: '#DC2626',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================
          프로필 수정 모달 팝업
      ===================================================== */}
      {isEditingProfile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
          onClick={() => setIsEditingProfile(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              padding: '28px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '800' }}>
              프로필 수정
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: '#475569' }}>
                이름
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: '#475569' }}>
                닉네임
              </label>
              <input
                type="text"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2563EB',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsPage