import Image from 'next/image';
import { Github } from 'lucide-react';

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap site-header-inner">
        <a href="/" className="brand">
          <Image src="/images/audio-reader-highlight-circle.png" alt="" width={30} height={30} priority />
          <span>Audio Reader Highlight</span>
        </a>
        <nav aria-label="Primary">
          <a href="#article">Essay</a>
          <a href="#lab">Lab</a>
          <a
            href="https://github.com/hesbon-osoro/audio-reader-highlight"
            target="_blank"
            rel="noreferrer"
            aria-label="Source on GitHub"
            className="nav-icon"
          >
            <Github size={18} />
          </a>
        </nav>
      </div>
    </header>
  );
}
