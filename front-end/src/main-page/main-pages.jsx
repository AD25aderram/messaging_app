import { useEffect, useState } from 'react'
import '../styles/terminal-base.css'
import '../styles/Contacts.css'
import { useClock, Scanlines, StatusBar } from '../components/TerminalUI'
import apiFetch from '../api/client.js'

function MainPage({ onLogout, onSelectContact, username, refreshKey }) {
  // ── core state / logic kept from the original component ──
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [userResult, setUserResult] = useState(null)
  const [userSearching, setUserSearching] = useState(false)
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteStatus, setInviteStatus] = useState(null)

  const clock = useClock()

  const fetchMessages = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiFetch('http://localhost:8080/contacts/', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('You are not authenticated. Please log in again.')
        }
        if (response.status === 403) {
          throw new Error('Invalid or expired token. Please log in again.')
        }
        throw new Error('Unable to load messages.')
      }

      const data = await response.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [refreshKey])

  const safeMessages = Array.isArray(messages) ? messages : []
  const filtered = safeMessages.filter((m) =>
    (m.username ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const searchUser = async () => {
    if (!userSearch || !userSearch.trim()) return
    setUserSearching(true)
    setUserResult(null)
    setInviteStatus(null)

    try {
      // Backend search endpoint - adjust to your API if different
      const resp = await apiFetch(`http://localhost:8080/contacts/search?username=${encodeURIComponent(
        userSearch.trim()
      )}`, {
        method: 'GET',
      })

      if (!resp.ok) {
        const txt = await resp.text()
        throw new Error(txt || `Search failed (${resp.status})`)
      }

      const data = await resp.json()
      // Expecting either a single user object or { found: false }
      if (!data) {
        setUserResult(null)
      } else {
        setUserResult(data)
      }
    } catch (err) {
      setUserResult({ error: err.message || 'Search error' })
    } finally {
      setUserSearching(false)
    }
  }

  const sendInvite = async (foundUser) => {
    if (!foundUser) return
    setInviteSending(true)
    setInviteStatus(null)

    try {
      // Ask the contact server to create the token and send the invite server-side
      const resp = await apiFetch('http://localhost:8080/contacts/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId: foundUser.id }),
      })

      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(text || `Invite failed (${resp.status})`)
      }

      const result = await resp.json()
      setInviteStatus({ success: true, result })
    } catch (err) {
      setInviteStatus({ success: false, message: err.message })
    } finally {
      setInviteSending(false)
    }
  }

  return (
    <div className="contacts-page">
      <Scanlines />

      {/* Top bar */}
      <div className="contacts-topbar">
        <span className="contacts-topbar__logo">HALO://TERMINAL</span>
        <span className="contacts-topbar__divider">|</span>
        <span className="contacts-topbar__meta">
          USER: <span>{username}</span>
        </span>
        <span className="contacts-topbar__meta">
          STATUS: <span>{loading ? 'SYNCING' : error ? 'ERROR' : 'ONLINE'}</span>
        </span>
        <span className="contacts-topbar__spacer" />
        <span className="contacts-topbar__clock">{clock}</span>
        <span className="contacts-topbar__divider">|</span>
        <button className="contacts-topbar__logout" onClick={onLogout}>
          [LOGOUT]
        </button>
      </div>

      {/* Find user in entire DB and invite */}
      <div className="contacts-search" style={{ marginTop: 8 }}>
        <span className="contacts-search__prefix">FIND:</span>
        <input
          className="contacts-search__input"
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          placeholder="search username in full DB..."
        />
        <button className="contacts-search__clear" onClick={searchUser} disabled={userSearching || !userSearch.trim()}>
          {userSearching ? '[SEARCHING]' : '[SEARCH]'}
        </button>
        {userSearch && (
          <button className="contacts-search__clear" onClick={() => { setUserSearch(''); setUserResult(null); setInviteStatus(null); }}>
            [X]
          </button>
        )}

        {userResult && (
          <div style={{ marginTop: 6 }} className="contacts-row">
            {userResult.error ? (
              <div className="term-error">{userResult.error}</div>
            ) : (
              <>
                <span className="contacts-row__handle">{userResult.username || userResult.name || 'Unknown'}</span>
                <span style={{ marginLeft: 8 }}>{userResult.email || userResult.email_address || ''}</span>
                <button style={{ marginLeft: 12 }} className="term-btn" onClick={() => sendInvite(userResult)} disabled={inviteSending}>
                  {inviteSending ? '[SENDING]' : '[INVITE]'}
                </button>
              </>
            )}
          </div>
        )}

        {inviteStatus && (
          <div style={{ marginTop: 6 }} className={inviteStatus.success ? 'term-ok' : 'term-error'}>
            {inviteStatus.success ? 'Invite sent' : `Invite failed: ${inviteStatus.message}`}
          </div>
        )}
      </div>

      {/* Panel header */}
      <div className="contacts-header">
        <span className="contacts-header__title">PEER LIST</span>
        <span className="contacts-header__count">{safeMessages.length} TOTAL</span>
      </div>

      {/* Search */}
      <div className="contacts-search">
        <span className="contacts-search__prefix">GREP:</span>
        <input
          className="contacts-search__input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="filter messages..."
        />
        {search && (
          <button className="contacts-search__clear" onClick={() => setSearch('')}>
            [X]
          </button>
        )}
      </div>

      {/* Column headers */}
      <div className="contacts-cols">
        <span className="contacts-cols__handle">HANDLE</span>
        <span className="contacts-cols__msg">LAST MESSAGE</span>
        <span className="contacts-cols__time">TIME</span>
        <span className="contacts-cols__unread">NEW</span>
      </div>

      {/* List */}
      <div className="contacts-list">
        {loading && <div className="login-boot__line">Loading messages...</div>}
        {error && <div className="term-error">{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="login-boot__line">
            {safeMessages.length === 0
              ? 'No contact available. Try inviting friends.'
              : 'No messages available.'}
          </div>
        )}

        {!loading &&
          !error &&
          filtered.map(user => (
            <div
              key={user.contact_id}
              className="contacts-row"
              onClick={() => onSelectContact(user.chat_id, user.username)}
            >
              <span className="contacts-row__handle">{user.username}</span>
              <span className="contacts-row__lastmsg">{user.last_message}</span>
              <span className="contacts-row__time">
                {user.date_du_message
                  ? new Date(user.date_du_message).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    }) === new Date().toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                    ? new Date(user.date_du_message).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : new Date(user.date_du_message).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                      })
                  : ''}
              </span>
              <span
                className={`contacts-row__unread ${
                  user.etat_du_message === 'non_lu'
                    ? 'contacts-row__unread--orange'
                    : user.etat_du_message === 'lu'
                      ? 'contacts-row__unread--green'
                      : 'contacts-row__unread--none'
                }`}
              >
                {user.etat_du_message === 'mon_message' ? '—' : '●'}
              </span>
            </div>
          ))}
      </div>

      {/* Actions */}
      <div className="contacts-me">
        <button type="button" className="term-btn term-btn--primary" style={{ width: 'auto', padding: '4px 14px' }} onClick={fetchMessages}>
          [ REFRESH ]
        </button>
        <span className="contacts-me__spacer" />
        <span className="contacts-me__pid">PID:3721</span>
      </div>

      <StatusBar left={`MSG:${safeMessages.length}`} right={`${clock} | TLS1.3 | HALO v2.4.1`} />
    </div>
  )
}

export default MainPage
