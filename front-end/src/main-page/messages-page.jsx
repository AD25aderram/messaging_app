import { useEffect, useRef, useState } from 'react'
import '../styles/terminal-base.css'
import '../styles/Chat.css'
import { useClock, Scanlines, StatusBar } from '../components/TerminalUI'
import { io } from 'socket.io-client'

const SOCKET_URL = 'http://localhost:3001'

function MessagePage({ chatID, contact_name, onBack, username, userId }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('CONNECTING')
  const [error, setError] = useState('')
  const [peerName, setPeerName] = useState(contact_name || 'CONTACT')
  const socketRef = useRef(null)
  const messagesEndRef = useRef(null)
  const clock = useClock()

  const chatId = chatID ?? ''
  const resolvedContactName = contact_name || 'CONTACT'
  const currentUser = {
    id: userId || 'local-user',
    username: username || 'me',
  }

  const addMessage = (msg) => {
    setMessages((prev) => {
      if (prev.some((existing) => existing.id === msg.id)) {
        return prev
      }
      return [...prev, msg]
    })
  }

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }


  const markMessagesRead = async () => {
    if (!chatId || !currentUser.id) return

    try {
      const response = await fetch(`http://localhost:3001/messages/${chatId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: Number(currentUser.id) }),
      })

      if (!response.ok) {
        const errorResult = await response.text()
        console.error('Failed to mark messages as read:', response.status, errorResult)
      }
    } catch (err) {
      console.error('Failed to mark messages as read:', err)
    }
  }

  useEffect(() => {
    if (!chatId) return

    const loadHistory = async () => {
      setStatus('SYNCING')
      setError('')

      try {
        const response = await fetch(`http://localhost:3001/history/${chatId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) {
          throw new Error(`Unable to load history (${response.status})`)
        }

        const history = await response.json()
        const transformed = Array.isArray(history)
          ? history.map((item, index) => {
              const messageId =
                item.id ??
                item.message_id ??
                item.messageId ??
                item.MessageID ??
                `${item.date_du_message ?? item.Date_sent ?? item.date_sent ?? index}-${index}`

              const source = item.sent_by_id ?? item.Source ?? item.source ?? 'peer'
              const content = item.content ?? item.Content ?? ''
              const createdAt = item.date_du_message ?? item.Date_sent ?? item.date_sent ?? new Date().toISOString()
              const status = item['etat_du message'] ?? item.etat_du_message ?? item.Etat ?? 'lu'

              return {
                id: String(messageId),
                chatId,
                userId: source,
                username: String(source) === String(currentUser.id) ? currentUser.username : resolvedContactName,
                message: content,
                createdAt,
                status,
              }
            })
          : []

        const readMessages = transformed.map((msg) => {
          if (msg.userId !== currentUser.id && msg.status === 'non_lu') {
            return { ...msg, status: 'lu' }
          }
          return msg
        })

        setMessages(readMessages)
        await markMessagesRead()
      } catch (err) {
        setError(err.message || 'Unable to load older messages')
      }
    }

    loadHistory()
  }, [chatId, currentUser.id, currentUser.username, resolvedContactName])

  useEffect(() => {
    if (!chatId) return undefined

    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      withCredentials: true,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setStatus('ONLINE')
      socket.emit('join-room', {
        chatId,
        userId: currentUser.id,
      })
    })

    socket.on('connect_error', () => {
      setStatus('OFFLINE')
      setError('Realtime server unavailable')
    })

    socket.on('disconnect', () => {
      setStatus('OFFLINE')
    })

    socket.on('room-joined', () => {
      setPeerName(resolvedContactName)
    })

    socket.on('new-message', (msg) => {
      addMessage({
        id: msg.id,
        chatId: msg.chatId,
        userId: msg.userId,
        username: msg.username,
        message: msg.message,
        createdAt: msg.createdAt,
      })
    })

    return () => {
      socket.off('connect')
      socket.off('connect_error')
      socket.off('disconnect')
      socket.off('room-joined')
      socket.off('new-message')
      socket.disconnect()
      socketRef.current = null
    }
  }, [chatId, currentUser.id, currentUser.username, resolvedContactName])

  const sendMessage = () => {
    const trimmed = input.trim()
    if (!trimmed || !socketRef.current || !chatId) return

    const payload = {
      chatId,
      message: trimmed,
      userId: currentUser.id,
    }

    socketRef.current.emit('send-message', payload)
    addMessage({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      chatId,
      userId: currentUser.id,
      username: currentUser.username,
      message: trimmed,
      createdAt: new Date().toISOString(),
    })
    setInput('')
  }

  const formatTime = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div className="chat-page">
      <Scanlines />

      <div className="chat-topbar">
        <button className="chat-topbar__back" onClick={onBack}>[← BACK]</button>
        <span className="chat-topbar__divider">|</span>
        <span className="chat-topbar__handle">{contact_name}</span>
        <span className="chat-topbar__spacer" />
        <span className="chat-topbar__meta">PING: 15ms</span>
        <span className="chat-topbar__divider">|</span>
        <span className="chat-topbar__meta">ENC: ON</span>
        <span className="chat-topbar__divider">|</span>
        <span className="chat-topbar__clock">{clock}</span>
      </div>

      <div className="chat-messages">
        <div className="chat-session-line">SESSION • {status}</div>
        {error && <div className="term-error">{error}</div>}
        {messages.map((msg, index) => {
          const mine = String(msg.userId) === String(currentUser.id)
          const isRead = msg.status === 'lu'
          return (
            <div
              key={msg.id || `${msg.createdAt}-${index}`}
              className={`chat-msg-group ${mine ? 'chat-msg-group--me' : 'chat-msg-group--them'}`}
            >
              <div className="chat-msg-header">
                <span className={`chat-msg-header__handle--${mine ? 'me' : 'them'}`}>
                  {mine ? currentUser.username : msg.username || peerName}
                </span>
                <span className="chat-msg-header__ts">{formatTime(msg.createdAt)}</span>
              </div>
              <div className={`chat-bubble ${mine ? 'chat-bubble--me' : 'chat-bubble--them'}`}>
                <span className={`chat-bubble__prompt ${mine ? '' : 'chat-bubble__prompt--them'}`}>
                  {mine ? '>' : '~'}
                </span>
                {msg.message}
              </div>
              <div className={`chat-msg-ack ${mine && isRead ? 'chat-msg-ack--read' : ''}`}>
                {mine ? (isRead ? '✓' : '•') : '·'}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-row">
          <span className="chat-input-row__prompt">{'>'}</span>
          <input
            className="chat-input-row__field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder={`msg ${peerName.toLowerCase()}... (Enter to send)`}
            autoFocus
          />
          <button className="chat-input-row__send" disabled={!input.trim() || status !== 'ONLINE'} onClick={sendMessage}>
            [SEND]
          </button>
        </div>
        <div className="chat-input-hint">ENTER — SEND &nbsp;|&nbsp; END-TO-END ENCRYPTED</div>
      </div>

      <StatusBar left={`MSG:${messages.length} | PEER:${peerName}`} right={`${clock} | ${status} | HALO v2.4.1`} />
    </div>
  )
}

export default MessagePage