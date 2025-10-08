import { describe, it, expect } from 'vitest';
import { buildDocIndex, findMatches, selectByOccurrence, findAnchorPosition } from '../../core/utils/normalizedSearch';

// Minimal fake PM-like doc for testing: supports .descendants and text/hardBreak
function makeDoc(nodes: any[]) {
  return {
    descendants(cb: (node: any, pos: number) => void) {
      let pos = 1;
      for (const n of nodes) {
        if (n.type === 'text') {
          cb({ isText: true, text: n.text }, pos);
          pos += n.text.length;
        } else if (n.type === 'hardBreak') {
          cb({ type: { name: 'hardBreak' } }, pos);
          pos += 1;
        }
      }
    },
  } as any;
}

describe('normalizedSearch', () => {
  it('finds matches across NBSP and soft hyphen normalization', () => {
    const doc = makeDoc([
      { type: 'text', text: 'A\u00A0B' },
      { type: 'text', text: '\u00ADC' },
    ]);
    const idx = buildDocIndex(doc, { unifyNbsp: true, removeSoftHyphen: true });
    const matches = findMatches(idx, 'A B', { unifyNbsp: true, removeSoftHyphen: true });
    console.log('Doc normalized text length:', idx.normalizedText.length);
    console.log('Matches:', matches);
    expect(matches.length).toBe(1);
  });

  it('resolves whole-word boundaries unicode-aware', () => {
    const doc = makeDoc([{ type: 'text', text: 'acciónX acción' }]);
    const idx = buildDocIndex(doc, {});
    const m1 = findMatches(idx, 'acción', { wholeWord: true });
    console.log('Whole-word matches:', m1);
    // Only the second occurrence should match whole word
    expect(m1.length).toBe(1);
  });

  it('selectByOccurrence respects occurrenceIndex and maxOccurrences', () => {
    const list = [1, 2, 3, 4, 5];
    const one = selectByOccurrence(list, 3, undefined, false);
    const two = selectByOccurrence(list, undefined, 2, false);
    const all = selectByOccurrence(list, undefined, undefined, true);
    const none = selectByOccurrence([], 1, undefined, false);
    console.log('Occurrence selection:', { one, two, all, none });
    expect(one).toEqual([3]);
    expect(two).toEqual([1, 2]);
    expect(all).toEqual(list);
    expect(none).toEqual([]);
  });

  it('findAnchorPosition returns after/before positions mapped to PM', () => {
    const doc = makeDoc([{ type: 'text', text: 'Hello World' }]);
    const idx = buildDocIndex(doc, {});
    const afterPos = findAnchorPosition(idx, { afterText: 'Hello' }, {});
    const beforePos = findAnchorPosition(idx, { beforeText: 'World' }, {});
    console.log('Anchor positions:', { afterPos, beforePos });
    expect(afterPos).toBeGreaterThan(1);
    expect(beforePos).toBeGreaterThan(1);
    expect(afterPos).toBeLessThan(beforePos!);
  });
});


