import { useEffect, useState } from 'react'
import LoginForm from './components/login.jsx'
import RegisterForm from './components/register.jsx'
import MainPage from './main-page/main-pages.jsx'
import apiFetch from './api/client.js'
import MessagesPage from './main-page/messages-page.jsx'

/**
 * Example wiring — adapt to however your project currently
 * switches between login / register / main page.
 */
function App() {
  const [page, setPage] = useState('login') // "login" | "register" | "main"
  const [chatID, setChatID] = useState()
  const [contactName, setContactName] = useState('CONTACT')
  const [username, setUsername] = useState()
  const [userId, setUserId] = useState()
  const [refreshContactsKey, setRefreshContactsKey] = useState(0)
  useEffect(() => {
    const verifyRefreshToken = async () => {
      try {
        const response = await apiFetch('http://localhost:8080/auth/token', {
          method: 'GET',
          credentials: 'include',
        })
        if (response.ok) {
          const usernInfo = await response.json()
          setUsername(usernInfo.username)
          setUserId(usernInfo.user_id || usernInfo.userId || usernInfo.id)
          setPage('main')
        } else {
          setPage('login')
        }
      } catch (error) {
        console.error('Auth verify failed:', error)
        setPage('login')
      }
    }

    verifyRefreshToken()
  }, [])


  const handleLogout = async () => {
    try {
      const response = await apiFetch('http://localhost:8080/auth/logout', {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        console.error('Logout failed with status', response.status)
      }
    } catch (error) {
    } finally {
      setUsername(undefined)
      setUserId(undefined)
      setPage('login')
    }
  }

  const handleLoginSuccess = async () => {
    try {
      const response = await apiFetch('http://localhost:8080/auth/token', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        setPage('login')
        return
      }

      const usernInfo = await response.json()
      setUsername(usernInfo.username)
      setUserId(usernInfo.user_id || usernInfo.userId || usernInfo.id)
      setPage('main')
    } catch (error) {
      console.error('Auth verify failed after login:', error)
      setPage('login')
    }
  }

  const selectChat = (id, name) => {
    setChatID(id)
    setContactName(name || 'CONTACT')
    setPage('chat')
  }

  const handleBackToMain = () => {
    setPage('main')
    setRefreshContactsKey((prev) => prev + 1)
  }

  return (
    <>
      {page === 'login' && (
        <LoginForm
          onSwitchToRegister={() => setPage('register')}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
      {page === 'register' && (
        <RegisterForm onSwitchToLogin={() => setPage('login')} />
      )}
      {page === 'main' && (
        <MainPage
          username={username}
          onSelectContact={selectChat}
          onLogout={handleLogout}
          refreshKey={refreshContactsKey}
        />
      )}
      {page === 'chat' && (
        <MessagesPage
          username={username}
          userId={userId}
          chatID={chatID}
          contact_name={contactName}
          onBack={handleBackToMain}
        />
      )}
    </>
  )
}

export default App
