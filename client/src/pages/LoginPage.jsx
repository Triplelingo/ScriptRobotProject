import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()

    if (!email.includes('@')) {
      setError('올바른 이메일 형식을 입력해주세요.')
      return
    }

    if (!password) {
      setError('비밀번호를 입력해주세요.')
      return
    }

    setError('')

    try {
      const res = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      if (!res.ok) {
        throw new Error('서버와 통신 중 오류가 발생했습니다.')
      }

      const data = await res.json()

      if (!data.success) {
        setError(data.message)
        return
      }

      localStorage.setItem('loginUser', JSON.stringify(data.user))
      alert("Login success!")

      if (email === 'admin@example.com' && password === 'admin1234') {
        navigate('/admin')
      } else {
        navigate('/upload')
      }

    } catch (err) {
      console.error("Authentication handshake exception:", err)
      setError('서버가 오프라인 상태이거나 네트워크 연결에 실패했습니다.')
    }
  }

  return (
    <div className="auth-page" style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      backgroundColor: '#0F172A', 
      fontFamily: 'sans-serif',
      color: '#F8FAFC'
    }}>
      
      {/* 🌟 LEFT SIDE: PREMIUM BRAND HERO BANNER */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        overflow: 'hidden'
      }}>
        {/* Abstract Decorative Background Grid Effect */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse at center, black, transparent)'
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '520px' }}>
          <div style={{ display: 'inline-block', backgroundColor: '#2563EB', color: '#FFFFFF', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '700', marginBottom: '24px', letterSpacing: '0.5px' }}>
            TRIPLELINGO AI CORE
          </div>
          <h2 style={{ fontSize: '42px', fontWeight: '800', lineHeight: '1.2', marginBottom: '16px', color: '#FFFFFF' }}>
            멀티 모달 감정인식 <br />
            <span style={{ color: '#60A5FA' }}>회화 진단 시스템</span>
          </h2>
          <p style={{ fontSize: '16px', color: '#94A3B8', lineHeight: '1.6', marginBottom: '40px' }}>
            Azure 정밀 맞춤형 SSML 합성 음성과 로컬 AI 피드백을 통해 자연스러운 어조 변화와 발음 정확도를 실시간으로 평가받으세요.
          </p>

          {/* Value Highlights Feature Widgets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '24px', background: 'rgba(37,99,235,0.15)', padding: '10px', borderRadius: '12px' }}>🎭</div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#F1F5F9' }}>감정 기반 발화 시나리오</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>기쁨, 슬픔, 분노 등 다양한 정서적 톤 적용 연습</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '24px', background: 'rgba(37,99,235,0.15)', padding: '10px', borderRadius: '12px' }}>📊</div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#F1F5F9' }}>상세 발음 평가지표</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>정확도, 유창성, 완전성을 분석한 실시간 리포트</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 RIGHT SIDE: CLEAN LOGIN INTERFACE CARD CONTAINER */}
      <div style={{
        width: '100%',
        maxWidth: '540px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        backgroundColor: '#0B0F19',
        borderLeft: '1px solid #1E293B'
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', color: '#FFFFFF', letterSpacing: '-0.5px' }}>로그인</h1>
          <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '36px' }}>학습을 시작하려면 등록된 계정 정보를 입력하세요.</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#94A3B8' }}>이메일 주소</label>
              <input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '14px 16px', 
                  borderRadius: '10px', 
                  border: '1px solid #334155', 
                  backgroundColor: '#1E293B',
                  color: '#FFFFFF',
                  fontSize: '15px', 
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#94A3B8' }}>비밀번호</label>
              <input
                type="password"
                placeholder="비밀번호 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '14px 16px', 
                  borderRadius: '10px', 
                  border: '1px solid #334155', 
                  backgroundColor: '#1E293B',
                  color: '#FFFFFF',
                  fontSize: '15px', 
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            {error && (
              <div style={{ color: '#F87171', backgroundColor: 'rgba(239,68,68,0.1)', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: '1px solid rgba(239,68,68,0.2)' }}>
                ⚠️ {error}
              </div>
            )}

            <button 
              type="submit" 
              style={{ 
                width: '100%', 
                padding: '14px', 
                borderRadius: '10px', 
                border: 'none', 
                backgroundColor: '#2563EB', 
                color: '#FFFFFF', 
                fontSize: '16px', 
                fontWeight: '700', 
                cursor: 'pointer', 
                marginTop: '10px', 
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#1D4ED8'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#2563EB'}
            >
              로그인
            </button>

            <p style={{ textAlign: 'center', fontSize: '14px', color: '#64748B', marginTop: '16px' }}>
              계정이 없나요? <Link to="/register" style={{ color: '#3B82F6', fontWeight: '600', textDecoration: 'none' }}>회원가입</Link>
            </p>
          </form>
        </div>
      </div>

    </div>
  )
}

export default LoginPage