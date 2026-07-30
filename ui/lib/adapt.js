/**
 * Maps API responses onto the shape app/page.jsx already uses.
 *
 * Why an adapter instead of rewriting page.jsx
 * --------------------------------------------
 * page.jsx works, looks right, and its language toggle is already correct. Its
 * local case objects just use different field names from the API contract
 * (schemeKn vs scheme_name_kn, deadline in ms vs deadline_iso). Renaming every
 * reference across 1491 lines at this hour is how you break a working screen.
 *
 * So: keep the screen, translate at the boundary. If the contract changes,
 * this file changes and nothing else does.
 *
 * The shapes below are verified against ui/lib/contract-snapshot.json, which is
 * generated from real backend responses by scripts/snapshot_contract.py.
 */

const HOUR_MS = 3600e3
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const pad2 = (n) => String(n).padStart(2, '0')

/** "28 JUL 2026" - the format page.jsx already prints elsewhere. */
function shortDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Which datetime the clock runs from.
 *
 * RBI runs from the bank's communication, PMFBY from the event itself. Getting
 * this wrong would silently mis-size the progress bar, so it mirrors
 * `window_starts_at` in the rule files rather than assuming event_datetime.
 */
function clockStart(event) {
  return event?.bank_communication_datetime || event?.event_datetime || null
}

/**
 * Rule window length in hours, derived from deadline minus clock start.
 *
 * The API does not send the window itself - it sends the computed deadline -
 * but page.jsx needs the span to size the progress bar. Falls back to 72h so a
 * missing datetime cannot produce a NaN width.
 */
function windowHours(claim, event) {
  const start = clockStart(event)
  if (!start || !claim.deadline_iso) return 72
  const span = (new Date(claim.deadline_iso).getTime() - new Date(start).getTime()) / HOUR_MS
  return span > 0 ? Math.round(span) : 72
}

/** One-line "what was lost" summary: crop and area, or the disputed amount. */
function meta(event, lang) {
  if (!event) return ''
  const kn = lang === 'kn'
  if (event.transaction_amount != null) {
    return `₹${Number(event.transaction_amount).toLocaleString('en-IN')}`
  }
  const parts = []
  if (event.crop) parts.push(event.crop)
  if (event.area_acres != null) parts.push(`~${event.area_acres} ${kn ? 'ಎಕರೆ' : 'acres'}`)
  return parts.join(' · ')
}

/**
 * Split a channel string into a label and a contact value.
 *
 * The rule files store channels as single English strings ("Cyber fraud
 * helpline 1930"), but page.jsx renders a label on the left and a contact on
 * the right. Pull out a phone number or a domain if one is present; otherwise
 * the whole string is the label and the right column stays empty.
 */
function splitChannel(text) {
  const str = String(text || '')
  const phone = str.match(/\b(\d{3,5}|\d{10})\b/)
  if (phone) {
    const label = str.replace(phone[0], '').replace(/\s{2,}/g, ' ').trim()
    return { label: label || str, v: phone[0] }
  }
  const domain = str.match(/\b([a-z0-9-]+\.(?:gov\.in|org\.in|rbi\.org\.in|in|com|gov))\b/i)
  if (domain) {
    const label = str.replace(domain[0], '').replace(/^[\s·-]+|[\s·-]+$/g, '').trim()
    return { label: label || str, v: domain[0] }
  }
  return { label: str, v: '' }
}

