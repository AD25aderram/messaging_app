import { useState } from 'react'
import '../styles/terminal-base.css'
import '../styles/Login.css'
import { useBootSequence, Cursor, Scanlines, StatusBar } from './TerminalUI'

/* ── Boot log printed above the login form ─────────────────── */
const BOOT_LINES = [
  { text: 'HALO SECURE TERMINAL v2.4.1', bright: true },
  { text: 'Copyright (C) 2024 Halo Systems Inc.', bright: false },
  { text: '──────────────────────────────────────', bright: true },
  { text: 'Initializing crypto subsystem......OK', bright: false },
  { text: 'Loading keystore...................OK', bright: false },
  { text: 'Establishing TLS 1.3 tunnel........OK', bright: false },
  { text: 'Connection established: localhost:8080', bright: false },
  { text: '──────────────────────────────────────', bright: true },
  { text: 'Authentication required.', bright: false },
]

function LoginForm({ onSwitchToRegister, onLoginSuccess }) {
  // ── core state / logic kept from the original component ──
  const [username, setusername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const { visibleLines, done } = useBootSequence(BOOT_LINES.map((l) => l.text))

  const validateForm = () => {
    const newErrors = {}

    if (!username) {
      newErrors.username = 'username is required'
    }

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validateForm()

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const response = await fetch('http://localhost:8080/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        throw new Error('Wrong username or password')
      }

      await response.json()
      console.log('Login successful, accessToken saved in cookie')

      setusername('')
      setPassword('')
      onLoginSuccess()
    } catch (error) {
      setErrors({ submit: error.message })
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <Scanlines />
      <div className="login-wrapper">
        <div className="term-box">
          <div className="term-box__titlebar">
            <span className="term-box__title">HALO://AUTH — LOGIN</span>
            <span className="term-box__pid">PID:0001</span>
          </div>

          <div className="login-body">
            {/* Boot log */}
            <div className="login-boot">
              {visibleLines.map((line, i) => {
                const isBright = BOOT_LINES[i]?.bright
                return (
                  <div key={i} className={isBright ? 'login-boot__line--bright' : 'login-boot__line'}>
                    {line}
                  </div>
                )
              })}
              {!done && <Cursor />}
            </div>

            {done && (
              <form className="login-form" onSubmit={handleSubmit}>
                {/* Username */}
                <div className="term-field">
                  <span className="term-field__label">USER    :</span>
                  <input
                    id="username"
                    className="term-field__input"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setusername(e.target.value)}
                    autoFocus
                  />
                </div>
                {errors.username && <div className="term-error">{errors.username}</div>}

                {/* Password */}
                <div className="term-field login-field--password">
                  <span className="term-field__label">PASSWD  :</span>
                  <div className="login-field__input-wrap">
                    <input
                      id="password"
                      className="term-field__input"
                      type={showPass ? 'text' : 'password'}
                      placeholder="enter passphrase"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="login-field__toggle"
                      onClick={() => setShowPass((v) => !v)}
                    >
                      [{showPass ? 'HIDE' : 'SHOW'}]
                    </button>
                  </div>
                </div>
                {errors.password && <div className="term-error">{errors.password}</div>}

                <div className="login-forgot">
                  <a href="#" className="login-forgot__btn">
                    [FORGOT PASSPHRASE?]
                  </a>
                </div>

                {errors.submit && <div className="term-error">{errors.submit}</div>}

                <div className="login-actions">
                  <button type="submit" className="term-btn term-btn--primary" disabled={loading}>
                    {loading ? (
                      <span className="term-spinner">
                        <span className="term-spinner__dot">AUTHENTICATING...</span>
                        <Cursor />
                      </span>
                    ) : (
                      '[ AUTHENTICATE ]'
                    )}
                  </button>
                  <button
                    type="button"
                    className="term-btn term-btn--secondary"
                    onClick={onSwitchToRegister}
                  >
                    [ NEW USER REGISTRATION ]
                  </button>
                </div>

                <div className="login-footer">ALL TRANSMISSIONS END-TO-END ENCRYPTED</div>
              </form>
            )}
          </div>

          <StatusBar left="ENC:TLS1.3" right="localhost:8080" />
        </div>
      </div>
    </div>
  )
}

export default LoginForm
