import {
  splitSentences,
  timedWords,
  wordAt,
  wordStart,
} from '../packages/audio-reader-highlight/src/text';

const words = (s: string) =>
  splitSentences(s).map(x => s.slice(x.start, x.end));

describe('splitSentences', () => {
  it('keeps a title and subtitle as their own sentences', () => {
    expect(
      words(
        'The Comfort Zone Paradox\nWhy everyone says home is best.\nBody text here. And more.'
      )
    ).toEqual([
      'The Comfort Zone Paradox',
      'Why everyone says home is best.',
      'Body text here.',
      'And more.',
    ]);
  });

  it('does not break after abbreviations', () => {
    expect(words('Ask Dr. Jones about No. 7 today. Then leave.')).toEqual([
      'Ask Dr. Jones about No. 7 today.',
      'Then leave.',
    ]);
  });
});

describe('wordAt', () => {
  const s = 'deserts—people  survive there';
  it('backs up to the start of the clicked word', () => {
    expect(wordAt(s, s.indexOf('rvive'))).toBe(s.indexOf('survive'));
  });
  it('treats dashes as word breaks', () => {
    expect(wordStart(s, s.indexOf('ople'))).toBe(s.indexOf('people'));
  });
  it('takes the word on the left of a caret right after it', () => {
    expect(wordAt(s, s.indexOf('  survive'))).toBe(s.indexOf('people'));
  });
  it('moves to the next word from the middle of whitespace', () => {
    expect(wordAt(s, s.indexOf('  survive') + 1)).toBe(s.indexOf('survive'));
  });
});

describe('timedWords', () => {
  it('weights punctuation pauses and splits dashes', () => {
    const w = timedWords('Mojave—people survive. Yes');
    expect(w.map(x => 'Mojave—people survive. Yes'.slice(x.s, x.e))).toEqual([
      'Mojave',
      'people',
      'survive.',
      'Yes',
    ]);
    expect(w[2].w - w[1].w).toBeGreaterThan(w[1].w - w[0].w);
  });
});
