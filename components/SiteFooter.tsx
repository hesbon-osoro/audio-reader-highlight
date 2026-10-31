import { Github, Globe, Mail } from 'lucide-react';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <div>
          <p className="footer-brand">Audio Reader Highlight</p>
          <p>
            Open source, MIT licensed. Built by Hesbon Osoro so that reading
            aloud is free for everyone who needs it.
          </p>
        </div>
        <div className="footer-links">
          <a href="https://hesbon.dev" target="_blank" rel="noreferrer">
            <Globe size={16} aria-hidden /> hesbon.dev
          </a>
          <a href="mailto:osoro@hesbon.dev">
            <Mail size={16} aria-hidden /> osoro@hesbon.dev
          </a>
          <a
            href="https://github.com/hesbon-osoro/audio-reader-highlight"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={16} aria-hidden /> Star on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
