/**
 * Every call the UI makes to the backend, in one place.
 *
 * Requests go to /api/* and next.config.mjs rewrites them to FastAPI - same
 * origin, so no CORS and no mixed-content failure when the page is HTTPS.
 *
 * Mock mode reads ui/lib/contract-snapshot.json, which is generated from REAL
 * backend responses by scripts/snapshot_contract.py. Hand-written mocks drift;
 * generated ones cannot.
 */
import snapshot from './contract-snapshot.json'

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true'

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

async function request(path, options = {}) {
  const res = await fetch(path, options)
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      detail = (await res.json())?.detail || detail
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail)
  }
  return res
}

// --- cases ------------------------------------------------------------------

export async function listCases() {
  if (USE_MOCKS) {
    await delay(300)
    return snapshot['GET /api/cases']
  }
  return (await request('/api/cases')).json()
}

export async function getCase(caseId) {
  if (USE_MOCKS) {
    await delay(200)
    return snapshot['GET /api/cases/{id}']
  }
  return (await request(`/api/cases/${caseId}`)).json()
}

export async function setStepDone(caseId, stepId, done) {
  if (USE_MOCKS) {
    await delay(150)
    return snapshot['GET /api/cases/{id} (in progress)']
  }
  return (
    await request(`/api/cases/${caseId}/steps/${stepId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    })
  ).json()
}

// --- intake -----------------------------------------------------------------

export async function submitAudio(blob, lang) {
  if (USE_MOCKS) {
    await delay(1200)
    return snapshot[lang === 'en' ? 'POST /api/intake (en)' : 'POST /api/intake (kn)']
  }
  const form = new FormData()
  form.append('audio', blob, 'clip.webm')
  // Without this the backend auto-detects, and an English speaker can get
  // Kannada content back despite the toggle.
  if (lang) form.append('lang', lang)
  return (await request('/api/intake', { method: 'POST', body: form })).json()
}

// --- photos -----------------------------------------------------------------

export async function uploadPhoto(caseId, blob, { lat, lon, accuracy, capturedAt, stepId }) {
  if (USE_MOCKS) {
    await delay(400)
    return { photo_id: 'p_mock', location_verified: lat != null, captured_at: capturedAt }
  }
  const form = new FormData()
  form.append('image', blob, 'capture.jpg')
  // Optional on purpose: a denied location permission must not block the
  // capture. The backend marks it location_verified: false.
  if (lat != null) form.append('lat', String(lat))
  if (lon != null) form.append('lon', String(lon))
  if (accuracy != null) form.append('accuracy_m', String(accuracy))
  if (capturedAt) form.append('captured_at', capturedAt)
  if (stepId) form.append('step_id', stepId)
  return (await request(`/api/cases/${caseId}/photo`, { method: 'POST', body: form })).json()
}

export function photoUrl(caseId, photoId) {
  return `/api/cases/${caseId}/photo/${photoId}`
}

// --- document ---------------------------------------------------------------

export async function fetchDocument(ruleId, event) {
  if (USE_MOCKS) {
    await delay(500)
    // No real PDF in mock mode. Callers must handle a null URL rather than
    // opening about:blank.
    return null
  }
  const res = await request('/api/document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rule_id: ruleId, event }),
  })
  return URL.createObjectURL(await res.blob())
}

// --- profile / onboarding ---------------------------------------------------

export async function getProfile() {
  if (USE_MOCKS) {
    await delay(150)
    return snapshot['GET /api/profile (first run)']
  }
  return (await request('/api/profile')).json()
}

export async function getCompleteness() {
  if (USE_MOCKS) {
    await delay(150)
    return snapshot['GET /api/profile/completeness (first run)']
  }
  return (await request('/api/profile/completeness')).json()
}

export async function scanDocument(blob, kind) {
  if (USE_MOCKS) {
    await delay(1500)
    return snapshot[`POST /api/profile/scan (${kind})`]
  }
  const form = new FormData()
  form.append('image', blob, 'doc.jpg')
  form.append('kind', kind)
  return (await request('/api/profile/scan', { method: 'POST', body: form })).json()
}

export async function confirmScan(kind, fields) {
  if (USE_MOCKS) {
    await delay(300)
    return snapshot['POST /api/profile/confirm']
  }
  const form = new FormData()
  form.append('kind', kind)
  // What the PERSON approved on screen, not what the model read.
  form.append('fields', JSON.stringify(fields))
  return (await request('/api/profile/confirm', { method: 'POST', body: form })).json()
}

export async function resetProfile() {
  if (USE_MOCKS) return snapshot['GET /api/profile (first run)']
  return (await request('/api/profile/reset', { method: 'POST' })).json()
}

// --- health -----------------------------------------------------------------

export async function health() {
  if (USE_MOCKS) return snapshot['GET /health']
  return (await request('/health')).json()
}
