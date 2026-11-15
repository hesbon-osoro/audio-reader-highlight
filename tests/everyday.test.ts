import { buildSpeechFromSegment } from '../packages/audio-reader-highlight/src/textSubstitutions';

const speech = (input: string): string => buildSpeechFromSegment(input).speech;

describe('everyday writing', () => {
  it.each([
    ['Late 1990s', 'Late 1990s'],
    ['the 80s and the ’90s', 'the 80s and the ’90s'],
    ["the '60s", "the '60s"],
    ['Air Force 1s', 'Air Force 1s'],
    ['in the 2010s', 'in the 2010s'],
  ])('reads decades and plural numbers as words: %s', (input, expected) => {
    expect(speech(input)).toBe(expected);
  });

  it.each([
    ['9am', '9 AM'],
    ['2:15pm', '2:15 PM'],
    ['at 7 p.m.', 'at 7 PM'],
    ['10 AM', '10 AM'],
    ['open 9am-5pm', 'open 9 AM to 5 PM'],
    ['9:00 - 17:30', '9:00 to 17:30'],
    ['between 9am and 5pm', 'between 9 AM and 5 PM'],
  ])('reads clock times: %s', (input, expected) => {
    expect(speech(input)).toBe(expected);
  });

  it.each([
    ['5 s', '5 seconds'],
    ['2.5s', '2.5 seconds'],
    ['3 ms', '3 milliseconds'],
    ['250 pm bond', '250 picometers bond'],
    ['100 m sprint', '100 meters sprint'],
  ])('still reads real units: %s', (input, expected) => {
    expect(speech(input)).toBe(expected);
  });

  it('leaves abbreviations that only look like times alone', () => {
    expect(speech('PM Ruto spoke')).toBe('PM Ruto spoke');
  });
});
