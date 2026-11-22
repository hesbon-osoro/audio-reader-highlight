import Image from 'next/image';
import { Github } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap site-header-inner">
        <a href="/" className="brand">
          <Image
            src="/logo-animated.svg"
            alt=""
            width={30}
            height={30}
            priority
          />
          <span>Audio Reader Highlight</span>
        </a>
        <nav aria-label="Primary">
          <a
            href="#essay"
            data-track="click_cta"
            data-track-cta="essay"
            data-track-location="nav"
          >
            Essay
          </a>
          <a
            href="#lab"
            data-track="click_cta"
            data-track-cta="lab"
            data-track-location="nav"
          >
            Lab
          </a>
          <a
            href="#install"
            data-track="click_cta"
            data-track-cta="install"
            data-track-location="nav"
          >
            Install
          </a>
          <a
            href="https://github.com/hesbon-osoro/audio-reader-highlight"
            target="_blank"
            rel="noreferrer"
            aria-label="Source on GitHub"
            data-track="click_github"
            data-track-location="header"
            className="nav-icon"
          >
            <Github size={18} />
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
