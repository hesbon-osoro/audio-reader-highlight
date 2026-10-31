import { buildSpeechFromSegment } from '../lib/textSubstitutions';

const speech = (input: string): string => buildSpeechFromSegment(input).speech;

describe('scientific reading', () => {
  it.each([
    ['6.022×10²³ mol⁻¹', '6.022 times ten to the power of 23 per mole'],
    ['1.602 x 10^-19 C', '1.602 times ten to the power of minus 19 coulombs'],
    ['3e8 m/s', '3 times ten to the power of 8 meters per second'],
    ['10⁻⁹ m', 'ten to the power of minus 9 meters'],
  ])('reads notation %s as %s', (input, expected) => {
    expect(speech(input)).toBe(expected);
  });

  it.each([
    ['H₂O', 'H 2 O'],
    ['CO2', 'C O 2'],
    ['2H₂O', '2 H 2 O'],
    ['NaCl', 'N A C L'],
    ['SO₄²⁻', 'S O 4 2 minus'],
  ])('reads formula %s as %s', (input, expected) => {
    expect(speech(input)).toBe(expected);
  });

  it.each(['NO', 'OK', 'COVID-19', 'MP3', 'He said No.'])('leaves %s alone', input => {
    expect(speech(input)).toBe(input);
  });

  it.each([
    ['E = mc²', 'E equals mc squared'],
    ['a² + b² = c²', 'a squared plus b squared equals c squared'],
    ['x₁ + x₂', 'x sub 1 plus x sub 2'],
    ['Δt ≈ 0.5 s', 'delta t is approximately 0.5 seconds'],
    ['√2', 'the square root of 2'],
    ['CH₄ + 2O₂ → CO₂', 'C H 4 plus 2 O 2 yields C O 2'],
  ])('reads equation %s as %s', (input, expected) => {
    expect(speech(input)).toBe(expected);
  });

  it.each([
    ['½ cup', 'one half cup'],
    ['2¾ miles', '2 and three quarters miles'],
    ['3/4 of them', '3 quarters of them'],
    ['10/12/2024', '10/12/2024'],
    ['10–20 km', '10 to 20 kilometers'],
    ['−273.15 °C', 'minus 273.15 degrees Celsius'],
    ['~5 kg', 'about 5 kilograms'],
  ])('reads %s as %s', (input, expected) => {
    expect(speech(input)).toBe(expected);
  });
});

describe('abbreviations', () => {
  it.each([
    ['Team A vs. Team B', 'Team A versus Team B'],
    ['see Fig. 3 and Eq. 2', 'see figure 3 and equation 2'],
    ['Smith et al., 2020', 'Smith and colleagues, 2020'],
    ['No. 7', 'number 7'],
    ['top 5 in the world', 'top 5 in the world'],
    ['24 in.', '24 inches.'],
  ])('reads %s as %s', (input, expected) => {
    expect(speech(input)).toBe(expected);
  });
});

describe('source spans', () => {
  it('maps a substituted expression to its whole source span', () => {
    const { speech: s, map, ends } = buildSpeechFromSegment('is 6.02×10²³ now');
    const i = s.indexOf('power');
    expect([map[i], ends[i]]).toEqual([3, 12]);
  });

  it('maps plain characters one to one', () => {
    const { map, ends } = buildSpeechFromSegment('abc');
    expect(map).toEqual([0, 1, 2]);
    expect(ends).toEqual([1, 2, 3]);
  });
});
