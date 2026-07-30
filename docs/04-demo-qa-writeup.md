# 04 — Demo, Q&A, Write-up

---

## The problem statement

Say this, in these words:

> A farmer's crop is destroyed by hail. He is insured. He paid the premium. He is fully eligible.
> He gets nothing — because the loss had to be reported within 72 hours, and nobody told him the clock was running.
>
> Missing that window is the single most common reason crop insurance claims are rejected in India.

No setup required. No category to justify. The loss is money, the cause is a deadline, and the fix is information delivered in time.

---

## Five-minute script

| Time | Beat |
|---|---|
| 0:00–0:30 | **Problem.** The paragraph above. Do not rush it — it is the whole pitch. |
| 0:30–1:50 | **Live demo.** Airplane mode ON, visibly. B speaks in Kannada: *"Last night's hail destroyed my cotton, about one and a half acres, I have a Fasal Bima policy through the bank."* Countdown appears: **~48 hours remaining.** Evidence checklist reads aloud in Kannada. Say nothing over this. |
| 1:50–2:20 | **Artifact.** The generated intimation document on screen. This is what he takes to the bank. |
| 2:20–3:20 | **Architecture.** Four stages. Land hard: *the model never computes the deadline and never decides eligibility — a deterministic engine does, and every rule carries a source citation we can show you.* |
| 3:20–4:00 | **Measurements.** Peak RAM, tok/s, cold load, plus the handicapped run. State plainly: no midrange device available, so the envelope was measured rather than assumed. |
| 4:00–4:40 | **Extension.** Same engine, other clocks — PMSBY 30 days, PMJJBY 30 days. One accidental death triggers both, roughly ₹4 lakh, and families routinely claim one and never learn about the other. Adding a scheme is a JSON file, not a code change. |
| 4:40–5:00 | **Honest limits.** Three rules verified against primary sources, not thirty unverified. Next: state-notified perils, agriculture-officer pilot. |

**Rehearse 15+ times.** Record a clean backup run at T+32. Never demo without one.

---

## Judge Q&A — rehearse these aloud

**"Doesn't the Crop Insurance app already do this?"**
It's a reporting channel — it assumes you already know you must report, and that the window is 72 hours. Our user doesn't. We start from a spoken sentence in Kannada and produce the deadline, the evidence list, and the document. Different problem: theirs is submission, ours is *knowing to submit*.

**"How do you know your rules are correct?"**
Every rule carries a source URL and a verification date in the JSON — we can show you right now. Where sources conflict, the system says "verify this" instead of asserting. We found two such conflicts and handled both that way rather than guessing.

**"What if the model extracts the wrong date?"**
It can't set the deadline — it emits a relative descriptor and a confidence score, and code resolves it. Below a confidence threshold the system asks the user to confirm the date before showing a countdown. When someone's claim depends on the answer, confirming is correct behaviour, not friction.

**"Why Gemma and not a cloud API?"**
Four capabilities are load-bearing: native audio for Kannada speech, function calling for structured extraction, long context over scheme documents, and edge deployment. And the deployment reality decides it — a farmer standing in a flooded field has poor connectivity precisely when the 72-hour clock starts. A cloud dependency fails exactly when the product is needed.

**"You demoed on a flagship phone."**
Correct, and it's our weakest point. Here are our measured numbers and a deliberately handicapped run. We'd want field testing on real hardware before claiming more.

**"Is this Financial Inclusion?"**
Crop insurance, life cover and accident cover are financial products. The barrier to collecting on them is informational, not financial. That's inclusion.

**"Only three schemes?"**
Deliberate. Every rule is verified against a primary source. Three verified beats thirty unverified when the output is a claim someone acts on.

**"What if they miss the window anyway?"**
We still show it, marked expired, with the grievance route. Hiding bad news would make the system untrustworthy.

---

## Kaggle write-up skeleton

Write section 1 and the diagram at T+10 while A is still building. Do not leave this to T+30.

1. **The problem** — the 72-hour window, why it's the most common rejection cause, who it affects. Cite sources.
2. **Who this is for** — small and marginal farmers, Kannada-speaking, low connectivity, often assisted by an agriculture officer or CSC operator.
3. **Approach** — the four-stage pipeline diagram, and the extraction/decision separation stated explicitly as the core design choice.
4. **Why Gemma** — the four load-bearing capabilities. Include the measured on-device numbers here; this is where a technical reader looks.
5. **The rules engine** — predicate structure, an example rule JSON with its citation, deadline arithmetic, the timezone and relative-date handling.
6. **What we verified and what we didn't** — include the two source discrepancies and how you handled them. This section will earn more credit than any feature list. Most write-ups claim completeness; yours demonstrates method.
7. **Limits and next steps** — hardware testing, state-notified perils, field validation with agriculture officers.
8. **Repository and video links.**

**Video (architectural walkthrough):** A narrates. Screen recording, 3–4 minutes. Structure: problem in 20 seconds, live run, then a code walkthrough of `rules/engine.py` with the model deliberately not in the loop. Show the rule JSON with its `source_url`. That's the artifact that proves the claim.

---

## Final-hour checklist

- [ ] `GET /health` returns ok on the demo device
- [ ] Airplane mode on, full run completed successfully
- [ ] Backup video recorded and playable **offline**
- [ ] HDMI adapter tested on the actual projector
- [ ] Both devices >80% charged, power bank packed
- [ ] Kaggle write-up submitted — before the deadline, not at it
- [ ] Repo public, README with setup steps, commits inside the event window
- [ ] Helpline number verified against pmfby.gov.in
- [ ] Both of you have said the deterministic-engine line out loud at least five times
