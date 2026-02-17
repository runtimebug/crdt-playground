# CRDT Playground

Interactive demo of **Conflict-free Replicated Data Types** using [Yjs](https://yjs.dev).

**[Live Demo](https://runtimebug.github.io/crdt-playground/)**

> Two simulated peers edit shared data structures in real-time. Toggle them offline, make conflicting edits, then reconnect — CRDTs merge everything automatically, no conflicts.

<video src="https://github.com/user-attachments/assets/ee892577-5b0e-45b5-9686-5eebbdbaa2b3" controls muted width="100%" autoplay loop></video>

## What it demonstrates

| CRDT Type | What you see |
|-----------|-------------|
| **Y.Text** | Two textareas sharing the same text — character-level merging via the YATA algorithm |
| **Y.Map** | A shared counter where each peer owns its own key — increments never conflict |

### Network simulation

- Toggle each peer **offline** independently
- While offline, edits are queued (shown as amber in the sync log)
- On reconnect, **state-vector-based reconciliation** syncs only the missing deltas

### Under the hood

The visualization section shows Yjs internals in real time:
- Each character as a linked-list node with its unique `(client:clock)` ID
- Tombstones (deleted characters still preserved in the structure)
- State vectors tracking each peer's known history

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Project structure

```
src/
├── crdt/
│   ├── peer.ts              # CRDTPeer — wraps Y.Doc with typed accessors
│   └── sync-engine.ts       # Simulated network sync between peers
├── ui/
│   ├── peer-panel.ts        # Per-peer UI (text editor, counter)
│   ├── algorithm-viz.ts     # YATA algorithm visualization
│   ├── network-controls.ts  # Online/offline toggles
│   └── update-log.ts        # Scrolling log of sync events
├── utils/
│   └── escape-html.ts       # HTML escaping utility
├── main.ts                  # Entry point — wires everything together
└── style.css                # Dark theme
```

## Taking this to production

This demo runs entirely in the browser with an in-memory sync engine. To ship real multi-device collaborative editing, swap the sync engine for a persistence + network layer:

1. **Persist** Yjs updates as rows in a local SQLite table via a sync engine like [PowerSync](https://powersync.com)
2. **Sync** — the engine replicates rows to your backend DB and fans them out to other clients
3. **Apply** — a watch query detects new rows, decodes them, and applies to the in-memory `Y.Doc`
4. **Origin tracking** prevents infinite loops (don't re-persist updates loaded from the DB)

Other viable sync layers: [y-websocket](https://github.com/yjs/y-websocket), [y-indexeddb](https://github.com/yjs/y-indexeddb), [Liveblocks](https://liveblocks.io), [PartyKit](https://partykit.io).

## Tech stack

- **Yjs** — CRDT library (YATA algorithm for sequences, LWW-Register for maps)
- **TypeScript** — Strict mode, zero `any`
- **Vite** — Build tool + dev server
- **Vanilla DOM** — No framework, ~700 lines of source

## License

MIT
