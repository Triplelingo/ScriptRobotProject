import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    nickname: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    })
  }

  const handleRegister = async (e) => {
    e.preventDefault()

    // 1. Client-side structural validations
    if (!form.name.trim() || !form.nickname.trim()) {
      setError('이름과 닉네임을 모두 입력해주세요.')
      return
    }

    if (!form.email.includes('@')) {
      setError('올바른 이메일 형식을 입력해주세요.')
      return
    }

    if (form.password.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setError('')

    try {
      // 2. Fetch connection payload out to your active FastAPI backend
      const res = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: form.name,
          nickname: form.nickname,
          email: form.email,
          password: form.password
        })
      })

      if (!res.ok) {
        throw new Error('서버와 통신 중 오류가 발생했습니다.')
      }

      const data = await res.json()

      // 3. Evaluate database unique constraints feedback
      if (!data.success) {
        setError(data.message)
        return
      }

      alert('회원가입 완료! 로그인 페이지로 이동합니다.')
      navigate('/')

    } catch (err) {
      console.error("Registration handshake exception:", err)
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
            JOIN THE ECOSYSTEM
          </div>
          <h2 style={{ fontSize: '42px', fontWeight: '800', lineHeight: '1.2', marginBottom: '16px', color: '#FFFFFF' }}>
            새로운 계정으로 <br />
            <span style={{ color: '#60A5FA' }}>회화 연습 시작하기</span>
          </h2>
          <p style={{ fontSize: '16px', color: '#94A3B8', lineHeight: '1.6', marginBottom: '40px' }}>
            간단한 회원가입을 통해 본인만의 학습 프로필을 생성하고, 맞춤형 AI 대본 분석 및 발화 교정 데이터를 영구적으로 기록하세요.
          </p>

          {/* Quick Info Points */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '24px', background: 'rgba(37,99,235,0.15)', padding: '10px', borderRadius: '12px' }}>🔒</div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#F1F5F9' }}>보안 데이터 관리</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>사용자 기본 데이터 구조 및 개인 식별 정보의 암호화 처리</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '24px', background: 'rgba(37,99,235,0.15)', padding: '10px', borderRadius: '12px' }}>🚀</div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#F1F5F9' }}>개인 대본 업로드 활성화</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>가입 후 본인이 원하는 맞춤형 회화 텍스트 자유 구성 권한 부여</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 RIGHT SIDE: CLEAN REGISTER INTERFACE CARD CONTAINER */}
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
          <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', color: '#FFFFFF', letterSpacing: '-0.5px' }}>회원가입</h1>
          <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '32px' }}>아래의 양식을 작성하여 새로운 계정을 등록하세요.</p>

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#94A3B8' }}>이름</label>
              <input
                type="text"
                name="name"
                placeholder="이름 입력"
                value={form.name}
                onChange={handleChange}
                style={{ 
                  width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #334155', 
                  backgroundColor: '#1E293B', color: '#FFFFFF', fontSize: '15px', boxSizing: 'border-box', outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#94A3B8' }}>닉네임</label>
              <input
                type="text"
                name="nickname"
                placeholder="닉네임 입력"
                value={form.nickname}
                onChange={handleChange}
                style={{ 
                  width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #334155', 
                  backgroundColor: '#1E293B', color: '#FFFFFF', fontSize: '15px', boxSizing: 'border-box', outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#94A3B8' }}>이메일 주소</label>
              <input
                type="email"
                name="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={handleChange}
                style={{ 
                  width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #334155', 
                  backgroundColor: '#1E293B', color: '#FFFFFF', fontSize: '15px', boxSizing: 'border-box', outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#94A3B8' }}>비밀번호</label>
              <input
                type="password"
                name="password"
                placeholder="비밀번호 입력 (4자 이상)"
                value={form.password}
                onChange={handleChange}
                style={{ 
                  width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #334155', 
                  backgroundColor: '#1E293B', color: '#FFFFFF', fontSize: '15px', boxSizing: 'border-box', outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#94A3B8' }}>비밀번호 확인</label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="비밀번호 다시 입력"
                value={form.confirmPassword}
                onChange={handleChange}
                style={{ 
                  width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #334155', 
                  backgroundColor: '#1E293B', color: '#FFFFFF', fontSize: '15px', boxSizing: 'border-box', outline: 'none'
                }}
              />
            </div>

            {error && (
              <div style={{ color: '#F87171', backgroundColor: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: '1px solid rgba(239,68,68,0.2)' }}>
                ⚠️ {error}
              </div>
            )}

            <button 
              type="submit" 
              style={{ 
                width: '100%', padding: '14px', borderRadius: '10px', border: 'none', 
                backgroundColor: '#2563EB', color: '#FFFFFF', fontSize: '16px', fontWeight: '700', 
                cursor: 'pointer', marginTop: '10px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#1D4ED8'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#2563EB'}
            >
              회원가입 완료하기
            </button>

            <p style={{ textAlign: 'center', fontSize: '14px', color: '#64748B', marginTop: '12px' }}>
              이미 계정이 있나요? <Link to="/" style={{ color: '#3B82F6', fontWeight: '600', textDecoration: 'none' }}>로그인</Link>
            </p>
          </form>
        </div>
      </div>

    </div>
  )
}

export default RegisterPage