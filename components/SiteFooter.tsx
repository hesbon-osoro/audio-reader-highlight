import { Coffee, Github, Globe, HeartHandshake, Mail } from 'lucide-react';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <section className="wrap support" aria-labelledby="support-title">
        <div className="support-copy">
          <h2 id="support-title">
            Free for everyone. Kept going by people like you.
          </h2>
          <p>
            No paid tier, no feature behind a key. If the reader saves you time
            or helps your readers, you can give back, entirely by choice.
          </p>
        </div>
        <div className="support-actions">
          <a
            className="btn btn-primary"
            href="https://hesbon.dev/pay?kind=custom"
            data-track="click_coffee"
            data-track-location="footer"
            target="_blank"
            rel="noreferrer"
          >
            <Coffee size={18} aria-hidden /> Buy Hesbon a coffee
          </a>
          <a
            className="btn btn-ghost"
            href="https://able-hearts.org/donate"
            data-track="click_donate"
            data-track-location="footer"
            target="_blank"
            rel="noreferrer"
          >
            <HeartHandshake size={18} aria-hidden /> Donate to Able Hearts
          </a>
        </div>
      </section>
      <div className="wrap footer-inner">
        <div>
          <p className="footer-brand">Audio Reader Highlight</p>
          <p>
            Open source, MIT licensed. Built by Hesbon Osoro so that reading
            aloud is free for everyone who needs it.
          </p>
        </div>
        <div className="footer-links">
          <a
            href="https://hesbon.dev"
            target="_blank"
            rel="noreferrer"
            data-track="click_hesbon_dev"
            data-track-location="footer"
          >
            <Globe size={16} aria-hidden /> hesbon.dev
          </a>
          <a
            href="mailto:osoro@hesbon.dev"
            data-track="click_email"
            data-track-location="footer"
          >
            <Mail size={16} aria-hidden /> osoro@hesbon.dev
          </a>
          <a
            href="https://github.com/hesbon-osoro/audio-reader-highlight"
            target="_blank"
            rel="noreferrer"
            data-track="click_github"
            data-track-location="footer"
          >
            <Github size={16} aria-hidden /> Star on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
