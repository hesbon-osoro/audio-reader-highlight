'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Copies a code snippet. Analytics come from the `data-track*` attributes passed in. */
export default function CopyButton({
  text,
  label,
  ...data
}: {
  text: string;
  label: string;
} & Record<`data-${string}`, string>) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      className="copy-btn"
      aria-label={copied ? 'Copied' : `Copy ${label}`}
      title={copied ? 'Copied' : 'Copy'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          // Clipboard blocked (insecure context or permissions): leave the code selectable.
        }
      }}
      {...data}
    >
      {copied ? (
        <Check size={15} aria-hidden />
      ) : (
        <Copy size={15} aria-hidden />
      )}
    </button>
  );
}