/** Map an API Case onto the local case shape used throughout page.jsx. */
export function adaptCase(apiCase, lang = 'kn') {
  const claim = apiCase.claim || {}
  const event = apiCase.event || {}

  // Prefer the language-neutral fields, which hold whatever language was
  // requested. Fall back to the _kn ones for older responses.
  const checklist =
    claim.evidence_checklist?.length ? claim.evidence_checklist : claim.evidence_checklist_kn || []

  // A Case stores the claim in whatever language it was created with, and
  // GET /api/cases takes no lang parameter. So English is only genuinely
  // available when the stored claim is already English; otherwise the neutral
  // field holds Kannada and we surface that rather than inventing a
  // translation. Re-record in English to get English content.
  const storedEn = claim.lang === 'en'
  const explanation = claim.explanation || claim.explanation_kn || ''
  const consequence = claim.failure_consequence || claim.failure_consequence_kn || ''

  const winH = windowHours(claim, event)
  const eventIso = clockStart(event)
  const photoById = new Map((apiCase.photos || []).map((p) => [p.photo_id, p]))

  return {
    id: apiCase.case_id,
    ruleId: apiCase.rule_id,
    // Rendered as "{id} · {rule}" on the home card. The rule id is what the
    // backend can actually vouch for, so show that rather than a hand-typed
    // statute citation that nothing verifies.
    rule: apiCase.rule_id || claim.rule_id || '',
    state: apiCase.state,

    // Display strings
    schemeKn: claim.scheme_name_kn || '',
    schemeEn: claim.scheme_name_en || '',
    scheme: claim.scheme_name || (lang === 'en' ? claim.scheme_name_en : claim.scheme_name_kn),
    expl: explanation,
    explKn: claim.explanation_kn || '',
    explEn: storedEn ? explanation : claim.explanation_kn || '',
    consequence,
    consequenceKn: claim.failure_consequence_kn || '',

    // "cotton · ~1.5 acres" under the scheme name, and in the PDF facts table.
    metaKn: meta(event, 'kn'),
    metaEn: meta(event, 'en'),
    eventDate: shortDate(eventIso),
    eventDateEn: shortDate(eventIso),

    // The countdown. page.jsx works in epoch ms; the API sends ISO 8601.
    deadline: claim.deadline_iso ? new Date(claim.deadline_iso).getTime() : null,
    deadlineIso: claim.deadline_iso || null,
    hoursRemaining: claim.hours_remaining ?? null,
    status: claim.status,

    // Sizes the progress bar, and labels the rule window on S3 and the PDF.
    windowH: winH,
    windowLabel: `${winH} ಗಂಟೆ`,
    windowLabelEn: `${winH} hours`,

    // Steps carry their own ids - required for PATCH and photo upload.
    // `kn`/`en`/`photo`/`shot` are the names the S3 checklist renders from.
    steps: (apiCase.steps || []).map((step, index) => {
      const photo = step.photo_id ? photoById.get(step.photo_id) : null
      const localised = checklist[index] ?? step.text_kn
      return {
        id: step.step_id,
        text: localised,
        textKn: step.text_kn,
        kn: step.text_kn,
        en: localised,
        done: step.done,
        photo: step.needs_photo,
        needsPhoto: step.needs_photo,
        photoId: step.photo_id,
        shot: photo
          ? {
              at: photo.captured_at
                ? `${pad2(new Date(photo.captured_at).getHours())}:${pad2(new Date(photo.captured_at).getMinutes())}`
                : '--:--',
              coords:
                photo.lat != null && photo.lon != null
                  ? `${Number(photo.lat).toFixed(4)}${photo.lat >= 0 ? 'N' : 'S'} ${Number(photo.lon).toFixed(4)}${photo.lon >= 0 ? 'E' : 'W'}`
                  : 'no location',
              verified: photo.location_verified,
            }
          : null,
      }
    }),

    // page.jsx renders {label, contact} pairs; the API sends flat strings.
    channels: (claim.channels || []).map((c) => {
      const { label, v } = splitChannel(c)
      return { kn: label, en: label, v }
    }),
    photos: apiCase.photos || [],

    // Kept whole: POST /api/document wants the original EventReport back.
    event,

    // Shown in the footer. A judge will ask how you know the rule is right.
    src: claim.source_url || '',
    verified: claim.verified_on || '',

    createdAt: apiCase.created_at,
  }
}

export function adaptCases(apiCases, lang = 'kn') {
  return (apiCases || []).map((c) => adaptCase(c, lang))
}

/** Map an intake response onto what the S2 "facts extracted" panel renders. */
export function adaptIntake(response, lang = 'kn') {
  const event = response.event || {}
  return {
    caseId: response.case_id,
    lang: response.lang,
    transcript: response.transcript,
    facts: {
      crop: event.crop,
      when: event.event_datetime_raw,
      area: event.area_acres != null ? `~${event.area_acres} acres` : null,
      eventType: event.event_type,
      // Below 0.9 the UI must ask the person to confirm the date rather than
      // showing a countdown built on an inferred time.
      dateConfidence: event.confidence?.event_datetime ?? null,
    },
    needsDateConfirmation: response.needs_date_confirmation,
    question: response.clarifying_question || response.clarifying_question_kn || null,
    options: response.clarifying_options?.length
      ? response.clarifying_options
      : response.clarifying_options_kn || [],
    cases: adaptCases(
      (response.claims || []).map((claim) => ({
        case_id: response.case_id,
        rule_id: claim.rule_id,
        claim,
        steps: [],
        photos: [],
        state: 'open',
      })),
      lang,
    ),
  }
}

/** Map a scan response onto the S0b confirmation screen. */
export function adaptScan(response) {
  const fields = response.fields || {}
  return {
    kind: response.kind,
    fields: Object.entries(fields).map(([name, field]) => ({
      name,
      value: field.value,
      confidence: field.confidence,
      // Anything flagged here renders large, monospace, editable.
      needsConfirmation: (response.needs_confirmation || []).includes(name),
    })),
  }
}
