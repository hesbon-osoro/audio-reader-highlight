// The pronunciation lab: one card per reading rule, each a sample to train on.

export interface LabUnit {
  id: string;
  title: string;
  rule: string;
  sample: string;
}

export const labUnits: LabUnit[] = [
  {
    id: 'scientific',
    title: 'Scientific notation',
    rule: 'Mantissa, power of ten, and the unit that follows.',
    sample:
      'Avogadro’s number is 6.022×10²³ mol⁻¹. An electron carries 1.602 x 10^-19 C. Light travels at 3e8 m/s, and a nanometre is 10⁻⁹ m.',
  },
  {
    id: 'chemistry',
    title: 'Chemistry',
    rule: 'Formulas read element by element, with charges.',
    sample:
      'Water is H₂O and carbon dioxide is CO₂. Methane burns as CH₄ + 2O₂ → CO₂ + 2H₂O. Table salt is NaCl, and sulfate is SO₄²⁻.',
  },
  {
    id: 'equations',
    title: 'Equations',
    rule: 'Operators, powers and subscripts as words.',
    sample:
      'Einstein wrote E = mc². By Pythagoras, a² + b² = c². A circle’s area is π r², and x₁ + x₂ ≤ 10.',
  },
  {
    id: 'symbols',
    title: 'Greek & symbols',
    rule: 'Letters and relations a scientist would say.',
    sample:
      'α, β and γ radiation. Δt ≈ 0.5 s, λ = 500 nm, σ ± 0.1, √2 ≈ 1.414, and the limit tends to ∞.',
  },
  {
    id: 'fractions',
    title: 'Fractions, ranges & signs',
    rule: 'Halves and quarters, en-dash ranges, negatives.',
    sample:
      'Add ½ cup, walk 2¾ miles, and keep 3/4 of the class. It runs 10–20 km, from 1990–2000. Absolute zero is −273.15 °C; take ~5 kg.',
  },
  {
    id: 'currency',
    title: 'Currency',
    rule: 'Symbols, codes and magnitudes, before or after.',
    sample:
      'Price is $100, €50, and £75. Funding was $2.5M, €300k, and £3B. Also 100$, 300k€, and 2.5M£; CA$200, HK$ 300k, USD 100 and EUR 2.5M.',
  },
  {
    id: 'abbreviations',
    title: 'Abbreviations',
    rule: 'Titles, Latin and citations expanded.',
    sample:
      'Team A vs. Team B. Mr. Smith met Dr. Jones in the U.S. and the U.K., approx. 5 years ago, i.e. before 2020; e.g. see Fig. 3 and Eq. 2 (Smith et al., 2020), No. 7.',
  },
  {
    id: 'units',
    title: 'Units',
    rule: 'Number + unit, singular or plural.',
    sample: '1 m, 2m, 3.5 km, 10cm, 25 mm, 2.4GHz, 1 Hz, 2 Hz, 50%, 90 kW, 220 V, 10 A.',
  },
  {
    id: 'si',
    title: 'SI prefixes',
    rule: 'Prefix and base unit combined.',
    sample: '0.5 μm, 10 ps, 1 kΩ, 250 MW, 50 mA.',
  },
  {
    id: 'temperature',
    title: 'Temperature & angles',
    rule: 'Degrees Celsius, Fahrenheit, kelvin and angles.',
    sample: '25°C, -10 °F, 300 K, and a 45° angle.',
  },
  {
    id: 'area',
    title: 'Area & volume',
    rule: 'Squared and cubed units.',
    sample: '1 m², 12 cm², 3 km², 24 in², 2 ft². 2 m³, 15 cm³, 0.5 km³, 1 L, 250 mL.',
  },
  {
    id: 'pressure',
    title: 'Speed & pressure',
    rule: 'Compound units like km/h and mmHg.',
    sample: '60 km/h, 27.8 m/s, 45 mph. 101 kPa, 1 atm, 14.7 psi, 760 mmHg, 1 bar, 50 mbar, 0.5 MPa.',
  },
  {
    id: 'energy',
    title: 'Electrical & energy',
    rule: 'Ohms, webers, newton-metres, watt-hours.',
    sample: '5 Ω, 2 Wb, 300 lm, 500 lx, 30 dB. 100 N, 250 J, 1 mol, 20 N·m. 400 Wh, 1.2 kWh, 2000 mAh, 2 Ah.',
  },
  {
    id: 'numbers',
    title: 'Large numbers',
    rule: 'Grouped digits read as a whole.',
    sample: 'A trillion dollars is $1,000,000,000,000, and the Sun is about 149,600,000 km away.',
  },
];
