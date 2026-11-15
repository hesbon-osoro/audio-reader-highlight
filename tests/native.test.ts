import {
  NativeReader,
  highlightParts,
  expoSpeechEngine,
  type SpeakOptions,
  type SpeechEngine,
} from '../packages/audio-reader-highlight/src/native';

/** A speech engine the test drives by hand. */
function fakeEngine() {
  const calls: { text: string; o: SpeakOptions }[] = [];
  let stops = 0;
  const engine: SpeechEngine = {
    speak: (text, o) => void calls.push({ text, o }),
    stop: () => void stops++,
  };
  return {
    engine,
    calls,
    get stops() {
      return stops;
    },
    last: () => calls[calls.length - 1],
    texts: () => calls.map(c => c.text),
  };
}

const BLOCKS = ['Water is H₂O. It boils at 100 °C.', 'Dr. Mwangi agrees.'];

describe('NativeReader', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('reads every sentence in order through the normaliser, then finishes', () => {
    const f = fakeEngine();
    const onFinish = jest.fn();
    const r = new NativeReader({ engine: f.engine, onFinish });
    r.load(BLOCKS);
    expect(r.getState().sentences).toBe(3);

    r.play();
    expect(r.getState().status).toBe('playing');
    while (f.calls.length < 3) f.last().o.onDone();
    f.last().o.onDone();

    expect(f.texts()).toEqual([
      'Water is H 2 O.',
      'It boils at 100 degrees Celsius.',
      'Doctor Mwangi agrees.',
    ]);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(r.getState().status).toBe('idle');
  });

  it('maps boundary events back to the exact source word, across substitutions', () => {
    const f = fakeEngine();
    const r = new NativeReader({ engine: f.engine });
    r.load(['It boils at 100 °C today.']);
    r.play();
    const { text, o } = f.last();
    o.onStart();
    o.onBoundary(text.indexOf('degrees'));
    const w = r.getState().word!;
    // A substituted expression highlights as a whole: "100 degrees Celsius" ↔ "100 °C".
    expect(w.text).toBe('100 °C');
    expect(r.getState().sync).toBe('boundary');
    o.onBoundary(text.indexOf('today'));
    expect(r.getState().word).toMatchObject({ block: 0, text: 'today' });
    expect(
      highlightParts('It boils at 100 °C today.', r.getState().word)
    ).toEqual([
      { text: 'It boils at 100 °C ', active: false },
      { text: 'today', active: true },
      { text: '.', active: false },
    ]);
  });

  it('estimates the word when the engine sends no boundaries', () => {
    const f = fakeEngine();
    const r = new NativeReader({ engine: f.engine, pace: 15 });
    r.load(['One two three four five six seven eight nine ten.']);
    r.play();
    f.last().o.onStart();
    expect(r.getState().word?.text).toBe('One');
    jest.advanceTimersByTime(2000);
    expect(r.getState().sync).toBe('estimated');
    expect(r.getState().word?.text).not.toBe('One');
  });

  it('pauses and resumes from the word being spoken, on engines that cannot pause', () => {
    const f = fakeEngine();
    const r = new NativeReader({ engine: f.engine });
    r.load(['The quick brown fox jumps over the lazy dog.']);
    r.play();
    const { text, o } = f.last();
    o.onStart();
    o.onBoundary(text.indexOf('fox'));
    r.pause();
    expect(r.getState().status).toBe('paused');
    // A late callback from the stopped utterance changes nothing.
    o.onDone();
    expect(r.getState().status).toBe('paused');

    r.resume();
    expect(f.last().text).toBe('fox jumps over the lazy dog.');
    expect(r.getState().status).toBe('playing');
  });

  it('reads from a tapped word', () => {
    const f = fakeEngine();
    const r = new NativeReader({ engine: f.engine });
    r.load(BLOCKS);
    r.seek(0, BLOCKS[0].indexOf('boils') + 2);
    expect(f.last().text).toBe('boils at 100 degrees Celsius.');
    expect(r.getState().sentence).toBe(1);
  });

  it('skips by sentence', () => {
    const f = fakeEngine();
    const r = new NativeReader({ engine: f.engine });
    r.load(BLOCKS);
    r.play();
    r.skip(1);
    expect(f.last().text).toBe('It boils at 100 degrees Celsius.');
    r.skip(-5);
    expect(f.last().text).toBe('Water is H 2 O.');
  });

  it('lets an announcement cut in, then carries on from the same word', () => {
    const f = fakeEngine();
    const r = new NativeReader({ engine: f.engine });
    r.load(['Your mechanic is on the way with a spare tyre.']);
    r.play();
    const { text, o } = f.last();
    o.onStart();
    o.onBoundary(text.indexOf('on the way'));

    r.announce('In 300 m, turn left.');
    expect(f.last().text).toBe('In 300 meters, turn left.');
    expect(r.getState().announcing).toBe(true);
    f.last().o.onDone();

    expect(r.getState().announcing).toBe(false);
    expect(f.last().text).toBe('on the way with a spare tyre.');
  });

  it('queues a polite announcement until the sentence ends', () => {
    const f = fakeEngine();
    const r = new NativeReader({ engine: f.engine });
    r.load(['First sentence here.', 'Second sentence here.']);
    r.play();
    f.last().o.onStart();
    r.announce('Arrived.', { interrupt: false });
    expect(f.texts()).toEqual(['First sentence here.']);
    f.last().o.onDone();
    expect(f.last().text).toBe('Arrived.');
    f.last().o.onDone();
    expect(f.last().text).toBe('Second sentence here.');
  });

  it('speaks announcements with nothing loaded, in order', () => {
    const f = fakeEngine();
    const r = new NativeReader({ engine: f.engine });
    r.announce('Help is 5 min away.');
    r.announce('Stay with your vehicle.');
    expect(f.texts()).toEqual(['Help is 5 minutes away.']);
    f.last().o.onDone();
    expect(f.last().text).toBe('Stay with your vehicle.');
    f.last().o.onDone();
    expect(r.getState()).toMatchObject({ status: 'idle', announcing: false });
  });

  it('applies a new rate from the current word', () => {
    const f = fakeEngine();
    const r = new NativeReader({ engine: f.engine });
    r.load(['Alpha beta gamma delta.']);
    r.play();
    const { text, o } = f.last();
    o.onStart();
    o.onBoundary(text.indexOf('gamma'));
    r.configure({ rate: 1.5 });
    expect(f.last().text).toBe('gamma delta.');
    expect(f.last().o.rate).toBe(1.5);
  });
});

describe('expoSpeechEngine', () => {
  it('passes options through and reads charIndex from boundary events', () => {
    const speak = jest.fn();
    const stop = jest.fn();
    const engine = expoSpeechEngine({ speak, stop });
    const onBoundary = jest.fn();
    engine.speak('Hello world', {
      rate: 1.2,
      pitch: 1,
      volume: 1,
      language: 'en-GB',
      onStart() {},
      onDone() {},
      onError() {},
      onBoundary,
    });
    const options = speak.mock.calls[0][1];
    expect(options).toMatchObject({ rate: 1.2, language: 'en-GB' });
    options.onBoundary({ charIndex: 6, charLength: 5 });
    options.onBoundary(undefined);
    expect(onBoundary).toHaveBeenCalledTimes(1);
    expect(onBoundary).toHaveBeenCalledWith(6);
    engine.stop();
    expect(stop).toHaveBeenCalled();
  });
});
