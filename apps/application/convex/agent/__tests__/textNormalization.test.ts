import { describe, it, expect } from 'vitest';
import { normalizeAndBuildMaps, normalizeQuery } from '../textNormalization';

describe('textNormalization', () => {
  it('replaces NBSP and removes soft hyphens and zero-width', () => {
    const input = "A\u00A0B\u00ADC\u200B";
    const result = normalizeAndBuildMaps(input, {
      unifyNbsp: true,
      removeSoftHyphen: true,
      removeZeroWidth: true,
    });
    console.log('Input:', JSON.stringify(input));
    console.log('Normalized:', JSON.stringify(result.normalizedText));
    console.log('normToOrig length:', result.normToOrig.length);
    expect(result.normalizedText).toBe("A BC");
    // Ensure mapping arrays have consistent lengths
    expect(result.normToOrig.length).toBe(result.normalizedText.length);
  });

  it('normalizes smart quotes and dashes', () => {
    const input = "“Hello” — ‘World’";
    const res = normalizeAndBuildMaps(input, {
      normalizeQuotesAndDashes: true,
    });
    console.log('Smart punctuation input:', input);
    console.log('Smart punctuation normalized:', res.normalizedText);
    expect(res.normalizedText).toBe('"Hello" - ' + "'World'");
  });

  it('supports case-insensitive option and unicode normalization', () => {
    const input = "AcCiÓn"; // contains accented Ó
    const query = "acción";
    const normInput = normalizeAndBuildMaps(input, { caseInsensitive: true, unicodeForm: 'NFC' });
    const normQuery = normalizeQuery(query, { caseInsensitive: true, unicodeForm: 'NFC' });
    console.log('Case-insensitive text:', normInput.normalizedText, 'query:', normQuery);
    expect(normInput.normalizedText.includes(normQuery)).toBe(true);
  });

  it('can collapse whitespace when requested', () => {
    const input = "A   B\tC\nD";
    const { normalizedText, normToOrig } = normalizeAndBuildMaps(input, { normalizeWhitespace: true });
    console.log('Whitespace collapsed:', JSON.stringify(normalizedText));
    console.log('normToOrig sample:', normToOrig.slice(0, 10));
    expect(normalizedText).toBe("A B C D");
  });
});


