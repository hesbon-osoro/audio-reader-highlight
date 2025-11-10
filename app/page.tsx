import React from 'react';
import SimplifiedAudioReader from '../components/SimplifiedAudioReader';

const post = {
  slug: 'comfort-zone-paradox-home-is-best',
  title:
    'The Comfort Zone Paradox: Why Everyone Says "Home is Best" No Matter How Bad It Gets 🏠💭',
  content: `
  <blockquote>
    <p>"East or West, Home is Best." 🏠<br/>
    But what if home is a desert? A war zone? A slum? A mansion? A palace?<br/>
    Why do we all defend our comfort zones—no matter how uncomfortable they actually are? 🤔</p>
  </blockquote>
  <hr/>
  <p><strong>Currency tests</strong>: Price is $100, €50, and £75. Funding was $2.5M, €300k, and £3B. Also 100$, 300k€, and 2.5M£ work; CA$200 and HK$ 300k and USD 100; EUR 2.5M.</p>
  <p><strong>Abbreviation tests</strong>: Team A vs. Team B. Mr. Smith met Dr. Jones in the U.S. and the U.K., approx. 5 years ago, i.e. before 2020; e.g. see notes, etc.</p>
  <p><strong>Unit tests</strong>: 1 m, 2m, 3.5 km, 10cm, 25 mm, 2.4GHz, 1 Hz, 2 Hz, 50%, 90 kW, 220 V, 10 A.</p>
  <p><strong>SI prefixes</strong>: 0.5 μm, 10 ps, 1 kΩ, 250 MW, 50 mA.</p>
  <p><strong>Temperature</strong>: 25°C, -10 °F, 300 K, 45° (angle).</p>
  <p><strong>Area</strong>: 1 m², 12 cm², 3 km², 24 in², 2 ft².</p>
  <p><strong>Volume</strong>: 2 m³, 15 cm³, 0.5 km³, 1 L, 250 mL.</p>
  <p><strong>Speed</strong>: 60 km/h, 27.8 m/s, 45 mph.</p>
  <p><strong>Pressure</strong>: 101 kPa, 1 atm, 14.7 psi, 760 mmHg, 1 bar, 50 mbar, 0.5 MPa.</p>
  <p><strong>Electrical/Signal</strong>: 5 Ω, 2 Wb, 300 lm, 500 lx, 1 cd, 30 dB.</p>
  <p><strong>Mechanics/Chem</strong>: 100 N, 250 J, 1 mol, 20 N·m.</p>
  <p><strong>Energy/Capacity</strong>: 400 Wh, 1.2 kWh, 2000 mAh, 2 Ah.</p>
  <p><strong>Legibility test</strong>: This line contains some longish words for overlay width and height checks without layout shift.</p>
 <hr/>
 <p>Long numbers: Elon Musk is eligible to withdraw $1,000,000,000,000 from Tesla</p>
 <p>Long units: 1,000,000,000,000 meters</p>
  <h2>The Universal Paradox 🌍💭</h2>
  <p><strong>Everyone says: "Home is best."</strong> 🏡</p>
  <ul>
    <li>The <strong>billionaire</strong> in their penthouse 🏙️💎</li>
    <li>The <strong>middle-class family</strong> in their suburbs 🏘️</li>
    <li>The <strong>poor</strong> in their cramped rental 🏚️</li>
    <li>The <strong>homeless</strong> under a bridge 🌉</li>
    <li>The <strong>desert dweller</strong> in scorching heat 🏜️🔥</li>
    <li>The <strong>war survivor</strong> in a conflict zone 💣😢</li>
    <li>The <strong>slum resident</strong> in crowded, unsanitary conditions 🚧</li>
  </ul>
  <p><strong>Same statement. Wildly different realities.</strong> 🌈</p>
  <p>This is the <strong>Comfort Zone Paradox</strong>:<br/>
  <strong>Humans defend what they know—even when what they know is killing them.</strong> ⚰️</p>
  <hr/>
  <h2>The Geography Paradox: Desert vs. Green Pastures 🏜️🌳</h2>
  <h3>Why Do People Live in Deserts? 🤔🔥</h3>
  <p>Look at the Sahara, Arabian Desert, Gobi Desert, Mojave—<strong>people survive there.</strong> 🏜️</p>
  <p><strong>Logical question</strong>: Why don't they just move to greener areas? 🌿🤷</p>
  <p>So they stay in the desert. And they defend the desert. And they defend the desert as their home. 🏠</p>
   `,
};

export default function Page() {
  return (
    <>
      <SimplifiedAudioReader content={post.content} title={post.title} />
      <article
        className="prose"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </>
  );
}
