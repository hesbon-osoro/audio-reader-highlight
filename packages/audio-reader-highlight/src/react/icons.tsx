import type { SVGProps } from 'react';

/** The few icons the player needs, so the package carries no icon library. */
const Icon = ({
  size = 18,
  children,
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    focusable={false}
    {...rest}
  >
    {children}
  </svg>
);

type P = { size?: number };

export const PlayIcon = (p: P) => (
  <Icon {...p} fill="currentColor">
    <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" />
  </Icon>
);
export const PauseIcon = (p: P) => (
  <Icon {...p} fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </Icon>
);
export const StopIcon = (p: P) => (
  <Icon {...p} fill="currentColor">
    <rect x="5" y="5" width="14" height="14" rx="2" />
  </Icon>
);
export const BackIcon = (p: P) => (
  <Icon {...p}>
    <path d="M19 20 9 12l10-8v16Z" fill="currentColor" />
    <path d="M5 19V5" />
  </Icon>
);
export const ForwardIcon = (p: P) => (
  <Icon {...p}>
    <path d="m5 4 10 8-10 8V4Z" fill="currentColor" />
    <path d="M19 5v14" />
  </Icon>
);
export const SlidersIcon = (p: P) => (
  <Icon {...p}>
    <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
  </Icon>
);
export const CheckIcon = (p: P) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
