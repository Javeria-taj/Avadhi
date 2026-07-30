# 02 — Claim Rules Knowledge Base

This is the substance of the project. The rules engine is deterministic, so **this file is the product.** Gemma extracts and explains; these rules decide.

---

## ⚠️ Two discrepancies you must resolve before the demo

Research surfaced conflicting official numbers. Do not put either on a slide until verified against a primary source.

**1. PMFBY helpline number.** Sources variously cite the Krishi Rakshak Portal helpline **14447**, and toll-free numbers **1800-200-7710** and **1800-180-1551**. The KRPH number 14447 appears in the most authoritative guidance. **Verify on pmfby.gov.in before the demo** — a judge from an agri background may know the right one, and quoting a wrong helpline in a product whose entire point is "call within 72 hours" is a bad look.

**2. PMJJBY waiting period.** LIC's claim procedure document states no claim is payable for death within **30 days** of joining; SBI's version of the same document states **45 days**. These may reflect different revisions. Encode whichever the current official scheme document says, and if you can't resolve it, exclude the waiting-period rule from the demo rather than assert a wrong one.

Rule of the project: **when a rule is uncertain, the system says "verify this" rather than asserting.** Say that out loud to judges — it's the correct engineering posture for anything touching someone's money.

---

## Rule 1 — PMFBY localised calamity (the demo centrepiece)

**Trigger event:** hailstorm, landslide, inundation/waterlogging, cloudburst, or post-harvest loss affecting an individual field.

**Window:** 72 hours from the event.

**Why this is the whole pitch:** multiple independent sources identify missing the 72-hour intimation window as the single most common cause of claim rejection, and note that being one day late can forfeit the entire season. The farmer is eligible, insured, and has genuinely lost the crop — and gets nothing because of a clock nobody told them about.

```jsonc
{
  "rule_id": "PMFBY_LOCALISED",
  "scheme": "Pradhan Mantri Fasal Bima Yojana",
  "trigger_predicates": [
    { "field": "event_type", "op": "in",
      "value": ["hailstorm","landslide","inundation","waterlogging","cloudburst","post_harvest_loss"] },
    { "field": "has_pmfby_policy", "op": "==", "value": true },
    { "field": "loss_scope", "op": "==", "value": "individual_field" }
  ],
  "window_hours": 72,
  "window_starts_at": "event_datetime",
  "channels": [
    "Crop Insurance mobile app",
    "pmfby.gov.in → Report Crop Loss",
    "Krishi Rakshak Helpline (VERIFY NUMBER)",
    "Insurance company call centre (number on policy certificate)",
    "Financing bank branch",
    "District/block agriculture or revenue officer"
  ],
  "required_at_intimation": [
    "policy_number",
    "survey_number_wise_crop_and_acreage_affected",
    "cause_of_loss",
    "date_and_time_of_event",
    "bank_account_number",
    "photos_or_video_of_damaged_crop"
  ],
  "downstream_timeline": [
    "Insurer deputes loss assessor within 48 hours of intimation",
    "Survey completed within ~10 days of appointment",
    "Claim released per individual loss assessment"
  ],
  "failure_consequence": "Claim liable to rejection regardless of actual loss."
}
```

**Evidence checklist the system should read aloud** (this is the genuinely useful output — a farmer standing in a flooded field needs to know what to photograph *now*, while the evidence still exists):

1. Wide shot of the field showing the extent of damage
2. Close shots of damaged crop, several spots
3. Something in frame establishing location — a boundary marker or landmark
4. Photograph the survey number stone/marker if present
5. Note the exact date and time the damage occurred
6. Keep the policy certificate and passbook to hand before calling

---

## Rule 2 — PMSBY accident claim

**Trigger:** accidental death, or permanent total/partial disability.
**Window:** commonly stated as **30 days** from the accident for submission to the bank branch.
**Benefit:** ₹2 lakh accidental death or total disability; ₹1 lakh partial disability.

