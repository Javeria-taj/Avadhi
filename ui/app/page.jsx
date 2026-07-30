'use client'

// Every component in this app is interactive — MediaRecorder, timers, state —
// so there is no server-rendered surface to gain from. "use client" here covers
// the whole tree below it.

import { useState } from 'react'
import Recorder from '@/components/Recorder'
import Countdown from '@/components/Countdown'
import ClaimCard from '@/components/ClaimCard'
import { submitAudio } from '@/lib/api'

export default function Home() {
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleClip(blob) {
    setBusy(true)
    setError(null)
    try {
      setResult(await submitAudio(blob))
    } catch (e) {
      setError(e.message || 'Something went wrong. Record again.')
    } finally {
      setBusy(false)
    }
  }

  const lead = result?.claims?.[0]

  return (
    <main className="shell">
      <header>
        <span className="offline-tag"><span className="offline-dot" />on-device · offline</span>
      </header>

      {lead && <Countdown claim={lead} />}

      <Recorder onClip={handleClip} busy={busy} />

      {error && <div className="error" style={{ marginTop: 16 }}>{error}</div>}

      {result?.needs_date_confirmation && (
        <div className="notice" style={{ marginTop: 16 }}>
          ದಿನಾಂಕ ದೃಢಪಡಿಸಿ: {result.event.event_datetime_raw}
          <div className="eyebrow" style={{ marginTop: 6 }}>
            Time was inferred, not stated. Confirm before relying on the countdown.
          </div>
        </div>
      )}

      {result?.clarifying_question_kn && (
        <div className="notice" style={{ marginTop: 16 }}>{result.clarifying_question_kn}</div>
      )}

      {result?.transcript && <p className="transcript">{result.transcript}</p>}

      {result?.claims?.map((claim) => (
        <ClaimCard key={claim.rule_id} claim={claim} event={result.event} />
      ))}

      {!result && !busy && (
        <div className="empty">
          <p>ಬೆಳೆ ಹಾನಿ ಆಗಿದೆಯೇ? ಮೇಲಿನ ಬಟನ್ ಒತ್ತಿ ಏನಾಯಿತು ಹೇಳಿ.</p>
          <div className="eyebrow">Speak in Kannada. Works with no internet.</div>
        </div>
      )}
    </main>
  )
}
