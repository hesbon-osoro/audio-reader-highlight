import {
  AudioLines,
  FlaskConical,
  MousePointerClick,
  Package,
} from 'lucide-react';
import LabCard from '@/components/lab/LabCard';
import {
  ListenButton,
  PlayerDock,
  Readable,
} from 'audio-reader-highlight/react';
import { labUnits } from '@/lib/data/lab';

const post = {
  title: 'The Comfort Zone Paradox',
  subtitle: 'Why everyone says “home is best”, no matter how bad it gets.',
  content: `
  <blockquote>
    <p>“East or West, Home is Best.” 🏠<br/>
    But what if home is a desert? A war zone? A slum? A mansion? A palace?<br/>
    Why do we all defend our comfort zones—no matter how uncomfortable they actually are? 🤔</p>
  </blockquote>
  <h2>The Universal Paradox</h2>
  <p><strong>Everyone says: “Home is best.”</strong> 🏡</p>
  <ul>
    <li>The <strong>billionaire</strong> in their penthouse 🏙️💎</li>
    <li>The <strong>middle-class family</strong> in their suburbs 🏘️</li>
    <li>The <strong>poor</strong> in their cramped rental 🏚️</li>
    <li>The <strong>homeless</strong> under a bridge 🌉</li>
    <li>The <strong>desert dweller</strong> in scorching heat, 45 °C at noon 🏜️🔥</li>
    <li>The <strong>war survivor</strong> in a conflict zone 💣😢</li>
    <li>The <strong>slum resident</strong> in crowded, unsanitary conditions 🚧</li>
  </ul>
  <p><strong>Same statement. Wildly different realities.</strong> 🌈</p>
  <p>This is the <strong>Comfort Zone Paradox</strong>: humans defend what they know—even when what they know is killing them.</p>
  <h2>The Geography Paradox: Desert vs. Green Pastures</h2>
  <h3>Why do people live in deserts?</h3>
  <p>Look at the Sahara, the Arabian Desert, the Gobi, the Mojave—<strong>people survive there.</strong> Some regions get less than 25 mm of rain a year, and the ground can pass 70 °C.</p>
  <p><strong>Logical question</strong>: why don’t they just move to greener areas, perhaps 300 km away? 🌿🤷</p>
  <p>Because moving costs more than money. A family that earns $2.5k a year cannot buy land worth $50k, and the unknown feels heavier than the heat.</p>
  <p>So they stay in the desert. And they defend the desert. And they defend the desert as their home. 🏠</p>
  `,
};

const snippets = [
  {
    title: 'Install',
    body: 'From npm, with any package manager.',
    code: `npm install audio-reader-highlight`,
  },
  {
    title: 'React',
    body: 'Wrap what should be read; add the player once.',
    code: `import { Readable, PlayerDock } from 'audio-reader-highlight/react';
import 'audio-reader-highlight/styles.css';

<Readable id="post" label="My post">
  <h1>Title</h1>
  <p>Body text…</p>
</Readable>
<PlayerDock defaultRegion="post" />`,
  },
  {
    title: 'Any framework',
    body: 'The engine works on plain DOM, in a WebView too.',
    code: `import { getReader } from 'audio-reader-highlight';
import 'audio-reader-highlight/styles.css';

const reader = getReader();
reader.register('post', document.querySelector('article'));
reader.play('post');
reader.subscribe(state => console.log(state.word));`,
  },
];

export default function Page() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">
          <AudioLines size={15} aria-hidden /> Text-to-speech, word by word
        </p>
        <h1>
          Hear every word.
          <br />
          <span className="grad">See every word.</span>
        </h1>
        <p className="lede">
          A reader that speaks currencies, units, equations and chemistry the
          way a person would, and highlights the exact word as it is said.
        </p>
        <div className="hero-actions">
          <ListenButton region="article" className="btn btn-primary">
            Listen to the essay
          </ListenButton>
          <a className="btn btn-ghost" href="#lab">
            <FlaskConical size={17} aria-hidden /> Pronunciation lab
          </a>
        </div>
        <ul className="features">
          <li>
            <strong>Word-exact sync</strong> from the voice’s own timing,
            calibrated when it has none.
          </li>
          <li>
            <strong>Science-aware</strong>: 6.02×10²³, H₂O, E = mc², λ, ½ and
            more.
          </li>
          <li>
            <MousePointerClick size={15} aria-hidden />{' '}
            <strong>Click any word</strong> to read from there.
          </li>
        </ul>
      </section>

      {/* The whole card is readable: the title is read first, and a tap in its margins reads the nearest line. */}
      <Readable
        as="section"
        id="article"
        label={post.title}
        className="reading"
        aria-labelledby="post-title"
      >
        <div id="essay">
          <header className="post-head">
            <p className="eyebrow" data-tts-skip>
              Essay · 3 min listen
            </p>
            <h2 id="post-title">{post.title}</h2>
            <p>{post.subtitle}</p>
          </header>
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </div>
      </Readable>

      <section className="lab" id="lab" aria-labelledby="lab-title">
        <header className="lab-head">
          <p className="eyebrow">
            <FlaskConical size={15} aria-hidden /> Pronunciation lab
          </p>
          <h2 id="lab-title">One rule per card.</h2>
          <p>
            Each card isolates a reading rule. Play it, follow the highlight,
            and open “Spoken as” to see exactly what the voice is given.
          </p>
        </header>
        <div className="lab-grid">
          {labUnits.map((u, i) => (
            <LabCard key={u.id} unit={u} n={i + 1} />
          ))}
        </div>
      </section>

      <section className="install" id="install" aria-labelledby="install-title">
        <header className="lab-head">
          <p className="eyebrow">
            <Package size={15} aria-hidden /> Use it in your product
          </p>
          <h2 id="install-title">One package. Any page.</h2>
          <p>
            Free and open source. The core has no dependencies and works with
            any framework; React bindings and a themeable stylesheet come with
            it.
          </p>
        </header>
        <div className="install-grid">
          {snippets.map(s => (
            <div className="install-card" key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <pre>
                <code>{s.code}</code>
              </pre>
            </div>
          ))}
        </div>
      </section>

      <PlayerDock defaultRegion="article" />
    </>
  );
}
