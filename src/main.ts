import { CRDTPeer } from './crdt/peer';
import { SyncEngine } from './crdt/sync-engine';
import { PeerPanel } from './ui/peer-panel';
import { NetworkControls } from './ui/network-controls';
import { UpdateLog } from './ui/update-log';
import { AlgorithmViz } from './ui/algorithm-viz';

// --- Create two CRDT peers (simulating two devices/users) ---
const peerA = new CRDTPeer('Peer A');
const peerB = new CRDTPeer('Peer B');

// --- Create the sync engine (shuttles Yjs updates between peers) ---
const syncEngine = new SyncEngine(peerA, peerB);

// --- Build UI ---
const app = document.getElementById('app')!;

// Header
const header = document.createElement('header');
header.className = 'app-header';
header.innerHTML = `
  <h1>CRDT Playground</h1>
  <p>Conflict-free Replicated Data Types with Yjs</p>
`;

// Peer panels
const panelA = new PeerPanel(peerA, '#00d4ff');
const panelB = new PeerPanel(peerB, '#ff00aa');

const peersGrid = document.createElement('div');
peersGrid.className = 'peers-grid';
peersGrid.append(panelA.el, panelB.el);

// Network controls
const netControls = new NetworkControls(syncEngine, panelA, panelB, peerA.name, peerB.name);

// Update log
const updateLog = new UpdateLog();
syncEngine.onSyncEvent((event) => updateLog.addEvent(event));

// Algorithm visualization
const algorithmViz = new AlgorithmViz(peerA, peerB);

// Mount
app.append(header, peersGrid, netControls.el, updateLog.el, algorithmViz.el);
