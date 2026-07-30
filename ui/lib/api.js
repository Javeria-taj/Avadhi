// Single place the UI talks to the backend. Requests go to /api/* and
// next.config.mjs rewrites them to FastAPI — same origin, so no CORS and no
// mixed-content failure when the page is served over HTTPS.
import { MOCK_INTAKE } from './mocks'

// NEXT_PUBLIC_ prefix is mandatory. Without it this is undefined in the browser
// and mocks silently never turn on.
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true'

export async function submitAudio(blob) {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 1200))
    return MOCK_INTAKE
  }
  const form = new FormData()
  form.append('audio', blob, 'clip.webm')
  const res = await fetch('/api/intake', { method: 'POST', body: form })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail?.detail || 'Intake failed')
  }
  return res.json()
}

export async function fetchDocument(ruleId, event) {
  const res = await fetch('/api/document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rule_id: ruleId, event }),
  })
  if (!res.ok) throw new Error('Could not generate the document')
  return URL.createObjectURL(await res.blob())
}
