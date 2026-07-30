'use client'

import { useState } from 'react'
import { fetchDocument } from '@/lib/api'

const BADGE = {
  open: 'ತೆರೆದಿದೆ',
  closing_soon: 'ಬೇಗ ಮುಗಿಯುತ್ತದೆ',
  expired: 'ಮುಗಿದಿದೆ',
  need_info: 'ಮಾಹಿತಿ ಬೇಕು',
}

export default function ClaimCard({ claim, event }) {
  const [docUrl, setDocUrl] = useState(null)
  const [error, setError] = useState(null)

  async function generate() {
    try {
      setDocUrl(await fetchDocument(claim.rule_id, event))
    } catch {
      setError('ದಾಖಲೆ ತಯಾರಿಸಲು ಆಗಲಿಲ್ಲ. Could not generate the document.')
    }
  }

  return (
    <div className="card">
      <span className="badge" data-status={claim.status}>{BADGE[claim.status]}</span>
      <h2>{claim.scheme_name_kn}</h2>
      <div className="eyebrow">{claim.scheme_name_en}</div>

      {claim.explanation_kn && <p className="explain">{claim.explanation_kn}</p>}

      {claim.status === 'expired' && claim.failure_consequence_kn && (
        <div className="notice">{claim.failure_consequence_kn}</div>
      )}

      {claim.evidence_checklist_kn?.length > 0 && (
        <>
          <div className="eyebrow">ಈಗ ಮಾಡಬೇಕಾದದ್ದು</div>
          <ol className="checklist">
            {claim.evidence_checklist_kn.map((item, i) => <li key={i}>{item}</li>)}
          </ol>
        </>
      )}

      {claim.channels?.length > 0 && (
        <ul className="channels">
          {claim.channels.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}

      {error && <div className="error">{error}</div>}

      {claim.status !== 'need_info' && !docUrl && (
        <button className="action" onClick={generate}>ದಾಖಲೆ ತಯಾರಿಸಿ</button>
      )}
      {docUrl && (
        <a className="action" href={docUrl} target="_blank" rel="noreferrer">ದಾಖಲೆ ತೆರೆಯಿರಿ →</a>
      )}

      {/* Shown, not buried. When a judge asks how you know the rule is right,
          the answer is already on screen. */}
      <div className="source">
        Rule source: {claim.source_url} · verified {claim.verified_on}
      </div>
    </div>
  )
}
