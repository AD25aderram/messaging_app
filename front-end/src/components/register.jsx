import { useState } from 'react'
import '../styles/terminal-base.css'
import '../styles/Register.css'
import { Cursor, Scanlines, StatusBar } from './TerminalUI'

function RegisterForm({ onSwitchToLogin }) {
  // ── core state / logic kept from the original component ──
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const strength =
    formData.password.length === 0 ? 0 : formData.password.length < 6 ? 1 : formData.password.length < 10 ? 2 : 3

  const strengthMeta = [
    { text: '', cls: '' },
    { text: 'WEAK   ▓░░', cls: 'register-strength__value--weak' },
    { text: 'FAIR   ▓▓░', cls: 'register-strength__value--fair' },
    { text: 'STRONG ▓▓▓', cls: 'register-strength__value--strong' },
  ]

  const validateForm = () => {
    const newErrors = {}

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    } else if (formData.username.trim().length < 2) {
      newErrors.username = 'Username must be at least 2 characters'
    }

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    return newErrors
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
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
      const response = await fetch('http://localhost:8080/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Registration failed')
      }

      setFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
      })
      // Switch back to login form after successful registration
      onSwitchToLogin()
    } catch (error) {
      setErrors({ submit: error.message })
      console.error('Registration error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-page">
      <Scanlines />
      <div className="register-wrapper">
        <div className="term-box">
          <div className="term-box__titlebar">
            <span className="term-box__title">HALO://AUTH — NEW USER REGISTRATION</span>
            <span className="term-box__pid">PID:0002</span>
          </div>

          <div className="register-body">
            <div className="register-intro">
              <div className="register-intro__title">HALO SECURE TERMINAL v2.4.1</div>
              <div className="register-intro__sub">Creating new user account. Fill all fields.</div>
              <div className="register-intro__rule">──────────────────────────────────────</div>
            </div>

            <form className="register-form" onSubmit={handleSubmit}>
              {/* Username */}
              <div className="term-field">
                <span className="term-field__label">USERNAME :</span>
                <input
                  id="username"
                  className="term-field__input"
                  type="text"
                  name="username"
                  placeholder="Enter your username"
                  value={formData.username}
                  onChange={handleChange}
                  autoFocus
                />
              </div>
              {errors.username && <div className="term-error">{errors.username}</div>}

              {/* Email */}
              <div className="term-field">
                <span className="term-field__label">EMAIL    :</span>
                <input
                  id="email"
                  className="term-field__input"
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              {errors.email && <div className="term-error">{errors.email}</div>}

              {/* Password */}
              <div className="term-field">
                <span className="term-field__label">PASSWD   :</span>
                <div className="register-field__input-wrap">
                  <input
                    id="password"
                    className="term-field__input"
                    type={showPass ? 'text' : 'password'}
                    name="password"
                    placeholder="Create a password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    className="register-field__toggle"
                    onClick={() => setShowPass((v) => !v)}
                  >
                    [{showPass ? 'HIDE' : 'SHOW'}]
                  </button>
                </div>
              </div>
              {errors.password && <div className="term-error">{errors.password}</div>}

              {/* Confirm password */}
              <div className="term-field">
                <span className="term-field__label">CONFIRM  :</span>
                <input
                  id="confirmPassword"
                  className="term-field__input"
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
              {errors.confirmPassword && <div className="term-error">{errors.confirmPassword}</div>}

              {/* Strength meter */}
              {formData.password.length > 0 && (
                <div className="register-strength">
                  <span className="register-strength__label">STRENGTH:</span>
                  <span className={`register-strength__value ${strengthMeta[strength].cls}`}>
                    {strengthMeta[strength].text}
                  </span>
                </div>
              )}

              {errors.submit && <div className="term-error">{errors.submit}</div>}

              <div className="register-actions">
                <button type="submit" className="term-btn term-btn--primary" disabled={loading}>
                  {loading ? (
                    <span className="term-spinner">
                      <span className="term-spinner__dot">CREATING ACCOUNT...</span>
                      <Cursor />
                    </span>
                  ) : (
                    '[ CREATE ACCOUNT ]'
                  )}
                </button>
                <button type="button" className="term-btn term-btn--secondary" onClick={onSwitchToLogin}>
                  [ BACK TO LOGIN ]
                </button>
              </div>

              <div className="register-footer">
                BY REGISTERING YOU ACCEPT THE{' '}
                <button type="button" className="register-footer__link">
                  TERMS OF SERVICE
                </button>{' '}
                AND{' '}
                <button type="button" className="register-footer__link">
                  PRIVACY POLICY
                </button>
                .
              </div>
            </form>
          </div>

          <StatusBar left="ENC:TLS1.3" right="NEW_USER_FLOW" />
        </div>
      </div>
    </div>
  )
}

export default RegisterForm