```jsonc
{
  "rule_id": "PMSBY_ACCIDENT",
  "trigger_predicates": [
    { "field": "event_type", "op": "in", "value": ["accidental_death","disability"] },
    { "field": "had_savings_account_with_pmsby", "op": "==", "value": true },
    { "field": "age_at_event", "op": "between", "value": [18, 70] }
  ],
  "window_days": 30,
  "documents": ["claim_cum_discharge_form","death_certificate_or_disability_certificate",
                "FIR_copy","nominee_aadhaar_and_bank_details","passbook_first_two_pages"],
  "submit_to": "Bank branch where the PMSBY premium was auto-debited"
}
```

## Rule 3 — PMJJBY death claim

**Trigger:** death of the insured from any cause.
**Window:** commonly stated as **30 days** from death for the nominee to file.
**Benefit:** ₹2 lakh.
**Waiting period:** see discrepancy note above — 30 vs 45 days. Resolve or omit.

```jsonc
{
  "rule_id": "PMJJBY_DEATH",
  "trigger_predicates": [
    { "field": "event_type", "op": "==", "value": "death" },
    { "field": "had_savings_account_with_pmjjby", "op": "==", "value": true }
  ],
  "window_days": 30,
  "documents": ["claim_cum_discharge_form","death_certificate",
                "nominee_kyc","passbook_first_two_pages"],
  "submit_to": "Bank or post office where the premium was debited",
  "note": "If no nominee or nominee predeceased, legal heir needs a succession/legal heir certificate."
}
```

**The compounding insight worth stating in the pitch:** a single accidental death can trigger PMSBY *and* PMJJBY simultaneously — roughly ₹4 lakh combined. Families routinely claim one and never learn about the other, because the two premiums were silently auto-debited from the same account. One spoken sentence — "my husband died in a road accident last week" — should surface both clocks at once. That's the moment the engine stops looking like a lookup table.

---

## Rule 4 — Generic structure for extension

Every additional rule follows this shape. Adding a scheme is a data change, not a code change — say this to judges, it's the strongest argument that you built a system rather than a demo.

```jsonc
{
  "rule_id": "",
  "scheme": "",
  "trigger_predicates": [],
  "window_hours": null,
  "window_days": null,
  "window_starts_at": "event_datetime",
  "channels": [],
  "required_at_intimation": [],
  "evidence_checklist": [],
  "documents": [],
  "submit_to": "",
  "benefit_summary_en": "",
  "benefit_summary_kn": "",
  "failure_consequence": "",
  "source_url": "",
  "verified_on": ""
}
```

**`source_url` and `verified_on` are not optional.** When a judge asks "how do you know this rule is right?", you open the JSON and show the citation next to the rule. That single move answers the hardest question in the Q&A.

---

## Kannada content to prepare tonight

Write these by hand — do not let the model generate the demo strings live. Both of you are fluent; this is a 30-minute job and it makes the demo bulletproof.

For each rule: scheme name, one-line benefit, the deadline sentence, the evidence checklist, and the "what to do right now" instruction.

**Deadline sentence template (Kannada), spoken by the system:**
> "You have [N] hours remaining. Report before [date, time]. If you miss it, this claim may be rejected."

**The intake script for the live demo** — B speaks something close to this, unscripted in delivery but rehearsed in content:
> "Last night's hail destroyed my cotton. About one and a half acres. I have a Fasal Bima policy through the bank."

Expected extraction: `event_type: hailstorm`, `event_datetime: last night`, `crop: cotton`, `area_acres: 1.5`, `has_pmfby_policy: true` → PMFBY_LOCALISED fires → ~48 hours remaining → evidence checklist + channels + generated intimation.

---

## Scope discipline

**P0 — must work:** Rule 1 only. Speech → extraction → countdown → checklist → generated intimation document.

**P1 — if ahead at T+20:** Rules 2 and 3, and the compounding PMSBY+PMJJBY reveal.

**P2 — slide only, never built:** everything else. A slide listing the extension rules is worth more than a half-working second flow.
