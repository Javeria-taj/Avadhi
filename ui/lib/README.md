# ui/lib

| File | What it is |
|---|---|
| `api.js` | Every backend call. Mock mode reads `contract-snapshot.json`. |
| `adapt.js` | Maps API shapes onto the field names `app/page.jsx` already uses. |
| `contract-snapshot.json` | **Generated.** Do not hand-edit. |

`mocks.js` was deleted. It was hand-written and had drifted from the contract —
missing `lang`, `case_id`, `explanation`, `evidence_checklist`, `clarifying_options`
and more. `contract-snapshot.json` is produced from real backend responses, so it
cannot drift.

Regenerate after any schema change:

```bash
make snapshot     # or: python scripts/snapshot_contract.py
```

`tests/test_contract_snapshot.py` fails if it goes stale.
