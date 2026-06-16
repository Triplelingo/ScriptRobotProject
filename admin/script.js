const users = [
  {
    user_id: 1,
    name: "홍길동",
    nickname: "길동이",
    email: "hong@example.com",
    login_type: "LOCAL",
    created_at: "2026-05-23"
  },
  {
    user_id: 2,
    name: "김철수",
    nickname: "철수",
    email: "kim@example.com",
    login_type: "LOCAL",
    created_at: "2026-05-23"
  },
  {
    user_id: 3,
    name: "이소셜",
    nickname: "소셜유저",
    email: "social@example.com",
    login_type: "SOCIAL",
    created_at: "2026-05-23"
  }
];

function renderUsers(data) {
  const tbody = document.getElementById("userTableBody");
  tbody.innerHTML = "";

  data.forEach(user => {
    tbody.innerHTML += `
      <tr>
        <td>${user.user_id}</td>
        <td>${user.name}</td>
        <td>${user.nickname}</td>
        <td>${user.email}</td>
        <td>${user.login_type}</td>
        <td>${user.created_at}</td>
        <td><button class="delete-btn">삭제</button></td>
      </tr>
    `;
  });
}

function searchUsers() {
  const keyword = document.getElementById("searchInput").value.toLowerCase();

  const result = users.filter(user =>
    user.name.toLowerCase().includes(keyword) ||
    user.nickname.toLowerCase().includes(keyword) ||
    user.email.toLowerCase().includes(keyword)
  );

  renderUsers(result);
}

renderUsers(users);