// src/utils/auth.js[cite: 1]
export const getLoggedInUser = () => {
  const possibleKeys = ['loginUser', 'user', 'currentUser']
  for (const key of possibleKeys) {
    const value = localStorage.getItem(key)
    if (!value) continue
    try {
      const parsed = JSON.parse(value)
      if (parsed?.user?.user_id) return parsed.user
      if (parsed?.user_id) return parsed
    } catch (error) {
      console.error(`${key} parse failed:`, error)
    }
  }
  return null
}