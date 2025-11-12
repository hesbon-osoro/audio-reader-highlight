'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { buildSpeechFromSegment } from '../lib/textSubstitutions';
import {
  Volume2,
  Volume1,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Settings,
  X,
  Square,
  MousePointer2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export interface SimplifiedAudioReaderProps {
  readonly content: string;
  readonly title: string;
}

export default function SimplifiedAudioReader({
  content,
  title,
}: SimplifiedAudioReaderProps) {
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(0.4);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [highlightRange, setHighlightRange] = useState({ from: 0, to: 0 });
  const currentHighlightRef = useRef<HTMLElement | null>(null);
  const sentenceHighlightsRef = useRef<HTMLElement[]>([]);
  const textMappingRef = useRef<{ domText: string; cleanText: string }>({
    domText: '',
    cleanText: '',
  });
  const textNodesIndexRef = useRef<
    Array<{
      node: Text;
      domStart: number; // start offset in normalized fullDomText
      normToOrig: number[]; // map from normalized index within this node to original index in node.data
      normLength: number; // length of normalized text for this node
      blockId: number; // ID for closest block ancestor
    }>
  >([]);
  const blockElementsRef = useRef<Map<number, HTMLElement>>(new Map());
  const blocksRef = useRef<
    Array<{ blockId: number; start: number; end: number }>
  >([]);
  const currentBlockIdxRef = useRef<number>(0);
  const boundaryEnabledRef = useRef<boolean>(true);
  const activeBlockElRef = useRef<HTMLElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const tokensRef = useRef<
    Array<{ el: HTMLElement; text: string; blockId: number }>
  >([]);
  const blockTokenRangesRef = useRef<
    Array<{ blockId: number; fromToken: number; toToken: number }>
  >([]);
  const sessionActiveRef = useRef<boolean>(false);
  const sessionTokensRef = useRef<
    Array<{ el: HTMLElement; text: string; blockId: number }>
  >([]);
  const sessionBlockTokenRangesRef = useRef<
    Array<{ blockId: number; fromToken: number; toToken: number }>
  >([]);
  const sessionBlocksRef = useRef<
    Array<{ blockId: number; start: number; end: number }>
  >([]);
  const speechWordToTokenRef = useRef<number[]>([]);
  const tokenPointerRef = useRef<number>(-1);
  const currentTokenElRef = useRef<HTMLElement | null>(null);
  const speechWordCounterRef = useRef<number>(0);
  const userScrollUntilRef = useRef<number>(0);
  const sentenceOverlayRef = useRef<HTMLDivElement | null>(null);
  const wordOverlayRef = useRef<HTMLDivElement | null>(null);
  const lastSentenceElRef = useRef<HTMLElement | null>(null);
  const lastWordElRef = useRef<HTMLElement | null>(null);
  const volumePopupRef = useRef<HTMLDivElement | null>(null);
  const enableSentenceOverlay = true;
  const useBlockActiveClass = false;

  const ensureOverlays = useCallback(() => {
    const mk = (id: string, z: number) => {
      let el = document.getElementById(id) as HTMLDivElement | null;
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.style.position = 'fixed';
        el.style.left = '0';
        el.style.top = '0';
        el.style.width = '100%';
        el.style.height = '0';
        el.style.pointerEvents = 'none';
        el.style.zIndex = String(z);
        el.style.display = 'none';
        document.body.appendChild(el);
      }
      return el;
    };
    if (enableSentenceOverlay && !sentenceOverlayRef.current)
      sentenceOverlayRef.current = mk('arh-overlay-sentence', 9999);
    if (!wordOverlayRef.current)
      wordOverlayRef.current = mk('arh-overlay-word', 10000);
  }, [enableSentenceOverlay]);

  // Ensure the post starts immediately below the top bar
  useEffect(() => {
    const updateOffset = () => {
      const bar = document.querySelector(
        '.audio-reader-bar'
      ) as HTMLElement | null;
      const h = bar ? Math.ceil(bar.getBoundingClientRect().height + 12) : 0; // include small gap
      document.documentElement.style.setProperty('--arh-bar-offset', `${h}px`);
    };
    updateOffset();
    const RO = (window as any).ResizeObserver as
      | typeof ResizeObserver
      | undefined;
    const ro = RO ? new RO(updateOffset) : null;
    const bar = document.querySelector(
      '.audio-reader-bar'
    ) as HTMLElement | null;
    if (ro && bar) ro.observe(bar);
    window.addEventListener('resize', updateOffset);
    return () => {
      window.removeEventListener('resize', updateOffset);
      if (ro && bar) ro.unobserve(bar);
    };
  }, []);

  // Toggle overlay visibility with playing state
  useEffect(() => {
    ensureOverlays();
    const show = isPlaying; // Show overlays when playing OR paused (keep highlights visible)
    if (enableSentenceOverlay && sentenceOverlayRef.current)
      sentenceOverlayRef.current.style.display = show ? 'block' : 'none';
    if (wordOverlayRef.current)
      wordOverlayRef.current.style.display = show ? 'block' : 'none';
    if (!show) {
      // Only clear overlays when completely stopped, not when paused
      if (enableSentenceOverlay) clearOverlay(sentenceOverlayRef.current);
      clearOverlay(wordOverlayRef.current);
    }
  }, [isPlaying, isPaused, ensureOverlays, enableSentenceOverlay]);

  const clearOverlay = (root: HTMLDivElement | null) => {
    if (!root) return;
    root.innerHTML = '';
  };

  type RectLike = Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>;
  const renderRects = useCallback((
    root: HTMLDivElement,
    rects: DOMRectList | ReadonlyArray<DOMRect | DOMRectReadOnly>,
    mode: 'sentence' | 'word'
  ) => {
    root.innerHTML = '';
    const list: RectLike[] = Array.from(
      rects as unknown as ArrayLike<DOMRectReadOnly>
    );
    const vw = Math.max(
      0,
      window.innerWidth || document.documentElement.clientWidth || 0
    );
    const vh = Math.max(
      0,
      window.innerHeight || document.documentElement.clientHeight || 0
    );
    for (const r of list) {
      const d = document.createElement('div');
      d.style.position = 'fixed';
      if (mode === 'word') {
        const padX = 2; // subtle left/right breathing room
        const padY = 2; // slight vertical breathing room
        const left = Math.max(0, r.left - padX);
        const top = Math.max(0, r.top - padY);
        const width = Math.max(0, Math.min(vw - left, r.width + padX * 2));
        const height = Math.max(0, Math.min(vh - top, r.height + padY * 2));
        d.style.left = `${left}px`;
        d.style.top = `${top}px`;
        d.style.width = `${width}px`;
        d.style.height = `${height}px`;
      } else {
        d.style.left = `${r.left}px`;
        d.style.top = `${r.top}px`;
        d.style.width = `${Math.max(0, r.width)}px`;
        d.style.height = `${Math.max(0, r.height)}px`;
      }
      d.style.borderRadius = '8px';
      d.style.pointerEvents = 'none';
      if (mode === 'sentence') {
        // Soft sentence highlight - no blur to prevent UI shake
        d.style.background = 'rgba(59, 130, 246, 0.08)';
        d.style.border = '1px solid rgba(59, 130, 246, 0.15)';
        d.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.08)';
      } else {
        // Soft word emphasis - no blur to prevent text distortion
        d.style.background = 'rgba(251, 191, 36, 0.12)';
        d.style.border = '1px solid rgba(251, 191, 36, 0.2)';
        d.style.boxShadow = '0 1px 4px rgba(251, 191, 36, 0.1)';
      }
      root.appendChild(d);
    }
  }, []);

  // Keep overlays aligned when the user scrolls/resizes (word only; sentence is range-based and will rerender on next boundary)
  useEffect(() => {
    let rafId: number;
    
    const rerender = () => {
      // Cancel any pending animation frame
      if (rafId) cancelAnimationFrame(rafId);
      
      rafId = requestAnimationFrame(() => {
        if (!wordOverlayRef.current) return;
        ensureOverlays();
        
        // Find the currently highlighted word element
        const currentHighlight = currentHighlightRef.current;
        if (currentHighlight && wordOverlayRef.current) {
          const r = currentHighlight.getClientRects();
          if (r.length > 0) {
            renderRects(wordOverlayRef.current, r as any, 'word');
          }
        } else if (lastWordElRef.current && wordOverlayRef.current) {
          // Fallback to lastWordElRef if no current highlight
          const r = lastWordElRef.current.getClientRects();
          if (r.length > 0) {
            renderRects(wordOverlayRef.current, r as any, 'word');
          }
        }
      });
    };
    
    // Immediate scroll update for better tracking
    const immediateRerender = () => {
      rerender();
    };
    
    // Use throttled scroll for better performance
    let scrollTimeout: NodeJS.Timeout;
    const throttledRerender = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(rerender, 8); // ~120fps for smoother tracking
    };
    
    window.addEventListener('scroll', immediateRerender, { passive: true });
    window.addEventListener('resize', rerender);
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      window.removeEventListener('scroll', immediateRerender);
      window.removeEventListener('resize', rerender);
    };
  }, [ensureOverlays, renderRects]);

  const removeEmojis = (s: string) =>
    s
      // flags, pictographs, supplemental symbols
      .replace(
        /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F3FB}-\u{1F3FF}]/gu,
        ''
      )
      // variation selectors & ZWJ
      .replace(/[\u200D\uFE0E\uFE0F]/g, '');

  const cleanContent = useCallback(
    (html: string): { text: string; domText: string } => {
      // Server-side (no document): fallback to regex tag strip to avoid ReferenceError
      if (typeof document === 'undefined') {
        const noScripts = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '');
        const stripped = noScripts.replace(/<[^>]+>/g, ' ');
        const normalized = removeEmojis(stripped).replace(/\s+/g, ' ');
        return { text: normalized, domText: normalized };
      }

      const temp = document.createElement('div');
      temp.innerHTML = html;

      const scripts = temp.querySelectorAll('script, style');
      scripts.forEach(el => el.remove());

      const domTemp = temp.cloneNode(true) as HTMLElement;

      // Treat list items as discrete points: add bullet and terminal punctuation
      const injectListSeparators = (root: HTMLElement) => {
        root.querySelectorAll('li').forEach(li => {
          // Prefix bullet if not present as text content
          if (!/^\s*[•\-]/.test(li.textContent || '')) {
            li.insertBefore(document.createTextNode(' • '), li.firstChild);
          }
          // Ensure terminal punctuation for natural pause
          const txt = li.textContent || '';
          if (!/[.!?…]["'”’)?\]]?\s*$/.test(txt)) {
            li.appendChild(document.createTextNode('.'));
          }
          // Add a separating space after each item in lists
          li.appendChild(document.createTextNode(' '));
        });
      };

      // Apply to both temp (speech source) and domTemp (index source); real DOM remains untouched
      injectListSeparators(temp);
      injectListSeparators(domTemp);

      const images = temp.querySelectorAll('img');
      images.forEach(img => {
        const alt = img.getAttribute('alt');
        if (alt) {
          const altText = document.createTextNode(` [Image: ${alt}] `);
          img.parentNode?.insertBefore(altText, img.nextSibling);
        }
        img.remove();
      });

      // Collapse whitespace but do not trim edges to keep alignment with DOM indexer
      let cleanText = temp.textContent || (temp as any).innerText || '';
      cleanText = removeEmojis(cleanText.replace(/\s+/g, ' '));

      let domText = (
        domTemp.textContent ||
        (domTemp as any).innerText ||
        ''
      ).replace(/\s+/g, ' ');
      domText = removeEmojis(domText);

      return { text: cleanText, domText };
    },
    []
  );

  const { text: cleanedContent, domText: domContent } = cleanContent(content);
  const fullText = `${cleanedContent}`;
  const fullDomText = `${domContent}`;

  useEffect(() => {
    textMappingRef.current = {
      domText: fullDomText,
      cleanText: fullText,
    };
  }, [fullText, fullDomText]);

  const convertToDomPosition = useCallback(
    (cleanPosition: number, length: number = 10) => {
      const { cleanText } = textMappingRef.current;
      if (cleanPosition >= cleanText.length) return { from: 0, to: 0 };
      const from = cleanPosition;
      const to = Math.min(cleanText.length, from + length);
      return { from, to };
    },
    []
  );

  // Find exact word boundaries around an index in the normalized clean text
  const getWordRangeAt = useCallback((index: number) => {
    const { cleanText } = textMappingRef.current;
    const len = cleanText.length;
    if (len === 0) return { from: 0, to: 0 };
    let i = Math.min(Math.max(index, 0), len - 1);

    // If we're on whitespace, move right to the next non-space
    while (i < len && /\s/.test(cleanText[i])) i++;
    if (i >= len) return { from: len - 1, to: len };

    // Word characters: letters, numbers, apostrophes (treat dashes as separators)
    const isWordChar = (ch: string) => /[\p{L}\p{N}']/u.test(ch);
    const isTrailPunct = (ch: string) => /[.,!?;:)\]\}"”’]/u.test(ch);

    // If current is not word char (punctuation), just highlight that single char
    if (!isWordChar(cleanText[i])) {
      return { from: i, to: i + 1 };
    }

    // Expand left and right over word characters
    let start = i;
    let end = i + 1;
    while (start > 0 && isWordChar(cleanText[start - 1])) start--;
    while (end < len && isWordChar(cleanText[end])) end++;
    // Include immediate trailing punctuation (e.g., comma/period)
    while (end < len && isTrailPunct(cleanText[end])) end++;
    // Trim any stray spaces at edges
    while (start < end && /\s/.test(cleanText[start])) start++;
    while (end > start && /\s/.test(cleanText[end - 1])) end--;
    return { from: start, to: end };
  }, []);

  // Allow free user scrolling: suspend auto-scroll briefly after user scroll
  useEffect(() => {
    const onUserScroll = () => {
      userScrollUntilRef.current = Date.now() + 1500; // 1.5s grace
    };
    window.addEventListener('wheel', onUserScroll, { passive: true });
    window.addEventListener('touchmove', onUserScroll, { passive: true });
    window.addEventListener('scroll', onUserScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', onUserScroll as any);
      window.removeEventListener('touchmove', onUserScroll as any);
      window.removeEventListener('scroll', onUserScroll as any);
    };
  }, []);

  // Handle click outside to close popups
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;

      if (
        showVolumePopup &&
        volumePopupRef.current &&
        !volumePopupRef.current.contains(target as Node)
      ) {
        const volumeButton = target?.closest('.volume');
        if (!volumeButton) {
          setShowVolumePopup(false);
        }
      }

      if (showControlPanel && !target?.closest('.control-panel')) {
        const settingsButton = target?.closest('.icon-btn');
        if (!settingsButton) {
          setShowControlPanel(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVolumePopup, showControlPanel]);

  // Rehydrate tokens when DOM is already tokenized
  const rehydrateTokensFromDom = useCallback(() => {
    tokensRef.current = [];
    blockTokenRangesRef.current = [];
    const article = document.querySelector('article');
    if (!article) return;
    const spans = Array.from(
      article.querySelectorAll<HTMLElement>('span.tts-token')
    );
    if (!spans.length) return;
    for (const span of spans) {
      const blockEl = span.closest(
        'p,li,div,h1,h2,h3,h4,h5,h6,blockquote,article,section'
      ) as HTMLElement | null;
      let blockId = 0;
      if (blockEl) {
        for (const [id, el] of blockElementsRef.current.entries()) {
          if (el === blockEl) {
            blockId = id;
            break;
          }
        }
      }
      tokensRef.current.push({
        el: span,
        text: span.textContent || '',
        blockId,
      });
    }
    // compute ranges per block
    if (tokensRef.current.length) {
      const groups = new Map<number, { from: number; to: number }>();
      tokensRef.current.forEach((tok, idx) => {
        const g = groups.get(tok.blockId);
        if (!g) groups.set(tok.blockId, { from: idx, to: idx + 1 });
        else g.to = idx + 1;
      });
      blockTokenRangesRef.current = Array.from(groups.entries())
        .map(([blockId, r]) => ({ blockId, fromToken: r.from, toToken: r.to }))
        .sort((a, b) => a.fromToken - b.fromToken);
    }
  }, []);

  const clearTokenAndBlockHighlights = useCallback(() => {
    // remove word emphasis
    const current = currentTokenElRef.current;
    if (current) current.classList.remove('audio-word');
    const allTokens = document.querySelectorAll<HTMLElement>(
      'span.tts-token.audio-word'
    );
    allTokens.forEach(el => el.classList.remove('audio-word'));
    currentTokenElRef.current = null;
    // remove active block class
    if (activeBlockElRef.current) {
      activeBlockElRef.current.classList.remove('audio-sentence-active');
      activeBlockElRef.current = null;
    }
  }, []);

  // use centralized helper via import

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        if (!selectedVoice) {
          const englishVoice =
            availableVoices.find(v => v.lang.startsWith('en')) ||
            availableVoices[0];
          if (englishVoice) setSelectedVoice(englishVoice.voiceURI);
        }
      }
    };

    loadVoices();
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      (window.speechSynthesis as any).onvoiceschanged !== undefined
    ) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoice]);

  const removeCurrentHighlight = useCallback(() => {
    if (currentHighlightRef.current) {
      const highlight = currentHighlightRef.current;
      const parent = highlight.parentNode;
      if (parent) {
        parent.replaceChild(
          document.createTextNode(highlight.textContent || ''),
          highlight
        );
        (parent as HTMLElement).normalize();
      }
      currentHighlightRef.current = null;
    }
    if (sentenceHighlightsRef.current.length) {
      for (const span of sentenceHighlightsRef.current) {
        const parent = span.parentNode;
        if (parent) {
          parent.replaceChild(
            document.createTextNode(span.textContent || ''),
            span
          );
          (parent as HTMLElement).normalize();
        }
      }
      sentenceHighlightsRef.current = [];
    }
    // clear overlays
    if (enableSentenceOverlay) clearOverlay(sentenceOverlayRef.current);
    clearOverlay(wordOverlayRef.current);
    lastSentenceElRef.current = null;
    lastWordElRef.current = null;
    if (sentenceOverlayRef.current)
      sentenceOverlayRef.current.style.display = 'none';
    if (wordOverlayRef.current) wordOverlayRef.current.style.display = 'none';
  }, []);

  // Cleanup effect - now properly placed after removeCurrentHighlight is defined
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      removeCurrentHighlight();
    };
  }, [removeCurrentHighlight]);

  // Build index helper (article only)
  const buildIndex = useCallback(() => {
    const el = document.querySelector('article') as HTMLElement | null;
    const index: Array<{
      node: Text;
      domStart: number;
      normToOrig: number[];
      normLength: number;
      blockId: number;
    }> = [];
    let cumulative = 0;
    const blockIdMap = new WeakMap<HTMLElement, number>();
    let blockCounter = 1;

    const normalizeAndMap = (raw: string) => {
      const normToOrig: number[] = [];
      let normalized = '';
      let lastWasSpace = false;
      for (let i = 0; i < raw.length; i++) {
        let ch = raw[i];
        // strip emoji so DOM index matches speech text
        try {
          if (/\p{Extended_Pictographic}/u.test(ch)) continue;
        } catch {
          if (
            /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}]/u.test(
              ch
            )
          )
            continue;
        }
        const isSpace = /\s/.test(ch);
        if (isSpace) {
          if (!lastWasSpace) {
            normalized += ' ';
            normToOrig.push(i);
            lastWasSpace = true;
          }
        } else {
          normalized += ch;
          normToOrig.push(i);
          lastWasSpace = false;
        }
      }
      return { normalized, map: normToOrig };
    };

    if (el) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: (node: Node) => {
          const parent = (node as any).parentElement as HTMLElement | null;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (
            parent.closest('.audio-reader-bar') ||
            parent.tagName === 'SCRIPT' ||
            parent.tagName === 'STYLE' ||
            parent.classList.contains('audio-highlight')
          )
            return NodeFilter.FILTER_REJECT;
          const text = node.textContent || '';
          return text.trim().length > 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      } as NodeFilter);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const t = n as Text;
        const raw = t.data;
        const { normalized, map } = normalizeAndMap(raw);
        const parentEl = t.parentElement as HTMLElement | null;
        const closestBlock = parentEl?.closest(
          'p,li,div,h1,h2,h3,h4,h5,h6,blockquote,article,section'
        ) as HTMLElement | null;
        const blockEl: HTMLElement = closestBlock ?? (el as HTMLElement);
        let id = blockIdMap.get(blockEl);
        if (!id) {
          id = blockCounter++;
          blockIdMap.set(blockEl, id);
          blockElementsRef.current.set(id, blockEl as HTMLElement);
        }
        index.push({
          node: t,
          domStart: cumulative,
          normToOrig: map,
          normLength: normalized.length,
          blockId: id,
        });
        cumulative += normalized.length;
      }
    }
    textNodesIndexRef.current = index;
    return index;
  }, []);

  // Tokenize article: wrap each word into span.tts-token, snapshot nodes before mutating
  const tokenizeArticle = useCallback(() => {
    tokensRef.current = [];
    blockTokenRangesRef.current = [];
    const article = document.querySelector('article');
    if (!article) return;

    const isWordChar = (ch: string) => /[\p{L}\p{N}']/u.test(ch);
    const isTrailPunct = (ch: string) => /[.,!?;:]/.test(ch);
    const isCurrency = (ch: string) => ch === '$' || ch === '€' || ch === '£';
    const isKMB = (ch: string) => /[kKmMbB]/.test(ch);
    // Load multi-char currency symbols once per tokenize call
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const allCurrencies: Record<
      string,
      { symbol: string }
    > = require('../lib/data/common-currency.json');
    const multiSymbols = Array.from(
      new Set(
        Object.values(allCurrencies)
          .map(c => c.symbol)
          .filter(s => s && s.length > 1)
      )
    ).sort((a, b) => b.length - a.length);

    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
      acceptNode: (node: Node) => {
        const parent = (node as any).parentElement as HTMLElement | null;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (
          parent.closest('.audio-reader-bar') ||
          parent.tagName === 'SCRIPT' ||
          parent.tagName === 'STYLE' ||
          parent.classList.contains('tts-token')
        )
          return NodeFilter.FILTER_REJECT;
        const text = node.textContent || '';
        return text.trim().length > 0
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    } as NodeFilter);

    const textNodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) textNodes.push(n as Text);

    for (const t of textNodes) {
      const raw = t.data;
      let i = 0;
      const parentEl = t.parentElement as HTMLElement;
      const frag = document.createDocumentFragment();
      const beforeLen = tokensRef.current.length;
      while (i < raw.length) {
        const ch = raw[i];
        // Multi-char prefix currency symbols like CA$, HK$, NT$, R$ followed by amount
        if (/[A-Za-z]/.test(ch)) {
          const sym = multiSymbols.find(s => raw.startsWith(s, i));
          if (sym) {
            let j = i + sym.length;
            while (j < raw.length && raw[j] === ' ') j++;
            let sawDigit = false;
            let k = j;
            while (k < raw.length && /[0-9]/.test(raw[k])) {
              k++;
              sawDigit = true;
            }
            if (k < raw.length && raw[k] === ',') {
              let t = k;
              while (t < raw.length) {
                if (raw[t] === ',' && /[0-9]/.test(raw[t + 1] || '')) {
                  t += 2;
                  while (t < raw.length && /[0-9]/.test(raw[t])) t++;
                  k = t;
                } else break;
              }
            }
            if (k < raw.length && raw[k] === '.') {
              k++;
              while (k < raw.length && /[0-9]/.test(raw[k])) k++;
            }
            if (k < raw.length && isKMB(raw[k])) {
              k++;
            }
            if (k < raw.length && /[.,]/.test(raw[k])) k++;
            if (sawDigit) {
              const span = document.createElement('span');
              span.className = 'tts-token';
              span.textContent = raw.slice(i, k);
              frag.appendChild(span);
              i = k;
              continue;
            }
          }
        }
        // Currency token: symbol + number [.[number]] [k|M|B] + optional trailing punct
        if (isCurrency(ch)) {
          let j = i + 1;
          // optional space after symbol
          while (j < raw.length && raw[j] === ' ') j++;
          // digits with grouping and decimal
          let sawDigit = false;
          while (j < raw.length && /[0-9]/.test(raw[j])) {
            j++;
            sawDigit = true;
          }
          if (j < raw.length && raw[j] === ',') {
            // allow grouped commas like 1,234
            let k = j;
            while (k < raw.length) {
              if (raw[k] === ',' && /[0-9]/.test(raw[k + 1] || '')) {
                k += 2;
                while (k < raw.length && /[0-9]/.test(raw[k])) k++;
                j = k;
              } else break;
            }
          }
          if (j < raw.length && raw[j] === '.') {
            j++;
            while (j < raw.length && /[0-9]/.test(raw[j])) j++;
          }
          if (j < raw.length && isKMB(raw[j])) {
            j++;
          }
          // optional trailing punctuation
          if (j < raw.length && /[.,]/.test(raw[j])) j++;
          if (sawDigit) {
            const span = document.createElement('span');
            span.className = 'tts-token';
            span.textContent = raw.slice(i, j);
            frag.appendChild(span);
            i = j;
            continue;
          }
        }
        // Postfix currency: number [.[number]] [k|M|B] + optional space + symbol (single or multi-char), then optional trailing punctuation
        if (/[0-9]/.test(ch)) {
          let j = i;
          let sawDigit = false;
          while (j < raw.length && /[0-9]/.test(raw[j])) {
            j++;
            sawDigit = true;
          }
          // grouped commas and decimals
          if (j < raw.length && raw[j] === ',') {
            let k = j;
            while (k < raw.length) {
              if (raw[k] === ',' && /[0-9]/.test(raw[k + 1] || '')) {
                k += 2;
                while (k < raw.length && /[0-9]/.test(raw[k])) k++;
                j = k;
              } else break;
            }
          }
          if (j < raw.length && raw[j] === '.') {
            j++;
            while (j < raw.length && /[0-9]/.test(raw[j])) j++;
          }
          if (j < raw.length && isKMB(raw[j])) {
            j++;
          }
          // optional space before symbol
          let k = j;
          while (k < raw.length && raw[k] === ' ') k++;
          // Try multi-char symbols first
          const sym = multiSymbols.find(s => raw.startsWith(s, k));
          if (sym) {
            k += sym.length;
            if (k < raw.length && /[.,]/.test(raw[k])) k++;
            if (sawDigit) {
              const span = document.createElement('span');
              span.className = 'tts-token';
              span.textContent = raw.slice(i, k);
              frag.appendChild(span);
              i = k;
              continue;
            }
          } else if (k < raw.length && isCurrency(raw[k])) {
            k++;
            if (k < raw.length && /[.,]/.test(raw[k])) k++;
            if (sawDigit) {
              const span = document.createElement('span');
              span.className = 'tts-token';
              span.textContent = raw.slice(i, k);
              frag.appendChild(span);
              i = k;
              continue;
            }
          }
          // Number + unit (optionally '/'+unit) as a single token
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const units: Record<
            string,
            { singular: string; plural: string }
          > = require('../lib/data/common-units.json');
          const unitList = Object.keys(units).sort(
            (a, b) => b.length - a.length
          );
          // reset k to after number
          k = j;
          while (k < raw.length && raw[k] === ' ') k++;
          let end = k;
          const first = unitList.find(u => raw.startsWith(u, k));
          if (first) {
            end = k + first.length;
            // optional '/'+unit
            if (end < raw.length && raw[end] === '/') {
              const after = end + 1;
              const second = unitList.find(u => raw.startsWith(u, after));
              if (second) end = after + second.length;
            }
            // optional trailing punctuation
            if (end < raw.length && /[.,]/.test(raw[end])) end++;
            const span = document.createElement('span');
            span.className = 'tts-token';
            span.textContent = raw.slice(i, end);
            frag.appendChild(span);
            i = end;
            continue;
          }
        }
        // Abbreviation sequences like U.S., U.K., i.e., e.g. (no spaces between letters)
        if (
          /[A-Za-z]/.test(ch) &&
          raw[i + 1] === '.' &&
          /[A-Za-z]/.test(raw[i + 2] || '')
        ) {
          let j = i;
          let ok = false;
          while (
            j + 1 < raw.length &&
            /[A-Za-z]/.test(raw[j]) &&
            raw[j + 1] === '.'
          ) {
            j += 2;
            ok = true;
          }
          // optional trailing punctuation
          if (j < raw.length && /[,;:]/.test(raw[j])) j++;
          if (ok) {
            const span = document.createElement('span');
            span.className = 'tts-token';
            span.textContent = raw.slice(i, j);
            frag.appendChild(span);
            i = j;
            continue;
          }
        }
        if (!isWordChar(ch)) {
          let j = i + 1;
          while (j < raw.length && !isWordChar(raw[j])) j++;
          frag.appendChild(document.createTextNode(raw.slice(i, j)));
          i = j;
          continue;
        }
        let start = i;
        let end = i + 1;
        while (end < raw.length && isWordChar(raw[end])) end++;
        while (end < raw.length && isTrailPunct(raw[end])) end++;
        const word = raw.slice(start, end);
        const span = document.createElement('span');
        span.className = 'tts-token';
        span.textContent = word;
        frag.appendChild(span);
        // find nearest known block element
        let anc: HTMLElement | null = parentEl;
        let blockId: number | null = null;
        while (anc) {
          for (const [id, el] of blockElementsRef.current.entries()) {
            if (el === anc) {
              blockId = id;
              break;
            }
          }
          if (blockId != null) break;
          anc = anc.parentElement;
        }
        tokensRef.current.push({ el: span, text: word, blockId: blockId || 0 });
        i = end;
      }
      const afterLen = tokensRef.current.length;
      t.parentNode?.replaceChild(frag, t);
      // record token range for this node's block
      const blockEl = parentEl.closest(
        'p,li,div,h1,h2,h3,h4,h5,h6,blockquote,article,section'
      ) as HTMLElement | null;
      const id = (() => {
        if (!blockEl) return 0;
        for (const [bid, bel] of blockElementsRef.current.entries()) {
          if (bel === blockEl) return bid;
        }
        return 0;
      })();
      blockTokenRangesRef.current.push({
        blockId: id,
        fromToken: beforeLen,
        toToken: afterLen,
      });
    }

    // Merge ranges per block
    if (blockTokenRangesRef.current.length) {
      const merged = new Map<number, { fromToken: number; toToken: number }>();
      for (const r of blockTokenRangesRef.current) {
        const cur = merged.get(r.blockId);
        if (!cur)
          merged.set(r.blockId, { fromToken: r.fromToken, toToken: r.toToken });
        else cur.toToken = Math.max(cur.toToken, r.toToken);
      }
      blockTokenRangesRef.current = Array.from(merged.entries())
        .map(([blockId, r]) => ({
          blockId,
          fromToken: r.fromToken,
          toToken: r.toToken,
        }))
        .sort((a, b) => a.fromToken - b.fromToken);
    }
  }, []);

  // Build ordered blocks from current index
  const buildBlocks = useCallback(() => {
    const idx = textNodesIndexRef.current;
    const byId = new Map<number, { start: number; end: number }>();
    for (const it of idx) {
      const cur = byId.get(it.blockId);
      const start = it.domStart;
      const end = it.domStart + it.normLength;
      if (!cur) byId.set(it.blockId, { start, end });
      else
        byId.set(it.blockId, {
          start: Math.min(cur.start, start),
          end: Math.max(cur.end, end),
        });
    }
    const blocks = Array.from(byId.entries())
      .map(([blockId, range]) => ({
        blockId,
        start: range.start,
        end: range.end,
      }))
      .sort((a, b) => a.start - b.start);
    blocksRef.current = blocks;
    return blocks;
  }, []);

  const highlightTextAtPosition = useCallback(
    (from: number, to: number) => {
      try {
        removeCurrentHighlight();
        if (to <= from) return;
        ensureOverlays();

        // rebuild index to compute ranges.
        const idxArr = buildIndex();
        if (!idxArr.length) return;

        // Determine active block element for calm border tint
        const targetIdx = idxArr.findIndex(
          n => from >= n.domStart && from < n.domStart + n.normLength
        );
        if (enableSentenceOverlay && targetIdx !== -1) {
          const blockId = idxArr[targetIdx].blockId;
          const blockEl = blockElementsRef.current.get(blockId) || null;
          if (blockEl) {
            activeBlockElRef.current = blockEl;
          }
        }

        // Build a set of DOM Ranges and collect rects across nodes
        const rects: DOMRect[] = [] as any;
        let remaining = to - from;
        let cursor = from;
        let i = idxArr.findIndex(
          n => cursor >= n.domStart && cursor < n.domStart + n.normLength
        );
        while (remaining > 0 && i !== -1 && i < idxArr.length) {
          const part = idxArr[i];
          const startInNode = Math.max(0, cursor - part.domStart);
          const maxLen = part.normLength - startInNode;
          const take = Math.min(remaining, Math.max(0, maxLen));
          if (take <= 0) break;
          const os = part.normToOrig[startInNode] ?? 0;
          const oe = part.normToOrig[Math.max(startInNode + take - 1, 0)] + 1;
          if (oe > os) {
            const rng = document.createRange();
            rng.setStart(part.node, os);
            rng.setEnd(part.node, oe);
            const rlist = rng.getClientRects();
            for (const r of Array.from(rlist)) rects.push(r as DOMRect);
          }
          remaining -= take;
          cursor += take;
          i++;
        }
        if (enableSentenceOverlay && sentenceOverlayRef.current)
          renderRects(sentenceOverlayRef.current, rects as any, 'sentence');
      } catch (error) {
        console.warn('Highlighting failed:', error);
      }
    },
    [removeCurrentHighlight, buildIndex, ensureOverlays]
  );

  // Token highlight helper (top-level)
  const highlightToken = useCallback(
    (tokenIdx: number, blockId?: number) => {
      const tokSource = sessionActiveRef.current
        ? sessionTokensRef.current
        : tokensRef.current;
      const tok = tokSource[tokenIdx];
      if (!tok) return;
      // activate block highlight
      if (typeof blockId === 'number') {
        const el = blockElementsRef.current.get(blockId) || null;
        if (useBlockActiveClass) {
          if (activeBlockElRef.current && activeBlockElRef.current !== el) {
            activeBlockElRef.current.classList.remove('audio-sentence-active');
          }
          if (el) {
            el.classList.add('audio-sentence-active');
            activeBlockElRef.current = el;
          }
        } else {
          activeBlockElRef.current = el;
        }
        // sentence overlay is rendered from precise ranges in highlightTextAtPosition
      }
      // emphasize token via class for golden background
      tok.el.classList.add('audio-word');
      // emphasize token via overlay (subtle fill)
      ensureOverlays();
      const rects = tok.el.getClientRects();
      if (wordOverlayRef.current && rects.length > 0) {
        renderRects(wordOverlayRef.current, rects as any, 'word');
      }
      lastWordElRef.current = tok.el;
      currentTokenElRef.current = tok.el;
      
      // Force overlay update after a brief delay to handle any layout changes
      setTimeout(() => {
        if (wordOverlayRef.current && tok.el) {
          const updatedRects = tok.el.getClientRects();
          if (updatedRects.length > 0) {
            renderRects(wordOverlayRef.current, updatedRects as any, 'word');
          }
        }
      }, 50);
      if (autoScroll && Date.now() > userScrollUntilRef.current) {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          const rect = tok.el.getBoundingClientRect();
          const isVisible =
            rect.top >= 100 && rect.bottom <= window.innerHeight - 100;
          if (!isVisible)
            tok.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          rafIdRef.current = null;
        });
      }
    },
    [autoScroll]
  );

  const speakBlock = useCallback(
    (
      blockIdx: number,
      offset: number = 0,
      startTokenOverride: number | null = null
    ) => {
      if (!tokensRef.current.length) {
        // If DOM is already tokenized, rehydrate instead of tokenizing again
        const hasTokens = !!document.querySelector('article span.tts-token');
        if (hasTokens) rehydrateTokensFromDom();
        else tokenizeArticle();
      }
      const isSession = sessionActiveRef.current;
      const blocks = isSession
        ? sessionBlocksRef.current
        : blocksRef.current.length
          ? blocksRef.current
          : buildBlocks();
      if (blockIdx < 0 || blockIdx >= blocks.length) {
        // finished
        setIsPlaying(false);
        setIsPaused(false);
        setHighlightRange({ from: 0, to: 0 });
        setCurrentCharIndex(0);
        removeCurrentHighlight();
        if (activeBlockElRef.current)
          activeBlockElRef.current.classList.remove('audio-sentence-active');
        toast.success('Audio finished', { duration: 1200 });
        clearTokenAndBlockHighlights();
        sessionActiveRef.current = false;
        sessionTokensRef.current = [];
        sessionBlockTokenRangesRef.current = [];
        sessionBlocksRef.current = [];
        return;
      }
      currentBlockIdxRef.current = blockIdx;
      const block = blocks[blockIdx];
      // map block char offset to token offset (approx): if offset>0, find first token whose char start >= blockStart+offset
      const tokenRanges = isSession
        ? sessionBlockTokenRangesRef.current
        : blockTokenRangesRef.current;
      const tokenRange = tokenRanges.find(r => r.blockId === block.blockId);
      const tokens = isSession ? sessionTokensRef.current : tokensRef.current;
      const fromToken = tokenRange ? tokenRange.fromToken : 0;
      let startToken =
        startTokenOverride != null ? startTokenOverride : fromToken;
      if (offset > 0 && textMappingRef.current.cleanText) {
        // fallback: keep as fromToken
        if (startTokenOverride == null) startToken = fromToken;
      }
      const toToken = tokenRange ? tokenRange.toToken : tokens.length;

      // auto-skip empty token ranges
      if (startToken >= toToken) {
        setTimeout(() => speakBlock(blockIdx + 1, 0), 10);
        return;
      }

      // Build speech from tokens and map boundary words back to token indices
      const speechParts: string[] = [];
      const wordToToken: number[] = [];
      for (let ti = startToken; ti < toToken; ti++) {
        const tok = tokens[ti];
        if (!tok) continue;
        const cleaned = removeEmojis(tok.text);
        const { speech } = buildSpeechFromSegment(cleaned);
        const words = speech.split(/\s+/).filter(Boolean);
        if (words.length === 0) continue;
        speechParts.push(words.join(' '));
        for (let k = 0; k < words.length; k++) wordToToken.push(ti);
      }
      // auto-skip blocks that yield no speakable words
      if (speechParts.length === 0) {
        setTimeout(() => speakBlock(blockIdx + 1, 0), 10);
        return;
      }
      speechWordToTokenRef.current = wordToToken;
      tokenPointerRef.current = startToken - 1;
      speechWordCounterRef.current = 0;
      const textToSpeak = speechParts.join(' ');

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const voice = voices.find(v => v.voiceURI === selectedVoice);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || 'en-US';
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      let lastHighlightTime = 0;
      const HIGHLIGHT_DEBOUNCE = 10; // Reduced for better sync
      boundaryEnabledRef.current = true;

      utterance.onboundary = (
        event: SpeechSynthesisEvent & { name?: string; charLength?: number }
      ) => {
        if (!boundaryEnabledRef.current) return;
        // Type-safe boundary event handling
        const boundaryEvent = event as SpeechSynthesisEvent & { 
          name?: string; 
          charLength?: number; 
        };
        if (
          typeof boundaryEvent.name !== 'undefined' &&
          boundaryEvent.name !== 'word'
        )
          return;
        const now = Date.now();
        if (now - lastHighlightTime < HIGHLIGHT_DEBOUNCE) return;
        lastHighlightTime = now;
        // map word boundary to token index via counter
        speechWordCounterRef.current += 1;
        const nextWordIdx = speechWordCounterRef.current;
        const mapped = speechWordToTokenRef.current[nextWordIdx - 1];
        const tokenIdx =
          typeof mapped === 'number'
            ? mapped
            : Math.min(tokenPointerRef.current + 1, toToken - 1);
        // Validate token index bounds
        const validTokenIdx = Math.max(0, Math.min(tokenIdx, toToken - 1));
        tokenPointerRef.current = validTokenIdx;
        
        // Use requestAnimationFrame for smoother highlighting with error handling
        requestAnimationFrame(() => {
          try {
            highlightToken(validTokenIdx, block.blockId);
          } catch (error) {
            console.warn('Highlight error:', error);
          }
        });
      };

      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
        // ensure active block class set at start
        const el = blockElementsRef.current.get(block.blockId) || null;
        if (activeBlockElRef.current && activeBlockElRef.current !== el)
          activeBlockElRef.current.classList.remove('audio-sentence-active');
        if (el) {
          el.classList.add('audio-sentence-active');
          activeBlockElRef.current = el;
        }
        // also emphasize first token if any
        const firstTokIdx = speechWordToTokenRef.current[0] ?? startToken;
        highlightToken(firstTokIdx, block.blockId);
      };

      utterance.onend = () => {
        if (!isPaused) {
          setTimeout(() => speakBlock(blockIdx + 1, 0), 180); // small gap between blocks
        }
      };

      utterance.onerror = (event: any) => {
        toast.error(`Error: ${event.error}`, { duration: 2000 });
      };

      utteranceRef.current = utterance;
      setTimeout(() => {
        // small delay to avoid 'panic start' and let DOM/index settle
        window.speechSynthesis.speak(utterance);
      }, 120);
    },
    [
      voices,
      selectedVoice,
      rate,
      pitch,
      volume,
      fullText,
      highlightTextAtPosition,
      convertToDomPosition,
      buildBlocks,
      isPaused,
      removeCurrentHighlight,
    ]
  );

  const handleStart = useCallback(
    (startFromIndex: number = 0) => {
      window.speechSynthesis.cancel();
      removeCurrentHighlight();
      clearTokenAndBlockHighlights();
      buildIndex();
      // Tokenize or rehydrate existing tokens
      const hasTokens = !!document.querySelector('article span.tts-token');
      if (hasTokens) rehydrateTokensFromDom();
      else tokenizeArticle();
      const blocks = buildBlocks();
      sessionActiveRef.current = true;
      sessionTokensRef.current = [...tokensRef.current];
      sessionBlockTokenRangesRef.current = [...blockTokenRangesRef.current];
      sessionBlocksRef.current = [...blocks];
      // find starting block
      let startBlock = 0;
      let offset = 0;
      for (let i = 0; i < blocks.length; i++) {
        if (
          startFromIndex >= blocks[i].start &&
          startFromIndex < blocks[i].end
        ) {
          startBlock = i;
          offset = startFromIndex - blocks[i].start;
          break;
        }
      }
      // auto-skip to first block that has tokens to speak
      for (let i = startBlock; i < sessionBlocksRef.current.length; i++) {
        const b = sessionBlocksRef.current[i];
        const tr = sessionBlockTokenRangesRef.current.find(
          r => r.blockId === b.blockId
        );
        if (tr && tr.toToken > tr.fromToken) {
          startBlock = i;
          break;
        }
      }
      setTimeout(() => speakBlock(startBlock, offset), 80);
    },
    [buildIndex, buildBlocks, speakBlock, removeCurrentHighlight]
  );

  const applySettingsRealtime = useCallback(() => {
    if (isPlaying && currentCharIndex > 0) {
      const wasPaused = window.speechSynthesis.paused;
      window.speechSynthesis.cancel();
      setTimeout(() => {
        handleStart(currentCharIndex);
        if (wasPaused) {
          setTimeout(() => window.speechSynthesis.pause(), 50);
        }
      }, 100);
    }
  }, [isPlaying, currentCharIndex, handleStart]);

  useEffect(() => {
    const handleDoubleClick = (event: MouseEvent) => {
      // Preserve normal double-click selection unless Alt is held
      if (!event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('.audio-reader-bar')) return;
      const tokenEl = target.closest('.tts-token') as HTMLElement | null;
      if (!tokenEl) return;
      const tokenIdx = tokensRef.current.findIndex(t => t.el === tokenEl);
      if (tokenIdx === -1) return;
      const blockId = tokensRef.current[tokenIdx].blockId;
      const blocks = blocksRef.current.length
        ? blocksRef.current
        : buildBlocks();
      const blkIdx = blocks.findIndex(b => b.blockId === blockId);
      if (blkIdx === -1) return;
      window.speechSynthesis.cancel();
      toast.success('Reading from here', { duration: 1200 });
      setTimeout(() => speakBlock(blkIdx, 0, tokenIdx), 120);
    };

    const article = document.querySelector('article');
    if (article) article.addEventListener('dblclick', handleDoubleClick);
    return () => {
      if (article) article.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [fullText, handleStart, speakBlock, buildBlocks]);

  // Utility function to manage audio state classes
  const setAudioState = useCallback(
    (state: 'playing' | 'paused' | 'stopped') => {
      document.body.classList.remove('audio-paused');
      if (state === 'paused') {
        document.body.classList.add('audio-paused');
      }
    },
    []
  );

  const handlePause = useCallback(() => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      boundaryEnabledRef.current = false;
      window.speechSynthesis.pause();
      setIsPaused(true);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setAudioState('paused');
      // Keep highlights visible when paused - don't clear overlays
      toast.info('Audio paused', { duration: 1500 });
    }
  }, [setAudioState]);

  const handleResume = useCallback(() => {
    if (window.speechSynthesis.paused) {
      boundaryEnabledRef.current = true;
      window.speechSynthesis.resume();
      setIsPaused(false);
      setAudioState('playing');
      // Overlays will be shown automatically by the useEffect that watches isPlaying
      toast.info('Audio resumed', { duration: 1500 });
    }
  }, [setAudioState]);

  // Duplicate applySettingsRealtime removed - using the version above

  useEffect(() => {
    const handleDoubleClick = (event: MouseEvent) => {
      // Preserve normal double-click selection unless Alt is held
      if (!event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('.audio-reader-bar')) return;
      const tokenEl = target.closest('.tts-token') as HTMLElement | null;
      if (!tokenEl) return;
      const tokenIdx = tokensRef.current.findIndex(t => t.el === tokenEl);
      if (tokenIdx === -1) return;
      const blockId = tokensRef.current[tokenIdx].blockId;
      const blocks = blocksRef.current.length
        ? blocksRef.current
        : buildBlocks();
      const blkIdx = blocks.findIndex(b => b.blockId === blockId);
      if (blkIdx === -1) return;
      window.speechSynthesis.cancel();
      toast.success('Reading from here', { duration: 1200 });
      setTimeout(() => speakBlock(blkIdx, 0, tokenIdx), 120);
    };

    const article = document.querySelector('article');
    if (article) article.addEventListener('dblclick', handleDoubleClick);
    return () => {
      if (article) article.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [fullText, handleStart, speakBlock, buildBlocks]);

  // Duplicate functions removed - using the cleaner versions above

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    removeCurrentHighlight();
    clearTokenAndBlockHighlights();
    setIsPlaying(false);
    setIsPaused(false);
    setAudioState('stopped');
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    sessionActiveRef.current = false;
    sessionTokensRef.current = [];
    sessionBlockTokenRangesRef.current = [];
    sessionBlocksRef.current = [];
    if (sentenceOverlayRef.current)
      sentenceOverlayRef.current.style.display = 'none';
    if (wordOverlayRef.current) wordOverlayRef.current.style.display = 'none';
    toast.info('Audio stopped', { duration: 1500 });
  }, [removeCurrentHighlight, clearTokenAndBlockHighlights, setAudioState]);

  const handleRestart = useCallback(() => {
    handleStop();
    // Ensure clean restart with proper state reset
    setTimeout(() => {
      setIsPaused(false);
      handleStart();
    }, 100);
  }, [handleStop, handleStart]);

  // Listen for header control events - placed after all handler functions are defined
  useEffect(() => {
    const handleTogglePlay = () => {
      if (!isPlaying) {
        handleStart();
      } else if (isPaused) {
        handleResume();
      } else {
        handlePause();
      }
    };

    // Simplified event handlers - no need for wrapper functions
    const handleStopEvent = handleStop;
    const handleRestartEvent = handleRestart;

    const handleToggleVolume = () => {
      setShowVolumePopup(v => !v);
    };

    const handleToggleSettings = () => {
      setShowControlPanel(v => !v);
    };

    // Dispatch state updates to header
    const updateHeaderState = () => {
      window.dispatchEvent(
        new CustomEvent('arh:state', {
          detail: { playing: isPlaying, paused: isPaused },
        })
      );
    };

    window.addEventListener('arh:toggle-play', handleTogglePlay);
    window.addEventListener('arh:stop', handleStopEvent);
    window.addEventListener('arh:restart', handleRestartEvent);
    window.addEventListener('arh:toggle-volume', handleToggleVolume);
    window.addEventListener('arh:toggle-settings', handleToggleSettings);

    // Update header state whenever playing/paused state changes
    updateHeaderState();

    return () => {
      window.removeEventListener('arh:toggle-play', handleTogglePlay);
      window.removeEventListener('arh:stop', handleStopEvent);
      window.removeEventListener('arh:restart', handleRestartEvent);
      window.removeEventListener('arh:toggle-volume', handleToggleVolume);
      window.removeEventListener('arh:toggle-settings', handleToggleSettings);
    };
  }, [
    isPlaying,
    isPaused,
    handleStart,
    handleResume,
    handlePause,
    handleStop,
    handleRestart,
  ]);

  const getVolumeIcon = () => {
    if (volume === 0) return VolumeX;
    if (volume < 0.5) return Volume1;
    return Volume2;
  };

  const VolumeIcon = getVolumeIcon();

  // CSS styles are now in globals.css - component only manages classes/IDs

  return (
    <>
      {/* Volume popup */}
      <AnimatePresence>
        {showVolumePopup && (
          <motion.div
            ref={volumePopupRef}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="volume-popup"
          >
            <div className="slider-group">
              <label>Volume</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={e => {
                  setVolume(parseFloat(e.target.value));
                  applySettingsRealtime();
                }}
              />
              <span className="value">{Math.round(volume * 100)}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Professional Control Panel */}
      <AnimatePresence>
        {showControlPanel && (
          <motion.div
            className="control-panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowControlPanel(false)}
          >
            <motion.div
              className="control-panel"
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="control-panel-header">
                <h3>Audio Controls</h3>
                <button
                  className="close-btn"
                  onClick={() => setShowControlPanel(false)}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="control-panel-body">
                <div className="control-section">
                  <h4>Playback Settings</h4>
                  <div className="control-grid">
                    <div className="control-item">
                      <label>Speed</label>
                      <div className="slider-container">
                        <input
                          type="range"
                          min={0.5}
                          max={2}
                          step={0.1}
                          value={rate}
                          onChange={e => {
                            setRate(parseFloat(e.target.value));
                            applySettingsRealtime();
                          }}
                        />
                        <span className="value">{rate.toFixed(1)}x</span>
                      </div>
                    </div>

                    <div className="control-item">
                      <label>Pitch</label>
                      <div className="slider-container">
                        <input
                          type="range"
                          min={0.5}
                          max={2}
                          step={0.1}
                          value={pitch}
                          onChange={e => {
                            setPitch(parseFloat(e.target.value));
                            applySettingsRealtime();
                          }}
                        />
                        <span className="value">{pitch.toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="control-item">
                      <label>Volume</label>
                      <div className="slider-container">
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={volume}
                          onChange={e => {
                            setVolume(parseFloat(e.target.value));
                            applySettingsRealtime();
                          }}
                        />
                        <span className="value">
                          {Math.round(volume * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="control-section">
                  <h4>Voice Selection</h4>
                  <div className="voice-selector">
                    <select
                      value={selectedVoice}
                      onChange={e => {
                        setSelectedVoice(e.target.value);
                        applySettingsRealtime();
                      }}
                    >
                      {voices.map(v => (
                        <option
                          key={v.voiceURI}
                          value={v.voiceURI}
                        >{`${v.name} (${v.lang})`}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="control-section">
                  <h4>Reading Options</h4>
                  <div className="toggle-container">
                    <button
                      className={`professional-toggle ${autoScroll ? 'active' : ''}`}
                      onClick={() => setAutoScroll(v => !v)}
                    >
                      <MousePointer2 size={18} />
                      <span>Auto Scroll</span>
                      <div className="toggle-indicator"></div>
                    </button>
                  </div>
                </div>

                <div className="control-section">
                  <div className="help-text">
                    <p>
                      💡 <strong>Tip:</strong> Double-click any word in the
                      content to start reading from there.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
