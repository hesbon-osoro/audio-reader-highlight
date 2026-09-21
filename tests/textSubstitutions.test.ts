import { buildSpeechFromSegment } from '../lib/textSubstitutions';

/**
 * Reads a phrase the way the reader would speak it.
 * The speech map is not needed to assert on wording.
 */
const speech = (input: string): string => buildSpeechFromSegment(input).speech;

describe('buildSpeechFromSegment', () => {
  describe('currency symbols with a magnitude suffix', () => {
    // Regression: the scale character class is built from the lowercase keys
    // of `scales`, so an uppercase suffix was never captured. The match then
    // covered only the digits and left the suffix behind as a literal letter.
    it.each([
      ['$1K', '1 thousand us dollars'],
      ['$1M', '1 million us dollars'],
      ['$1B', '1 billion us dollars'],
      ['€1M', '1 million euros'],
      ['£1M', '1 million british pounds sterling'],
      ['£2.5M', '2.5 million british pounds sterling'],
      ['¥1M', '1 million japanese yen'],
      ['$2.5B', '2.5 billion us dollars'],
    ])('speaks %s as %s', (input, expected) => {
      expect(speech(input)).toBe(expected);
    });

    it.each([
      ['$1k', '1 thousand us dollars'],
      ['$1m', '1 million us dollars'],
      ['$1b', '1 billion us dollars'],
    ])('continues to speak lowercase %s as %s', (input, expected) => {
      expect(speech(input)).toBe(expected);
    });
  });

  describe('postfix currency symbols with a magnitude suffix', () => {
    // The postfix rule is <number><scale><symbol>, matching the documented
    // example 2.5M£. The amount-first form (1$M) is a different convention
    // and is not handled here.
    it.each([
      ['1K$', '1 thousand us dollars'],
      ['1M$', '1 million us dollars'],
      ['2.5M£', '2.5 million british pounds sterling'],
      ['3B€', '3 billion euros'],
    ])('speaks %s as %s', (input, expected) => {
      expect(speech(input)).toBe(expected);
    });

    it('leaves a symbol whose symbol precedes the suffix untouched', () => {
      // Documents current behaviour for the unsupported 1$M ordering so a
      // future change to support it is a deliberate decision.
      expect(speech('1$M')).toBe('1 us dollarsM');
    });
  });

  describe('currency codes with a magnitude suffix', () => {
    // Regression: the capture groups in the code branch were read with the
    // wrong indices, so the amount was corrupted and the suffix dropped.
    it.each([
      ['USD 1M', '1 million us dollars'],
      ['USD 1K', '1 thousand us dollars'],
      ['EUR 2.5M', '2.5 million euros'],
      ['GBP 3B', '3 billion british pounds sterling'],
    ])('speaks %s as %s', (input, expected) => {
      expect(speech(input)).toBe(expected);
    });

    it('speaks a code with no suffix', () => {
      expect(speech('USD 100')).toBe('100 us dollars');
    });
  });

  describe('units', () => {
    // Regression: `kW` is a valid SI prefix + base pairing, so it won the
    // alternation and left a stray `h` on `kWh`.
    it('speaks kWh as kilowatt-hours', () => {
      expect(speech('5 kWh')).toBe('5 kilowatt-hours');
      expect(speech('5kWh')).toBe('5 kilowatt-hours');
      expect(speech('1 kWh')).toBe('1 kilowatt-hour');
    });

    it.each([
      ['5 kW', '5 kilowatts'],
      ['5 Wh', '5 watt-hours'],
      ['5 km', '5 kilometers'],
      ['10 mg', '10 milligrams'],
      ['5 ms', '5 milliseconds'],
      ['5 MHz', '5 megahertz'],
      ['5 mL', '5 milliliters'],
    ])('keeps speaking %s as %s', (input, expected) => {
      expect(speech(input)).toBe(expected);
    });
  });

  describe('plain currencies without a suffix', () => {
    it.each([
      ['$100', '100 us dollars'],
      ['100$', '100 us dollars'],
      ['€1,234.56', '1,234.56 euros'],
      ['CA$ 5', '5 canadian dollars'],
    ])('speaks %s as %s', (input, expected) => {
      expect(speech(input)).toBe(expected);
    });
  });

  describe('the index map', () => {
    it('maps every spoken character back into the source segment', () => {
      const segment = 'costs $1M today';
      const { speech: spoken, map } = buildSpeechFromSegment(segment);

      expect(map).toHaveLength(spoken.length);
      map.forEach(sourceIndex => {
        expect(sourceIndex).toBeGreaterThanOrEqual(0);
        expect(sourceIndex).toBeLessThanOrEqual(segment.length);
      });
    });

    it('starts the map at the first source character', () => {
      const { map } = buildSpeechFromSegment('costs $1M');
      expect(map[0]).toBe(0);
    });
  });

  describe('text with no substitutions', () => {
    it('returns the segment unchanged', () => {
      expect(speech('hello world')).toBe('hello world');
    });

    it('returns an empty string for empty input', () => {
      expect(speech('')).toBe('');
    });
  });
});
