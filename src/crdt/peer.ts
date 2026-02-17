import * as Y from 'yjs';

export type UpdateCallback = (update: Uint8Array, origin: unknown) => void;

/**
 * CRDTPeer wraps a Yjs Y.Doc and exposes typed accessors
 * for the CRDT data structures we demonstrate:
 *   - Y.Text  (collaborative text editing via YATA algorithm)
 *   - Y.Map   (per-peer counter using LWW-Register keys)
 */
export class CRDTPeer {
  readonly doc: Y.Doc;
  readonly name: string;

  /** Collaborative text — character-level conflict-free merging */
  readonly text: Y.Text;

  /** Per-peer counter keys — each peer owns its own key, total = sum of all values */
  readonly counters: Y.Map<number>;

  constructor(name: string) {
    this.name = name;
    this.doc = new Y.Doc();
    this.text = this.doc.getText('shared-text');
    this.counters = this.doc.getMap('counters');
  }

  /** Register a callback that fires on every local Y.Doc mutation */
  onUpdate(cb: UpdateCallback): void {
    this.doc.on('update', cb);
  }

  offUpdate(cb: UpdateCallback): void {
    this.doc.off('update', cb);
  }

  /** Apply a remote update to this doc */
  applyUpdate(update: Uint8Array, origin?: unknown): void {
    Y.applyUpdate(this.doc, update, origin);
  }

  /** Get this doc's state vector (for efficient delta sync) */
  getStateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc);
  }

  /** Encode only the updates the remote doesn't have yet */
  encodeStateAsUpdate(remoteStateVector: Uint8Array): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc, remoteStateVector);
  }

  // --- Mutation helpers ---

  incrementCounter(): void {
    const current = this.counters.get(this.name) ?? 0;
    this.counters.set(this.name, current + 1);
  }

  decrementCounter(): void {
    const current = this.counters.get(this.name) ?? 0;
    this.counters.set(this.name, current - 1);
  }

  getCounterTotal(): number {
    let total = 0;
    this.counters.forEach((v) => { total += v; });
    return total;
  }

}
