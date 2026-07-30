'use client'

import { useEffect, useState } from 'react'

// The one loud element on the screen. Ticks every second so the pressure is
// felt rather than read, and reports hours — 48 sounds urgent, "2 days" doesn't.
export default function Countdown({ claim }) {
  // Initialised to null, then set on mount: reading Date.now() during render
  // causes a hydration mismatch in Next, because server and client differ.
  const [now, setNow] = useState(null)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!claim?.deadline_iso || now === null) return null

  const msLeft = new Date(claim.deadline_iso).getTime() - now
  const hours = Math.floor(Math.abs(msLeft) / 3600000)
  const minutes = Math.floor((Math.abs(msLeft) % 3600000) / 60000)
  const expired = msLeft <= 0

  const deadline = new Date(claim.deadline_iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="countdown" data-status={claim.status}>
      <div className="eyebrow">{expired ? 'ಸಮಯ ಮುಗಿದಿದೆ' : 'ಉಳಿದಿರುವ ಸಮಯ'}</div>
      <div className="countdown-value">
        {hours}
        <span className="countdown-unit">ಗಂಟೆ {minutes}ನಿ</span>
      </div>
      <div className="countdown-deadline">
        {expired ? 'Deadline passed' : 'Report before'} {deadline} IST
      </div>
    </div>
  )
}
