'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { getReader } from '@/lib/reader/engine';

/** A region the reader can speak. Click any word in it to read from there. */
export default function Readable({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => getReader().register(id, ref.current!, label), [id, label]);

  function onClick(e: React.MouseEvent) {
    if ((e.target as Element).closest('a,button,input,select,textarea,[data-tts-skip]')) return;
    if (!window.getSelection()?.isCollapsed) return; // the reader is selecting text
    const point = caretAt(e.clientX, e.clientY);
    if (!point) return;
    const reader = getReader();
    const offset = reader.offsetAt(id, point.node, point.offset);
    if (offset != null) reader.play(id, offset);
  }

  return (
    <div ref={ref} className={className} onClick={onClick} data-readable={id}>
      {children}
    </div>
  );
}

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    return p && p.offsetNode.nodeType === Node.TEXT_NODE ? { node: p.offsetNode, offset: p.offset } : null;
  }
  const r = document.caretRangeFromPoint?.(x, y);
  return r && r.startContainer.nodeType === Node.TEXT_NODE ? { node: r.startContainer, offset: r.startOffset } : null;
}
