import { SyncEvent } from '../crdt/sync-engine';

const MAX_ENTRIES = 80;

const TYPE_LABELS: Record<SyncEvent['type'], string> = {
  live: '',
  queued: 'queued',
  reconnect: 'reconcile',
};

/**
 * Visual scrolling log of CRDT update events.
 * Shows direction, byte size, and type (live/queued/reconnect).
 */
export class UpdateLog {
  readonly el: HTMLElement;
  private logBody: HTMLDivElement;
  private entries: HTMLDivElement[] = [];

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'update-log';
    this.el.innerHTML = `
      <div class="log-header">
        <h3>Sync Log</h3>
        <span class="log-hint">CRDT updates flowing between peers</span>
      </div>
      <div class="log-body"></div>
    `;
    this.logBody = this.el.querySelector('.log-body')!;
  }

  addEvent(event: SyncEvent): void {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${event.type}`;

    const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
      fractionalSecondDigits: 3,
    });

    const arrow = event.type === 'queued' ? '\u23f8' : '\u2192';
    const label = TYPE_LABELS[event.type];

    // Build DOM nodes programmatically (no innerHTML with dynamic data)
    entry.append(
      this.span('log-time', time),
      this.span('log-from', event.from),
      this.span('log-arrow', arrow),
      this.span('log-to', event.to),
      this.span('log-bytes', `${event.bytes}B`),
    );

    if (label) {
      entry.appendChild(this.span(`log-tag log-tag-${event.type}`, ` ${label}`));
    }

    this.logBody.appendChild(entry);
    this.entries.push(entry);

    while (this.entries.length > MAX_ENTRIES) {
      this.entries.shift()!.remove();
    }

    this.logBody.scrollTop = this.logBody.scrollHeight;
  }

  private span(className: string, text: string): HTMLSpanElement {
    const el = document.createElement('span');
    el.className = className;
    el.textContent = text;
    return el;
  }
}
