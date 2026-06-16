const { useState } = React;

function SignUp() {
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Tracks individual field validation errors cleanly
  const [errors, setErrors] = useState({
    nickname: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Track if duplicate checks have passed successfully
  const [verified, setVerified] = useState({
    nickname: false,
    email: false
  });

  // Mock local database array tracking currently registered users [cite: 250, 272]
  const mockUserDatabase = [
    { email: 'hong@example.com', nickname: 'gildong' },
    { email: 'kim@example.com', nickname: 'chulsoo' },
    { email: 'social@example.com', nickname: 'socialuser' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Wipe out error alerts on typing modifications [cite: 248]
    setErrors({ ...errors, [name]: '' });
    if (name === 'nickname') setVerified({ ...verified, nickname: false });
    if (name === 'email') setVerified({ ...verified, email: false });

    // Live validation checking parameters for password strings [cite: 243, 278]
    if (name === 'password') {
      if (value.length > 0 && value.length < 8) {
        setErrors(prev => ({ ...prev, password: '비밀번호는 최소 8자 이상이어야 합니다.' }));
      } else {
        setErrors(prev => ({ ...prev, password: '' }));
      }
    }

    // Live parity confirmation tracking for password entry matching [cite: 244, 278]
    if (name === 'confirmPassword') {
      if (formData.password !== value) {
        setErrors(prev => ({ ...prev, confirmPassword: '비밀번호가 일치하지 않습니다.' }));
      } else {
        setErrors(prev => ({ ...prev, confirmPassword: '' }));
      }
    }
  };

  // Nickname checking implementation rules [cite: 275]
  const verifyNickname = () => {
    if (!formData.nickname.trim()) {
      setErrors({ ...errors, nickname: '닉네임을 입력해주세요.' });
      return;
    }

    const isTaken = mockUserDatabase.some(
      user => user.nickname.toLowerCase() === formData.nickname.toLowerCase().trim()
    );

    if (isTaken) {
      setErrors({ ...errors, nickname: '이미 사용 중인 닉네임입니다.' }); // "nickname is taken" [cite: 268]
      setVerified({ ...verified, nickname: false });
    } else {
      setErrors({ ...errors, nickname: '사용 가능한 닉네임입니다.' });
      setVerified({ ...verified, nickname: true });
    }
  };

  // Email format structural checking validation engine patterns [cite: 239, 275]
  const verifyEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      setErrors({ ...errors, email: '이메일을 입력해주세요.' });
      return;
    }
    if (!emailRegex.test(formData.email)) {
      setErrors({ ...errors, email: '올바른 이메일 형식이 아닙니다.' });
      return;
    }

    const isRegistered = mockUserDatabase.some(
      user => user.email.toLowerCase() === formData.email.toLowerCase().trim()
    );

    if (isRegistered) {
      setErrors({ ...errors, email: '이미 등록된 이메일 주소입니다.' });
      setVerified({ ...verified, email: false });
    } else {
      setErrors({ ...errors, email: '사용 가능한 이메일입니다.' });
      setVerified({ ...verified, email: true });
    }
  };

  const handleSignUp = (e) => {
    e.preventDefault();

    if (!verified.nickname) {
      alert('닉네임 중복 확인을 완료해주세요.');
      return;
    }
    if (!verified.email) {
      alert('이메일 중복 확인을 완료해주세요.');
      return;
    }
    if (formData.password.length < 8 || errors.password) {
      alert('비밀번호 조건을 확인해주세요.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      alert('비밀번호가 서로 일치하지 않습니다.');
      return;
    }

    alert(`회원가입 완료! Welcome ${formData.nickname}!`);
    // TODO: connect to FastAPI [cite: 97]
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>회원가입</h2>
        <p style={styles.subtitle}>ScriptBot과 함께 영어 대본 연습을 시작하세요</p>

        <form onSubmit={handleSignUp}>
          {/* Row alignment wrapper */}
          <div style={styles.row}>
            <div style={styles.inputRowGroup}>
              <label style={styles.label}>이름 <span style={styles.required}>*(필수 입력)</span></label>
              <input type="text" name="name" placeholder="홍길동" value={formData.name} onChange={handleChange} style={styles.input} required />
            </div>
            
            <div style={styles.inputRowGroup}>
              <label style={styles.label}>닉네임 <span style={styles.required}>*(필수 입력)</span></label>
              <div style={styles.verifyActionGroup}>
                <input type="text" name="nickname" placeholder="gildong" value={formData.nickname} onChange={handleChange} style={styles.inputWithBtn} required />
                <button type="button" onClick={verifyNickname} style={styles.btnVerify}>중복 확인</button>
              </div>
              {errors.nickname && (
                <div style={errors.nickname.includes('가능') ? styles.successText : styles.errorText}>
                  {errors.nickname}
                </div>
              )}
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>이메일 <span style={styles.required}>*(필수 입력)</span></label>
            <div style={styles.verifyActionGroup}>
              <input type="email" name="email" placeholder="example@email.com" value={formData.email} onChange={handleChange} style={styles.inputWithBtn} required />
              <button type="button" onClick={verifyEmail} style={styles.btnVerify}>중복 확인</button>
            </div>
            {errors.email && (
              <div style={errors.email.includes('가능') ? styles.successText : styles.errorText}>
                {errors.email}
              </div>
            )}
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>비밀번호 <span style={styles.required}>*(필수 입력)</span></label>
            <input type="password" name="password" placeholder="8자 이상, 영문+숫자 조합" value={formData.password} onChange={handleChange} style={styles.input} required />
            {errors.password && <div style={styles.errorText}>{errors.password}</div>}
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>비밀번호 확인 <span style={styles.required}>*(필수 입력)</span></label>
            <input type="password" name="confirmPassword" placeholder="비밀번호 재입력" value={formData.confirmPassword} onChange={handleChange} style={styles.input} required />
            {errors.confirmPassword && <div style={styles.errorText}>{errors.confirmPassword}</div>}
          </div>

          <button type="submit" style={styles.btnSignup}>가입하기</button>
        </form>

        <p style={styles.footerText}>
          이미 계정이 있으신가요? <a href="login.html" style={styles.link}>로그인</a>
        </p>
      </div>
    </div>
  );
}

// Cleaned up styles layout declaration parameters (Fixed the white screen compiler crash)
const styles = {
  container: { backgroundColor: '#EBF1FF', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' },
  card: { background: 'white', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '480px', padding: '40px 30px', textAlign: 'center' },
  title: { fontSize: '24px', fontWeight: 'bold', color: '#1A2B49', margin: '5px 0' },
  subtitle: { fontSize: '13px', color: '#7E8B9B', marginBottom: '25px' },
  row: { display: 'flex', gap: '15px', marginBottom: '20px' },
  inputRowGroup: { textAlign: 'left', flex: 1, display: 'flex', flexDirection: 'column' },
  inputGroup: { textAlign: 'left', marginBottom: '20px', display: 'flex', flexDirection: 'column' },
  label: { display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#333' },
  required: { color: '#EF4444', fontSize: '11px', fontWeight: 'normal', marginLeft: '4px' },
  verifyActionGroup: { display: 'flex', gap: '8px' },
  input: { width: '100%', padding: '14px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' },
  inputWithBtn: { flex: 1, padding: '14px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box', fontSize: '14px', outline: 'none', minWidth: '0' },
  btnVerify: { backgroundColor: '#1A2B49', color: 'white', border: 'none', padding: '0 15px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' },
  errorText: { color: '#EF4444', fontSize: '12px', marginTop: '6px', fontWeight: 'bold', textAlign: 'left' },
  successText: { color: '#10B981', fontSize: '12px', marginTop: '6px', fontWeight: 'bold', textAlign: 'left' },
  btnSignup: { backgroundColor: '#2563EB', color: 'white', border: 'none', width: '100%', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px', marginBottom: '25px' },
  footerText: { fontSize: '13px', color: '#718096' },
  link: { color: '#2563EB', textDecoration: 'none', fontWeight: 'bold' }
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<SignUp />);