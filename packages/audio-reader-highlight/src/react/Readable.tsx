'use client';

import {
  useEffect,
  useRef,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { getReader } from 'audio-reader-highlight';

/** A region the reader can speak. Click or tap any word in it to read from there. */
export default function Readable({
  id,
  label = '',
  as: Tag = 'div',
  clickToRead = true,
  children,
  ...rest
}: {
  /** The region's id for the reader (not the element's DOM id). */
  id: string;
  label?: string;
  as?: ElementType;
  clickToRead?: boolean;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'id'>) {
  const ref = useRef<HTMLElement>(null);

  useEffect(
    () => getReader().register(id, ref.current!, { label, clickToRead }),
    [id, label, clickToRead]
  );

  return (
    <Tag {...rest} ref={ref} data-readable={id}>
      {children}
    </Tag>
  );
}
