import { Github, Mail } from 'lucide-react';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <div>
          <p className="footer-brand">Audio Reader Highlight</p>
          <p>
            Open source. When I hit a dead end, I engineer a way through and share it, so the next developer moves
            faster.
          </p>
        </div>
        <div className="footer-links">
          <a href="https://github.com/hesbon-osoro/audio-reader-highlight" target="_blank" rel="noreferrer">
            <Github size={16} aria-hidden /> Star on GitHub
          </a>
          <a href="mailto:hesbonosoro1@gmail.com">
            <Mail size={16} aria-hidden /> hesbonosoro1@gmail.com
          </a>
          <a href="/api/abbreviations" target="_blank" rel="noreferrer">
            /api/abbreviations
          </a>
        </div>
      </div>
    </footer>
  );
}
