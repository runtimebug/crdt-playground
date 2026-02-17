import * as Y from 'yjs';
import { CRDTPeer } from '../crdt/peer';
import { escapeHtml } from '../utils/escape-html';

/**
 * Renders one peer's full UI panel:
 *   - Collaborative text editor (textarea <-> Y.Text)
 *   - CRDT counter with +/- buttons
 */
export class PeerPanel {
  readonly el: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private counterDisplay: HTMLSpanElement;
  private counterDetail: HTMLDivElement;
  private statusDot: HTMLSpanElement;
  private isUpdatingTextarea = false;

  private textObserver: (event: Y.YTextEvent) => void;
  private counterObserver: () => void;

  constructor(
    private peer: CRDTPeer,
    accentColor: string,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'peer-panel';
    this.el.style.setProperty('--accent', accentColor);

    const name = escapeHtml(peer.name);
    this.el.innerHTML = `
      <div class="panel-header">
        <span class="peer-name">${name}</span>
        <span class="status-dot online" data-status></span>
      </div>

      <section class="section">
        <h3>Collaborative Text <span class="badge">Y.Text</span></h3>
        <textarea class="crdt-textarea" placeholder="Type here... both peers share this text" rows="5"></textarea>
      </section>

      <section class="section">
        <h3>Shared Counter <span class="badge">Y.Map</span></h3>
        <div class="counter-row">
          <button class="btn btn-minus" data-action="dec" aria-label="Decrement counter">&minus;</button>
          <span class="counter-value">0</span>
          <button class="btn btn-plus" data-action="inc" aria-label="Increment counter">+</button>
        </div>
        <div class="counter-detail"></div>
      </section>

    `;

    this.textarea = this.el.querySelector('.crdt-textarea')!;
    this.counterDisplay = this.el.querySelector('.counter-value')!;
    this.counterDetail = this.el.querySelector('.counter-detail')!;
    this.statusDot = this.el.querySelector('[data-status]')!;

    this.textObserver = this.createTextObserver();
    this.counterObserver = this.createCounterObserver();

    this.bindText();
    this.bindCounter();
  }

  setOnline(online: boolean): void {
    this.statusDot.className = `status-dot ${online ? 'online' : 'offline'}`;
  }

  destroy(): void {
    this.peer.text.unobserve(this.textObserver);
    this.peer.counters.unobserve(this.counterObserver);
  }

  // --- Text binding ---

  private createTextObserver(): (event: Y.YTextEvent) => void {
    return (event: Y.YTextEvent) => {
      // Local changes: the textarea already has the correct content and cursor
      if (event.transaction.origin !== 'remote') return;

      this.isUpdatingTextarea = true;
      const hadFocus = document.activeElement === this.textarea;
      let cursorPos = this.textarea.selectionStart;

      // Adjust cursor so remote insertions/deletions don't displace the local caret
      if (hadFocus) {
        let index = 0;
        for (const op of event.delta) {
          if (op.retain !== undefined) {
            index += op.retain;
          } else if (op.insert !== undefined) {
            const len = typeof op.insert === 'string' ? op.insert.length : 1;
            if (index <= cursorPos) cursorPos += len;
            index += len;
          } else if (op.delete !== undefined) {
            if (index < cursorPos) {
              cursorPos -= Math.min(op.delete, cursorPos - index);
            }
          }
        }
      }

      this.textarea.value = this.peer.text.toString();
      if (hadFocus) {
        this.textarea.setSelectionRange(cursorPos, cursorPos);
      }
      this.isUpdatingTextarea = false;
    };
  }

  private bindText(): void {
    const yText = this.peer.text;

    this.textarea.addEventListener('input', () => {
      if (this.isUpdatingTextarea) return;

      const newValue = this.textarea.value;
      const oldValue = yText.toString();

      let start = 0;
      while (start < oldValue.length && start < newValue.length && oldValue[start] === newValue[start]) {
        start++;
      }
      let oldEnd = oldValue.length;
      let newEnd = newValue.length;
      while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === newValue[newEnd - 1]) {
        oldEnd--;
        newEnd--;
      }

      this.peer.doc.transact(() => {
        if (oldEnd - start > 0) yText.delete(start, oldEnd - start);
        if (newEnd - start > 0) yText.insert(start, newValue.slice(start, newEnd));
      });
    });

    yText.observe(this.textObserver);
  }

  // --- Counter binding ---

  private createCounterObserver(): () => void {
    return () => {
      this.counterDisplay.textContent = String(this.peer.getCounterTotal());
      const parts: string[] = [];
      this.peer.counters.forEach((v, k) => {
        parts.push(`${k}: ${v}`);
      });
      this.counterDetail.textContent = parts.length ? parts.join('  |  ') : '';
    };
  }

  private bindCounter(): void {
    this.el.querySelector('[data-action="inc"]')!.addEventListener('click', () => this.peer.incrementCounter());
    this.el.querySelector('[data-action="dec"]')!.addEventListener('click', () => this.peer.decrementCounter());

    this.peer.counters.observe(this.counterObserver);
    this.counterObserver();
  }

}
