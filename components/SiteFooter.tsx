'use client';
import React from 'react';
import { Github, Mail, Link as LinkIcon, Star } from 'lucide-react';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <section className="glass">
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
            APIs & Routes
          </h4>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0.5rem 0 0',
              display: 'grid',
              gap: 6,
            }}
          >
            <li>
              <a href="/api/abbreviations" target="_blank" rel="noreferrer">
                <LinkIcon size={16} style={{ verticalAlign: 'text-bottom' }} />{' '}
                /api/abbreviations
              </a>
            </li>
          </ul>
        </section>

        <section className="glass">
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
            Repo & Support
          </h4>
          <p style={{ margin: '0.5rem 0 0.75rem', color: 'var(--ink)' }}>
            If this helped you, consider starring the repo.
          </p>
          <a
            className="cta"
            href="https://github.com/hesbon-osoro/audio-reader-highlight"
            target="_blank"
            rel="noreferrer"
            aria-label="Star the repository on GitHub"
            title="Star on GitHub"
          >
            <Star size={16} />
            <Github size={16} />
            <span>Star on GitHub</span>
          </a>
        </section>

        <section className="glass">
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
            About & Contact
          </h4>
          <p style={{ margin: '0.5rem 0', color: 'var(--ink)' }}>
            I’m merit‑driven and results‑oriented. When I hit a dead end, I
            engineer a solution and open‑source it to help other developers move
            faster. I’m open to opportunities.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <a href="mailto:hesbonosoro1@gmail.com">
              <Mail size={16} style={{ verticalAlign: 'text-bottom' }} />{' '}
              hesbonosoro1@gmail.com
            </a>
            <a
              href="https://github.com/hesbon-osoro"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={16} style={{ verticalAlign: 'text-bottom' }} />{' '}
              github.com/hesbon-osoro
            </a>
          </div>
        </section>
      </div>
    </footer>
  );
}
