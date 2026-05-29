# Players tab — routes & UI sketch (v0)

## Route sketch (SPA hash)

Primary surface is shallow hash routing (`replaceState` — no noisy history spam while comparing).

| Shape | Meaning |
|--------|---------|
| `#/players` | Open Players workbench |
| `#/players?w=487` | Open drawer focused on waiver element **487** |
| `#/players?w=487&b=449` | Compare **487** vs your roster player **449** |
| `#/players?w=487&b=449&t=31076` | Same, with “my squad” set to league entry **31076** (`teamsForFormSelect.id`) |

Leaving the Players tab clears the hash (implemented in `stripPlayersHash`).

ASCII flow:

```
[list: FA / Taken pills] ──tap row──► [drawer: stat pills + hindsight]
                              │
                              ├► select teammate (same POS)
                              └► radar + raw table + URL ?w=&b=&t=
```

## Mobile-first layout (intent)

```
┌─────────────────────────────┐  ┌─────────────────────────────┐
│ My squad ▼   [Avail only ☑] │  │ 🔍 Search…                  │
├─────────────────────────────┤  ├─────────────────────────────┤
│ [shirt] Watkins   AVL FWD … │  │ scrollable waiver list…     │
│ [shirt] Gibbs…    NFO MID … │  │                             │
│            …more rows…      │  │                             │
└─────────────────────────────┘  └─────────────────────────────┘
        ≤520px drawer becomes **bottom sheet** + safe-area padding
        >520px drawer **slides from right** (desktop / landscape tablet)
```

## Creative signal (this slice)

- **Waiver hindsight** callout when `pickups-tenure.json` shows a high-value tracked stint for that element id.
- **Auto “weakest teammate at position”** pre-selected as compare target when opening a waiver card.
- **FA / Taken** pills when draft squads load (requires live GW squad JSON like the Draft board).

## Next slices (not built yet)

- Fixture difficulty strip (`fixtures.json`, capped).
- GK inclusion + separate waiver sort (xGC, saves per 90).
- Share image / export compare card.
