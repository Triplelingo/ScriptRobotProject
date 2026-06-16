const { useState } = React;

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const mockUserDatabase = [
    { email: 'hong@example.com', password: 'password123', nickname: '길동이' },
    { email: 'kim@example.com', password: 'password456', nickname: '철수' },
    { email: 'social@example.com', password: 'password789', nickname: '소셜유저' }
  ];

  const validateEmailFormat = (emailStr) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    // 1. Structural format checks
    if (!validateEmailFormat(email)) {
      setError('올바른 이메일 형식이 아닙니다.');
      return;
    }
    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    // Account Existence Check (Is user registered?)
    const foundUser = mockUserDatabase.find(user => user.email === email.toLowerCase());
    
    if (!foundUser) {
      setError('등록되지 않은 이메일입니다. 회원가입을 진행해 주세요.'); // "User not registered"
      return;
    }

    // Credential Matching Check (Is the password correct?)
    if (foundUser.password !== password) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.'); // "Wrong password or username"
      return;
    }

    // Success state
    alert(`로그인 성공! 환영합니다, ${foundUser.nickname}님!`);
    
    // ==========================================
    // TODO: connect to FastAPI
    // Once Seolhee's DB is online, replace this local find() 
    // block with an asynchronous fetch requests engine.
    // ==========================================
  };

  const isFormValid = validateEmailFormat(email) && password.length >= 8;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>🎭</div>
        <h2 style={styles.title}>ScriptBot</h2>
        <p style={styles.subtitle}>영어 대본 연습 파트너</p>

        {/* Dynamic Warning Alert Banner Container */}
        {error && <div style={styles.errorBanner}>{error}</div>}

        <form onSubmit={handleLogin}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>이메일</label>
            <input 
              type="email" 
              placeholder="example@email.com" 
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if(error) setError('');
              }}
              style={styles.input} 
              required 
            />
          </div>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>비밀번호</label>
            <input 
              type="password" 
              placeholder="8자 이상 입력" 
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if(error) setError('');
              }}
              style={styles.input} 
              required 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={!isFormValid}
            style={{
              ...styles.btnLogin,
              ...(isFormValid ? {} : styles.btnDisabled)
            }}
          >
            로그인
          </button>
        </form>

        <div style={styles.divider}>또는</div>

        <div style={styles.socialArea}>
          <button type="button" style={{...styles.btnSns, backgroundColor: '#FEE500', border: 'none'}}>카카오 로그인</button>
          <button type="button" style={styles.btnSns}>Google 로그인</button>
        </div>

        <p style={styles.footerText}>
          계정이 없으신가요? <a href="register.html" style={styles.link}>회원가입</a>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { backgroundColor: '#EBF1FF', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' },
  card: { background: 'white', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '400px', padding: '40px 30px', textAlign: 'center' },
  logo: { fontSize: '40px', marginBottom: '10px' },
  title: { fontSize: '24px', fontWeight: 'bold', color: '#1A2B49', margin: '5px 0' },
  subtitle: { fontSize: '14px', color: '#7E8B9B', marginBottom: '25px' },
  errorBanner: { backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', padding: '12px', borderRadius: '10px', fontSize: '13px', textAlign: 'left', marginBottom: '20px', fontWeight: 'bold' },
  inputGroup: { textAlign: 'left', marginBottom: '20px' },
  label: { display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#333' },
  input: { width: '100%', padding: '14px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' },
  btnLogin: { backgroundColor: '#2563EB', color: 'white', border: 'none', width: '100%', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', transition: 'all 0.2s' },
  btnDisabled: { backgroundColor: '#93C5FD', cursor: 'not-allowed', opacity: 0.7 },
  divider: { display: 'flex', alignItems: 'center', color: '#A0AEC0', fontSize: '12px', margin: '25px 0' },
  socialArea: { display: 'flex', gap: '10px', marginBottom: '25px' },
  btnSns: { flex: 1, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', border: '1px solid #E2E8F0', cursor: 'pointer', background: 'white' },
  footerText: { fontSize: '13px', color: '#718096' },
  link: { color: '#2563EB', textDecoration: 'none', fontWeight: 'bold' }
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Login />);