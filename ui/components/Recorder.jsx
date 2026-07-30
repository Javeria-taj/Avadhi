'use client'

import { useRef, useState } from 'react'

// Tap to start, tap to stop — not press-and-hold. The user has one wet hand.
export default function Recorder({ onClip, busy }) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])

  async function start() {
    setError(null)

    // navigator.mediaDevices is undefined on insecure origins — checking
    // explicitly turns a confusing exception into a message naming the fix.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setError('ಮೈಕ್ ಸಿಗಲಿಲ್ಲ. Microphone unavailable — this page must be served over HTTPS.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        onClip(new Blob(chunksRef.current, { type: 'audio/webm' }))
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
    } catch {
      setError('ಮೈಕ್ ಸಿಗಲಿಲ್ಲ. Microphone blocked — check permissions, and that this is HTTPS.')
    }
  }

  function stop() {
    recorderRef.current?.stop()
    setRecording(false)
  }

  return (
    <>
      {error && <div className="error">{error}</div>}
      <button
        className="record"
        data-recording={recording}
        disabled={busy}
        onClick={recording ? stop : start}
      >
        {recording && <span className="pulse" />}
        {busy ? 'ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…' : recording ? 'ನಿಲ್ಲಿಸಿ' : 'ಮಾತನಾಡಿ — ಏನಾಯಿತು ಹೇಳಿ'}
      </button>
    </>
  )
}
