import { describe, expect, it } from 'vitest';
import { CRDTPeer } from '../crdt/peer';
import { SyncEngine, SyncEvent } from '../crdt/sync-engine';

function createSyncedPair() {
  const a = new CRDTPeer('A');
  const b = new CRDTPeer('B');
  const engine = new SyncEngine(a, b);
  return { a, b, engine };
}

describe('SyncEngine', () => {
  it('syncs text edits between peers in real time', () => {
    const { a, b, engine } = createSyncedPair();

    a.text.insert(0, 'hello');
    expect(b.text.toString()).toBe('hello');

    b.text.insert(5, ' world');
    expect(a.text.toString()).toBe('hello world');

    engine.destroy();
  });

  it('syncs counter increments between peers', () => {
    const { a, b, engine } = createSyncedPair();

    a.incrementCounter();
    b.incrementCounter();

    // Both peers see both keys
    expect(a.getCounterTotal()).toBe(2);
    expect(b.getCounterTotal()).toBe(2);

    engine.destroy();
  });

  it('queues updates when a peer is offline', () => {
    const { a, b, engine } = createSyncedPair();
    const events: SyncEvent[] = [];
    engine.onSyncEvent((e) => events.push(e));

    engine.setOnline('B', false);
    a.text.insert(0, 'offline edit');

    // B should not see the edit yet
    expect(b.text.toString()).toBe('');
    expect(events[0].type).toBe('queued');

    engine.destroy();
  });

  it('reconciles on reconnect using state-vector deltas', () => {
    const { a, b, engine } = createSyncedPair();
    const events: SyncEvent[] = [];
    engine.onSyncEvent((e) => events.push(e));

    // Take both offline, make conflicting edits
    engine.setOnline('A', false);
    engine.setOnline('B', false);

    a.text.insert(0, 'AAA');
    b.text.insert(0, 'BBB');

    // Neither sees the other's edit
    expect(a.text.toString()).toBe('AAA');
    expect(b.text.toString()).toBe('BBB');

    // Bring both back online — reconciliation happens
    engine.setOnline('A', true);
    engine.setOnline('B', true);

    // Both should now have both edits (order determined by client ID)
    expect(a.text.toString()).toBe(b.text.toString());
    expect(a.text.toString()).toContain('AAA');
    expect(a.text.toString()).toContain('BBB');

    const reconnectEvents = events.filter((e) => e.type === 'reconnect');
    expect(reconnectEvents.length).toBeGreaterThan(0);

    engine.destroy();
  });

  it('handles concurrent counter increments without conflict', () => {
    const { a, b, engine } = createSyncedPair();

    engine.setOnline('A', false);
    engine.setOnline('B', false);

    a.incrementCounter();
    a.incrementCounter();
    b.incrementCounter();
    b.incrementCounter();
    b.incrementCounter();

    engine.setOnline('A', true);
    engine.setOnline('B', true);

    // PN-Counter: each peer owns its key, total = sum
    expect(a.getCounterTotal()).toBe(5);
    expect(b.getCounterTotal()).toBe(5);
    expect(a.counters.get('A')).toBe(2);
    expect(a.counters.get('B')).toBe(3);

    engine.destroy();
  });

  it('emits correctly typed sync events', () => {
    const { a, engine } = createSyncedPair();
    const events: SyncEvent[] = [];
    engine.onSyncEvent((e) => events.push(e));

    a.text.insert(0, 'x');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      from: 'A',
      to: 'B',
      type: 'live',
    });
    expect(events[0].bytes).toBeGreaterThan(0);
    expect(events[0].timestamp).toBeGreaterThan(0);

    engine.destroy();
  });

  it('supports removing sync event listeners', () => {
    const { a, engine } = createSyncedPair();
    const events: SyncEvent[] = [];
    const cb = (e: SyncEvent) => events.push(e);

    engine.onSyncEvent(cb);
    a.text.insert(0, 'a');
    expect(events).toHaveLength(1);

    engine.offSyncEvent(cb);
    a.text.insert(1, 'b');
    expect(events).toHaveLength(1); // no new event

    engine.destroy();
  });
});
