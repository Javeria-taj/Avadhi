// Mirrors the frozen contract in api/models/schemas.py exactly.
// If this file and the Pydantic schemas disagree, the contract broke.
const inTwoDays = new Date(Date.now() + 48 * 3600 * 1000).toISOString()

export const MOCK_INTAKE = {
  transcript:
    'ನಿನ್ನೆ ರಾತ್ರಿ ಆಲಿಕಲ್ಲು ಮಳೆಯಿಂದ ನನ್ನ ಹತ್ತಿ ಬೆಳೆ ಹಾಳಾಗಿದೆ. ಸುಮಾರು ಒಂದೂವರೆ ಎಕರೆ.',
  event: {
    event_type: 'hailstorm',
    event_datetime: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    event_datetime_raw: 'last night',
    crop: 'cotton',
    area_acres: 1.5,
    has_pmfby_policy: true,
    missing_fields: [],
    confidence: { event_datetime: 0.7 },
  },
  claims: [
    {
      rule_id: 'PMFBY_LOCALISED',
      scheme_name_en: 'Pradhan Mantri Fasal Bima Yojana',
      scheme_name_kn: 'ಪ್ರಧಾನ ಮಂತ್ರಿ ಫಸಲ್ ಬಿಮಾ ಯೋಜನೆ',
      status: 'open',
      deadline_iso: inTwoDays,
      hours_remaining: 48,
      matched_rules: ['event_type in [hailstorm,…]', 'has_pmfby_policy == true'],
      missing_info: [],
      evidence_checklist_kn: [
        'ಹೊಲದ ಪೂರ್ತಿ ನೋಟದ ಫೋಟೋ ತೆಗೆಯಿರಿ',
        'ಹಾನಿಯಾದ ಬೆಳೆಯ ಹತ್ತಿರದ ಫೋಟೋಗಳು',
        'ಗಡಿ ಕಲ್ಲು ಅಥವಾ ಗುರುತು ಫೋಟೋದಲ್ಲಿ ಇರಲಿ',
        'ಸರ್ವೆ ನಂಬರ್ ಕಲ್ಲಿನ ಫೋಟೋ',
        'ಹಾನಿ ಆದ ದಿನಾಂಕ ಮತ್ತು ಸಮಯ ಬರೆದಿಟ್ಟುಕೊಳ್ಳಿ',
      ],
      channels: ['Crop Insurance mobile app', 'pmfby.gov.in', 'Your financing bank branch'],
      explanation_kn: 'ನಿಮಗೆ ಇನ್ನೂ 48 ಗಂಟೆ ಸಮಯವಿದೆ. ಈಗಲೇ ಫೋಟೋ ತೆಗೆದು ವಿಮಾ ಕಂಪನಿಗೆ ತಿಳಿಸಿ.',
      failure_consequence_kn: '72 ಗಂಟೆಯೊಳಗೆ ತಿಳಿಸದಿದ್ದರೆ ಕ್ಲೇಮ್ ತಿರಸ್ಕೃತವಾಗಬಹುದು.',
      source_url: 'https://pmfby.gov.in/',
      verified_on: '2026-07-29',
      form_id: 'pmfby_intimation_v1',
    },
  ],
  clarifying_question_kn: null,
  needs_date_confirmation: true,
}
