import { useState, useEffect } from 'react'

/* ═══════════════════════════════════════════════════════════
   HALO TERMINAL — shared design hooks & components
   Import these anywhere you need the terminal look & feel.
   ═══════════════════════════════════════════════════════════ */

/** Live-updating HH:MM:SS clock, used in status bars / top bars. */
export function useClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`
}

/**
 * Reveals `lines` one at a time (typewriter / boot-log effect).
 * Returns the currently visible lines plus a `done` flag once
 * the whole sequence has finished printing.
 */
export function useBootSequence(lines) {
  const [count, setCount] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (count < lines.length) {
      const t = setTimeout(() => setCount((c) => c + 1), count === 0 ? 100 : 70)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => setDone(true), 150)
      return () => clearTimeout(t)
    }
  }, [count, lines.length])

  return { visibleLines: lines.slice(0, count), done }
}

/** Blinking terminal cursor block. */
export function Cursor() {
  return <span className="term-cursor" />
}

/** Fixed full-screen CRT scanline overlay. */
export function Scanlines() {
  return <div className="term-scanlines" />
}

/** Reusable bottom status bar (green bar, black text). */
export function StatusBar({ left, right }) {
  return (
    <div className="term-statusbar">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  )
}

/** Returns the current time formatted as HH:MM:SS (one-off, non-live). */
export function nowStamp() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}
