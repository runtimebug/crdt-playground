import * as Y from 'yjs';
import { CRDTPeer } from '../crdt/peer';
import { escapeHtml } from '../utils/escape-html';

/** Yjs internal item — accessed for educational visualization */
interface YItem {
  id: { client: number; clock: number };
  content: { str?: string };
  deleted: boolean;
  right: YItem | null;
}

interface CharInfo {
  char: string;
  clientId: number;
  clock: number;
  deleted: boolean;
}

/**
 * Visualizes the internal YATA data structure powering Yjs:
 *   - Explains the algorithm's core concepts
 *   - Shows each peer's Y.Text as a linked list of character items with IDs
 *   - Highlights tombstones (deleted characters still in the structure)
 *   - Displays state vectors for each peer
 */
export class AlgorithmViz {
  readonly el: HTMLElement;
  private clientLabels: Map<number, { name: string; color: string }>;
  private peerAChars: HTMLElement;
  private peerBChars: HTMLElement;
  private peerASV: HTMLElement;
  private peerBSV: HTMLElement;
  private rafId: number | null = null;
  private updateHandlerA: () => void;
  private updateHandlerB: () => void;

  constructor(
    private peerA: CRDTPeer,
    private peerB: CRDTPeer,
  ) {
    this.clientLabels = new Map([
      [peerA.doc.clientID, { name: 'A', color: '#00d4ff' }],
      [peerB.doc.clientID, { name: 'B', color: '#ff00aa' }],
    ]);

    this.el = document.createElement('section');
    this.el.className = 'algorithm-viz';

    const nameA = escapeHtml(peerA.name);
    const nameB = escapeHtml(peerB.name);

    this.el.innerHTML = `
      <h2 class="viz-title">Under the Hood</h2>

      <div class="viz-concepts">
        <div class="viz-concept">
          <strong>Unique IDs</strong>
          <p>Every character gets a globally unique ID <code>(client:clock)</code>. No two characters can collide, even across devices.</p>
        </div>
        <div class="viz-concept">
          <strong>Linked List</strong>
          <p>Characters form a linked list, not an array. Each knows its neighbors by reference, so positions never go stale.</p>
        </div>
        <div class="viz-concept">
          <strong>Ordering Rule</strong>
          <p>Concurrent inserts at the same position are ordered by comparing left/right origins, then client IDs. All peers converge to the same sequence.</p>
        </div>
        <div class="viz-concept">
          <strong>Tombstones</strong>
          <p>Deleted characters stay in the list (shown dimmed below). This preserves structure so concurrent operations still resolve.</p>
        </div>
      </div>

      <div class="viz-peers">
        <div class="viz-peer" style="--accent: #00d4ff">
          <h3>${nameA} &mdash; Internal Linked List</h3>
          <div class="viz-chars" data-peer="A"></div>
          <div class="viz-sv" data-sv="A"></div>
        </div>
        <div class="viz-peer" style="--accent: #ff00aa">
          <h3>${nameB} &mdash; Internal Linked List</h3>
          <div class="viz-chars" data-peer="B"></div>
          <div class="viz-sv" data-sv="B"></div>
        </div>
      </div>

      <p class="viz-sv-note">
        State vectors track how much of each client's history a peer has seen.
        On reconnect, peers exchange vectors and send only the missing deltas.
      </p>
    `;

    this.peerAChars = this.el.querySelector('[data-peer="A"]')!;
    this.peerBChars = this.el.querySelector('[data-peer="B"]')!;
    this.peerASV = this.el.querySelector('[data-sv="A"]')!;
    this.peerBSV = this.el.querySelector('[data-sv="B"]')!;

    // Observe all doc changes to update the visualization
    this.updateHandlerA = () => this.scheduleRender();
    this.updateHandlerB = () => this.scheduleRender();
    peerA.doc.on('update', this.updateHandlerA);
    peerB.doc.on('update', this.updateHandlerB);

    this.render();
  }

  private scheduleRender(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.render();
    });
  }

  private render(): void {
    this.renderPeer(this.peerA, this.peerAChars, this.peerASV);
    this.renderPeer(this.peerB, this.peerBChars, this.peerBSV);
  }

  private renderPeer(peer: CRDTPeer, charsEl: HTMLElement, svEl: HTMLElement): void {
    const items = this.extractItems(peer.text);
    charsEl.innerHTML = '';

    if (items.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'viz-empty';
      empty.textContent = '(empty — type something above)';
      charsEl.appendChild(empty);
    } else {
      for (const item of items) {
        charsEl.appendChild(this.createCharBox(item));
      }
    }

    const sv = Y.decodeStateVector(Y.encodeStateVector(peer.doc));
    svEl.textContent = 'State vector: ' + this.formatSV(sv);
  }

  private createCharBox(item: CharInfo): HTMLElement {
    const box = document.createElement('div');
    box.className = `viz-char${item.deleted ? ' tombstone' : ''}`;

    const label = this.clientLabels.get(item.clientId);
    if (label) {
      box.style.borderColor = label.color;
    }

    const charSpan = document.createElement('span');
    charSpan.className = 'viz-char-value';
    charSpan.textContent = item.char === ' ' ? '\u00B7' : item.char === '\n' ? '\u21B5' : item.char;

    const idSpan = document.createElement('span');
    idSpan.className = 'viz-char-id';
    const clientLabel = label?.name ?? String(item.clientId);
    idSpan.textContent = `${clientLabel}:${item.clock}`;

    box.append(charSpan, idSpan);
    return box;
  }

  private formatSV(sv: Map<number, number>): string {
    const parts: string[] = [];
    sv.forEach((clock, clientId) => {
      const label = this.clientLabels.get(clientId);
      const name = label?.name ?? String(clientId);
      parts.push(`${name}: ${clock}`);
    });
    return parts.length ? `{ ${parts.join(', ')} }` : '{ }';
  }

  /**
   * Traverse Y.Text's internal linked list to extract character items.
   * These are Yjs internals (not public API) — used here specifically
   * for educational visualization of the YATA algorithm.
   */
  private extractItems(ytext: Y.Text): CharInfo[] {
    const items: CharInfo[] = [];
    let current = (ytext as unknown as { _start: YItem | null })._start;

    while (current !== null) {
      if (current.content.str !== undefined) {
        for (let i = 0; i < current.content.str.length; i++) {
          items.push({
            char: current.content.str[i],
            clientId: current.id.client,
            clock: current.id.clock + i,
            deleted: current.deleted,
          });
        }
      }
      current = current.right;
    }

    return items;
  }

  destroy(): void {
    this.peerA.doc.off('update', this.updateHandlerA);
    this.peerB.doc.off('update', this.updateHandlerB);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }
}
