import { describe, expect, it } from 'vitest';
import { CRDTPeer } from '../crdt/peer';

describe('CRDTPeer', () => {
  it('creates independent Y.Doc instances', () => {
    const a = new CRDTPeer('A');
    const b = new CRDTPeer('B');
    expect(a.doc.clientID).not.toBe(b.doc.clientID);
  });

  it('inserts and reads text', () => {
    const peer = new CRDTPeer('A');
    peer.text.insert(0, 'hello');
    expect(peer.text.toString()).toBe('hello');
  });

  it('tracks per-peer counter keys independently', () => {
    const a = new CRDTPeer('A');
    const b = new CRDTPeer('B');

    a.incrementCounter();
    a.incrementCounter();
    b.incrementCounter();

    expect(a.counters.get('A')).toBe(2);
    expect(b.counters.get('B')).toBe(1);
    expect(a.getCounterTotal()).toBe(2);
    expect(b.getCounterTotal()).toBe(1);
  });

  it('decrements counter correctly', () => {
    const peer = new CRDTPeer('A');
    peer.incrementCounter();
    peer.incrementCounter();
    peer.decrementCounter();
    expect(peer.counters.get('A')).toBe(1);
    expect(peer.getCounterTotal()).toBe(1);
  });

  it('starts counter at 0 when no key exists', () => {
    const peer = new CRDTPeer('A');
    peer.decrementCounter();
    expect(peer.counters.get('A')).toBe(-1);
  });
});
