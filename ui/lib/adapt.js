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

/** Map an API Case onto the local case shape used throughout page.jsx. */
export function adaptCase(apiCase, lang = 'kn') {
  const claim = apiCase.claim || {}

  // Prefer the language-neutral fields, which hold whatever language was
  // requested. Fall back to the _kn ones for older responses.
  const checklist =
    claim.evidence_checklist?.length ? claim.evidence_checklist : claim.evidence_checklist_kn || []

  return {
    id: apiCase.case_id,
    ruleId: apiCase.rule_id,
    state: apiCase.state,

    // Display strings
    schemeKn: claim.scheme_name_kn || '',
    schemeEn: claim.scheme_name_en || '',
    scheme: claim.scheme_name || (lang === 'en' ? claim.scheme_name_en : claim.scheme_name_kn),
    expl: claim.explanation || claim.explanation_kn || '',
    explKn: claim.explanation_kn || '',
    consequence: claim.failure_consequence || claim.failure_consequence_kn || '',

    // The countdown. page.jsx works in epoch ms; the API sends ISO 8601.
    deadline: claim.deadline_iso ? new Date(claim.deadline_iso).getTime() : null,
    deadlineIso: claim.deadline_iso || null,
    hoursRemaining: claim.hours_remaining ?? null,
    status: claim.status,

    // Steps carry their own ids - required for PATCH and photo upload.
    steps: (apiCase.steps || []).map((step, index) => ({
      id: step.step_id,
      text: checklist[index] ?? step.text_kn,
      textKn: step.text_kn,
      done: step.done,
      needsPhoto: step.needs_photo,
      photoId: step.photo_id,
    })),

    channels: claim.channels || [],
    photos: apiCase.photos || [],

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
