// CSS Custom Highlight API (not in TypeScript 5.3's DOM lib).
declare class Highlight {
  constructor(...ranges: AbstractRange[]);
}

interface HighlightRegistry {
  set(name: string, highlight: Highlight): this;
  delete(name: string): boolean;
}

declare namespace CSS {
  const highlights: HighlightRegistry;
}
