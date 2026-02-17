import { SyncEngine } from '../crdt/sync-engine';
import { PeerPanel } from './peer-panel';
import { escapeHtml } from '../utils/escape-html';

/**
 * Renders online/offline toggle buttons for each peer,
 * with a visual connection line between them.
 */
export class NetworkControls {
  readonly el: HTMLElement;
  private netLink: HTMLElement;

  constructor(
    private engine: SyncEngine,
    private panelA: PeerPanel,
    private panelB: PeerPanel,
    private peerAName: string,
    private peerBName: string,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'network-controls';

    this.el.innerHTML = `
      <div class="net-peer">
        <button class="btn btn-net online" data-peer="A">
          <span class="net-dot"></span>
          ${escapeHtml(peerAName)} &mdash; Online
        </button>
      </div>
      <div class="net-link">
        <div class="net-line"></div>
        <span class="net-label">Sync Layer</span>
        <div class="net-line"></div>
      </div>
      <div class="net-peer">
        <button class="btn btn-net online" data-peer="B">
          <span class="net-dot"></span>
          ${escapeHtml(peerBName)} &mdash; Online
        </button>
      </div>
    `;

    this.netLink = this.el.querySelector('.net-link')!;

    this.el.querySelectorAll('.btn-net').forEach((btn) => {
      btn.addEventListener('click', () => this.toggle(btn as HTMLButtonElement));
    });
  }

  private toggle(btn: HTMLButtonElement): void {
    const isA = btn.dataset.peer === 'A';
    const peerName = isA ? this.peerAName : this.peerBName;
    const newState = !this.engine.isPeerOnline(peerName);

    this.engine.setOnline(peerName, newState);

    btn.className = `btn btn-net ${newState ? 'online' : 'offline'}`;

    // Update button content safely via DOM APIs (no innerHTML)
    const dot = btn.querySelector('.net-dot') ?? document.createElement('span');
    dot.className = 'net-dot';
    btn.textContent = '';
    btn.appendChild(dot);
    btn.append(` ${peerName} \u2014 ${newState ? 'Online' : 'Offline'}`);

    if (isA) this.panelA.setOnline(newState);
    else this.panelB.setOnline(newState);

    const bothOnline = this.engine.isPeerOnline(this.peerAName) && this.engine.isPeerOnline(this.peerBName);
    this.netLink.classList.toggle('disconnected', !bothOnline);
  }
}
