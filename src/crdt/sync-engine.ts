import { CRDTPeer, UpdateCallback } from './peer';

export interface SyncEvent {
  from: string;
  to: string;
  bytes: number;
  timestamp: number;
  type: 'live' | 'queued' | 'reconnect';
}

export type SyncEventCallback = (event: SyncEvent) => void;

/** An empty Yjs state-as-update contains only the state vector header */
const EMPTY_UPDATE_THRESHOLD = 2;

/**
 * SyncEngine simulates a network sync layer between two Yjs peers:
 *   - Shuttles Yjs updates between two peers
 *   - Supports online/offline toggling per peer
 *   - Queues updates while offline
 *   - Uses state-vector-based delta sync on reconnect
 */
export class SyncEngine {
  private peerAOnline = true;
  private peerBOnline = true;

  /**
   * Queues exist to track updates generated while peers are offline.
   * On reconnect, reconcile() uses state-vector diffs (more efficient than
   * replaying individual queued updates), so these are cleared — not consumed.
   */
  private queueForB: Uint8Array[] = [];
  private queueForA: Uint8Array[] = [];

  private listeners: SyncEventCallback[] = [];
  private handleAUpdate: UpdateCallback;
  private handleBUpdate: UpdateCallback;

  constructor(
    private peerA: CRDTPeer,
    private peerB: CRDTPeer,
  ) {
    this.handleAUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return;
      this.relay(update, peerA, peerB, this.peerAOnline && this.peerBOnline);
    };

    this.handleBUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return;
      this.relay(update, peerB, peerA, this.peerAOnline && this.peerBOnline);
    };

    peerA.onUpdate(this.handleAUpdate);
    peerB.onUpdate(this.handleBUpdate);
  }

  /** Forward an update from one peer to another, or queue if offline */
  private relay(update: Uint8Array, from: CRDTPeer, to: CRDTPeer, online: boolean): void {
    const queue = to === this.peerA ? this.queueForA : this.queueForB;

    if (online) {
      to.applyUpdate(update, 'remote');
      this.emit({
        from: from.name, to: to.name,
        bytes: update.byteLength, timestamp: Date.now(), type: 'live',
      });
    } else {
      queue.push(update);
      this.emit({
        from: from.name, to: to.name,
        bytes: update.byteLength, timestamp: Date.now(), type: 'queued',
      });
    }
  }

  isPeerOnline(peerName: string): boolean {
    if (peerName === this.peerA.name) return this.peerAOnline;
    if (peerName === this.peerB.name) return this.peerBOnline;
    throw new Error(`Unknown peer: ${peerName}`);
  }

  /** Toggle a peer's network state. Reconnecting triggers state-vector sync. */
  setOnline(peerName: string, online: boolean): void {
    if (peerName === this.peerA.name) {
      this.peerAOnline = online;
    } else if (peerName === this.peerB.name) {
      this.peerBOnline = online;
    } else {
      throw new Error(`Unknown peer: ${peerName}`);
    }

    if (online && this.peerAOnline && this.peerBOnline) {
      this.reconcile();
    }
  }

  /**
   * State-vector-based reconciliation.
   * Instead of replaying individual queued updates (which works but is naive),
   * we compute the minimal delta each peer needs. Each peer sends its state
   * vector, and the other encodes only the missing updates.
   */
  private reconcile(): void {
    const svA = this.peerA.getStateVector();
    const svB = this.peerB.getStateVector();

    const updateForA = this.peerB.encodeStateAsUpdate(svA);
    const updateForB = this.peerA.encodeStateAsUpdate(svB);

    if (updateForA.byteLength > EMPTY_UPDATE_THRESHOLD) {
      this.peerA.applyUpdate(updateForA, 'remote');
      this.emit({
        from: this.peerB.name, to: this.peerA.name,
        bytes: updateForA.byteLength, timestamp: Date.now(), type: 'reconnect',
      });
    }

    if (updateForB.byteLength > EMPTY_UPDATE_THRESHOLD) {
      this.peerB.applyUpdate(updateForB, 'remote');
      this.emit({
        from: this.peerA.name, to: this.peerB.name,
        bytes: updateForB.byteLength, timestamp: Date.now(), type: 'reconnect',
      });
    }

    this.queueForA = [];
    this.queueForB = [];
  }

  onSyncEvent(cb: SyncEventCallback): void {
    this.listeners.push(cb);
  }

  offSyncEvent(cb: SyncEventCallback): void {
    this.listeners = this.listeners.filter((l) => l !== cb);
  }

  destroy(): void {
    this.peerA.offUpdate(this.handleAUpdate);
    this.peerB.offUpdate(this.handleBUpdate);
    this.listeners = [];
  }

  private emit(event: SyncEvent): void {
    for (const cb of this.listeners) cb(event);
  }
}
