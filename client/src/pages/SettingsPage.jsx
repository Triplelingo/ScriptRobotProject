import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function SettingsPage() {
  const navigate = useNavigate()

  // 1. Core Profile Mock Configuration Data
  const [userProfile] = useState({
    name: '사용자',
    email: 'user@example.com',
    avatarInitials: 'U'
  })

  // 2. Local Voice Telemetry Interactive States
  const savedSettings = JSON.parse(localStorage.getItem('ttsSettings') || '{}')
  const [ttsVoice, setTtsVoice] = useState(savedSettings.voice || 'Jenny')
  const [ttsSpeed, setTtsSpeed] = useState(savedSettings.speed || 1.0)
  const [micSensitivity, setMicSensitivity] = useState(savedSettings.micSensitivity || '보통 (권장)')

  const handleLogout = () => {
    // Perform any localized clearing loops here (e.g., localStorage.clear())
    // Routes back securely to your core landing or authentication structure link
    navigate('/login')
  }

  return (
    <div className="character-page" style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', paddingBottom: '80px', color: '#1E293B' }}>

      {/* Main Structural Core Content View Container */}
      <div className="character-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        
        {/* Page Title Header Block */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1E293B', margin: '0 0 8px 0' }}>설정</h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>연습 환경을 맞춤 설정하세요.</p>
        </div>

        {/* SECTION 2: Profile Metadata Identity Card Block */}
        <div className="character-analysis" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '28px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: '700', color: '#1E293B', marginBottom: '20px' }}>
            <span>👤</span>
            <span>프로필</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="character-avatar blue" style={{ width: '64px', height: '64px', fontSize: '24px', borderRadius: '50%', background: '#DBEAFE', color: '#2563EB', fontWeight: 'bold', margin: 0 }}>
                {userProfile.avatarInitials}
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#1E293B' }}>{userProfile.name}</div>
                <div style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>{userProfile.email}</div>
              </div>
            </div>

            <button className="edit-btn" style={{ padding: '10px 18px', border: '1px solid #E2E8F0', borderRadius: '10px', background: '#FFFFFF', color: '#475569', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginRight: 0 }}>
              프로필 수정
            </button>
          </div>
        </div>

        {/* SECTION 3: Audio Synthesis Options Configuration Card Block */}
        <div className="character-analysis" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '28px', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: '700', color: '#1E293B', marginBottom: '24px' }}>
            <span>📢</span>
            <span>음성 설정</span>
          </div>

          {/* Form Item Row Array 1: TTS Engine Target Voice selection Dropdown */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid #F1F5F9', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#1E293B' }}>TTS 음성</div>
              <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>로봇이 사용할 목소리를 선택합니다</div>
            </div>
            <select 
              className="search-box select"
              value={ttsVoice}
              onChange={(e) => {
                setTtsVoice(e.target.value)
                localStorage.setItem('ttsSettings', JSON.stringify({ voice: e.target.value, speed: ttsSpeed, micSensitivity }))
              }}
            >
              <option value="Jenny (여성)">Jenny (여성)</option>
              <option value="Guy (남성)">Guy (남성)</option>
            </select>
          </div>

          {/* Form Item Row Array 2: Dynamic TTS Multiplier Speech Rate Range Slider */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid #F1F5F9', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#1E293B' }}>TTS 속도</div>
              <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>로봇의 말하기 속도를 조절합니다</div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '240px' }}>
              <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '600' }}>느림</span>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1"
                value={ttsSpeed}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  setTtsSpeed(val)
                  localStorage.setItem('ttsSettings', JSON.stringify({ voice: ttsVoice, speed: val, micSensitivity }))
                }}
              />
              <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '600' }}>빠름</span>
              <span style={{ minWidth: '32px', textAlign: 'right', fontSize: '14px', fontWeight: '800', color: '#2563EB' }}>
                {ttsSpeed}x
              </span>
            </div>
          </div>

          {/* Form Item Row Array 3: Microphone VAD Sensitivity Selection Dropdown */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#1E293B' }}>마이크 감도 (VAD)</div>
              <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>음성 감지 민감도를 조절합니다</div>
            </div>
            <select 
              className="search-box select"
              value={micSensitivity}
              onChange={(e) => setMicSensitivity(e.target.value)}
              style={{ width: '160px', padding: '10px', fontSize: '14px', fontWeight: '600', color: '#1E293B', border: '1px solid #CBD5E1' }}
            >
              <option value="낮음">낮음</option>
              <option value="보통 (권장)">보통 (권장)</option>
              <option value="높음">높음</option>
            </select>
          </div>
        </div>

        {/* SECTION 4: Centered Red Primary Logout Button Block */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: '220px',
              padding: '14px 0',
              fontSize: '16px',
              fontWeight: '800',
              borderRadius: '12px',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            ← 연습 이어가기
          </button>
         
          <button 
            className="logout-btn" 
            onClick={handleLogout}
            style={{ 
              width: '220px', 
              padding: '14px 0', 
              fontSize: '16px', 
              fontWeight: '800', 
              borderRadius: '12px', 
              backgroundColor: '#EF4444', 
              color: '#FFFFFF',
              border: 'none',
              boxShadow: '0 4px 10px rgba(239, 68, 68, 0.2)',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}

            onClick={() => navigate('/')}
          >
            로그아웃 (Logout)
          </button>
        </div>

      </div>
    </div>
  )
}

export default SettingsPage