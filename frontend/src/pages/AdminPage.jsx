import { useState, useEffect } from 'react'


function AdminPage() {
  const [users, setUsers] = useState([])
  const [keyword, setKeyword] = useState('')
  const [loginType, setLoginType] = useState('ALL')
  
  useEffect(() => {
  fetch('http://localhost:8000/users')
    .then(res => res.json())
    .then(data => {
      setUsers(data)
    })
    .catch(err => console.error(err))
}, [])

  const filteredUsers = users.filter(user => {
  const keywordMatch =
    user.name.toLowerCase().includes(keyword.toLowerCase()) ||
    user.nickname.toLowerCase().includes(keyword.toLowerCase()) ||
    user.email.toLowerCase().includes(keyword.toLowerCase())

  const typeMatch =
    loginType === 'ALL' || user.login_type === loginType

    return keywordMatch && typeMatch
    })

  const deleteUser = async (userId) => {
  const result = window.confirm('정말 삭제하시겠습니까?')

  if (!result) return

  await fetch(`http://localhost:8000/users/${userId}`, {
    method: 'DELETE'
  })

  setUsers(users.filter(user => user.user_id !== userId))
}

  const toggleStatus = (id) => {
  setUsers(
    users.map(user =>
      user.user_id === id
        ? {
            ...user,
            status:
              user.status === 'ACTIVE'
                ? 'BLOCKED'
                : 'ACTIVE'
          }
        : user
    )
  )
}

  const editUser = async (id) => {
  const user = users.find(u => u.user_id === id)

  const newName = prompt('새 이름 입력', user.name)
  const newNickname = prompt('새 닉네임 입력', user.nickname)
  const newEmail = prompt('새 이메일 입력', user.email)

  const updatedUser = {
    ...user,
    name: newName || user.name,
    nickname: newNickname || user.nickname,
    email: newEmail || user.email
  }

  await fetch(`http://localhost:8000/users/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updatedUser)
  })

  setUsers(
    users.map(user =>
      user.user_id === id ? updatedUser : user
    )
  )
}


  return (
    <div className="app">
    <div className="header">
    <div className="header-top">
      <div>
        <h1>관리자 페이지</h1>
        <p>회원 정보와 서비스 데이터를 관리합니다.</p>
      </div>

      <button
        className="logout-btn"
        onClick={() => window.location.href = '/'}>
        로그아웃
      </button>
    </div>
  </div>

   <div className="panel">
      <div className="summary-cards">
      <div className="summary-card">
      <span>전체 회원</span>
      <strong>{users.length}</strong>
    </div>

    <div className="summary-card">
      <span>정상 회원</span>
      <strong>
        {users.filter(user => user.status === 'ACTIVE').length}
      </strong>
    </div>

   <div className="summary-card">
      <span>차단 회원</span>
      <strong>
        {users.filter(user => user.status === 'BLOCKED').length}
      </strong>
    </div>  
  </div>
        <div className="top-bar">
          <h2>회원 관리</h2>

          <div className="search-box">
            <input
              type="text"
              placeholder="이름, 닉네임, 이메일 검색"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <select value={loginType} onChange={(e) => setLoginType(e.target.value)}>
                <option value="ALL">전체</option>
                <option value="LOCAL">LOCAL</option>
                <option value="SOCIAL">SOCIAL</option>
            </select>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>이름</th>
              <th>닉네임</th>
              <th>이메일</th>
              <th>로그인 타입</th>
              <th>가입일</th>
              <th>관리</th>
              <th>상태</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.user_id}>
                <td>{user.user_id}</td>
                <td>{user.name}</td>
                <td>{user.nickname}</td>
                <td>{user.email}</td>
                <td>{user.login_type}</td>
                <td>{user.created_at}</td>
                <td>
                 <span className={`status-badge ${user.status.toLowerCase()}`}>
                    {user.status}
                </span>
                </td>
               <td>
   <button className="status-btn"
    onClick={() => toggleStatus(user.user_id)}>
    {user.status === 'ACTIVE'
    ? '차단'
    : '복구'}
   </button>

    <button className="edit-btn"
      onClick={() => editUser(user.user_id)}>
       수정
    </button>

    <button
      className="delete-btn"
      onClick={() => deleteUser(user.user_id)}>
        삭제
    </button>
    </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminPage