import type { SVGProps } from 'react';

// Line icons on a 24px grid, 1.6 stroke, round joins — tuned to sit next to SF/Inter text.
// All accept className (color via currentColor) so they inherit text-* token utilities.

type IconProps = { className?: string } & SVGProps<SVGSVGElement>;

function Svg({ className, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const FilesIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Svg>
);

export const FolderIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Svg>
);

export const FolderOpenIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V10H3z" />
    <path d="M3 10h17.5a1 1 0 0 1 .96 1.27l-1.4 5A2 2 0 0 1 18.13 18H5.5a2 2 0 0 1-1.94-1.52L3 10z" />
  </Svg>
);

export const FileIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Svg>
);

export const FileTextIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Svg>
);

export const GitBranchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <circle cx="18" cy="8" r="2.4" />
    <path d="M6 8.4v7.2M18 10.4c0 4.2-3.4 4.6-6 5.2" />
  </Svg>
);

export const GitCommitIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M3 12h5.8M15.2 12H21" />
  </Svg>
);

export const TerminalIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M7 9l3 3-3 3M13 15h4" />
  </Svg>
);

// Anthropic-style radial sunburst — DevLab's Claude mark (deliberately NOT the 4-point
// Gemini diamond). Rays of two lengths burst from the centre.
export const ClaudeIcon = ({ className, ...rest }: IconProps) => {
  const cx = 12;
  const cy = 12;
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6 - Math.PI / 2;
    const inner = 2.4;
    const outer = i % 2 === 0 ? 9 : 6.4;
    return {
      x1: +(cx + inner * Math.cos(a)).toFixed(2),
      y1: +(cy + inner * Math.sin(a)).toFixed(2),
      x2: +(cx + outer * Math.cos(a)).toFixed(2),
      y2: +(cy + outer * Math.sin(a)).toFixed(2),
    };
  });
  return (
    <Svg className={className} strokeWidth={1.7} {...rest}>
      {rays.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
      ))}
    </Svg>
  );
};

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const ChevronUpDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
  </Svg>
);

export const XIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4-4" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Svg>
);

export const PlayIcon = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z" />
  </Svg>
);

export const RocketIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 15c-1.5 1.2-2 4.5-2 4.5s3.3-.5 4.5-2c.7-.9.6-2.2-.2-3-.8-.8-2.1-.8-3 .5z" />
    <path d="M9 15l-3-3c1-5 4-8 9-9 0 5-2 9-6 12z" />
    <circle cx="14.5" cy="9.5" r="1.4" />
  </Svg>
);

export const SitemapIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <rect x="3" y="16" width="6" height="4" rx="1" />
    <rect x="15" y="16" width="6" height="4" rx="1" />
    <path d="M12 7v4M6 16v-2.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1V16" />
  </Svg>
);

export const CodeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />
  </Svg>
);

export const RefreshIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9a8 8 0 0 1 13.5-3L20 8M20 5v3h-3" />
    <path d="M20 15a8 8 0 0 1-13.5 3L4 16M4 19v-3h3" />
  </Svg>
);

export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" />
  </Svg>
);

export const SunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4" />
  </Svg>
);

export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z" />
  </Svg>
);

export const DotIcon = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <circle cx="12" cy="12" r="4" />
  </Svg>
);

export const SendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </Svg>
);

export const LightbulbIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.9 1 1 1.7l.1.5h5l.1-.5c.1-.7.5-1.3 1-1.7A6 6 0 0 0 12 3z" />
  </Svg>
);

export const HelpIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 1.8-2 3" />
    <path d="M12 17h.01" />
  </Svg>
);

export const SplitIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M12 4v16" />
  </Svg>
);

export const CopyIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </Svg>
);

// A commit graph: a lane with nodes and a branch — the Git/Worktree tool.
export const GitGraphIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="2.2" />
    <circle cx="6" cy="18" r="2.2" />
    <circle cx="17" cy="12" r="2.2" />
    <path d="M6 8.2v7.6M6 12h2.5a3 3 0 0 1 3 3 M14.8 12H8.5" />
  </Svg>
);

// Git compare / diff — two nodes with directional arrows.
export const DiffIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="2.2" />
    <circle cx="18" cy="18" r="2.2" />
    <path d="M6 8.2V14a3 3 0 0 0 3 3h6M14 14l3 3-3 3M18 15.8V10a3 3 0 0 0-3-3H9M10 10 7 7l3-3" />
  </Svg>
);

// ── studiq-specific icons ─────────────────────────────────────────────────────

/** Fuse tab / ingestion vortex — a radial "black hole" ring. */
export const VortexIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
);

/** Note tab — pencil writing on a line. */
export const NoteIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h16" />
    <path d="M14.5 5.5l4 4L9 19l-4.5 1L5.5 15.5z" />
    <path d="M13 7l4 4" />
  </Svg>
);

export const PenIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 5.5l4 4L8 20l-4.5 1L4.5 16.5z" />
    <path d="M12.5 7.5l4 4" />
  </Svg>
);

export const HighlighterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 5l4 4-7.5 7.5H8l-2 2H4l2.5-4.5z" />
    <path d="M4 21h6" />
  </Svg>
);

export const EraserIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 18.5 4 15a1.5 1.5 0 0 1 0-2.1l7-7a1.5 1.5 0 0 1 2.1 0l5 5a1.5 1.5 0 0 1 0 2.1L14 18.5z" />
    <path d="M9 20h11M8.5 10.5l5 5" />
  </Svg>
);

export const UndoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 7 5 11l4 4" />
    <path d="M5 11h9a5 5 0 0 1 0 10h-3" />
  </Svg>
);

export const RedoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 7l4 4-4 4" />
    <path d="M19 11h-9a5 5 0 0 0 0 10h3" />
  </Svg>
);

export const UploadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Svg>
);

export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M4 10h16M4 15h16M10 4v16M15 4v16" />
  </Svg>
);

/** Ruled page background. */
export const RuledIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M7 9h10M7 12h10M7 15h7" />
  </Svg>
);

/** Blank page background. */
export const BlankIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5l3.5 2" />
  </Svg>
);

export const LayersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 3 8l9 5 9-5z" />
    <path d="M3 12l9 5 9-5M3 16l9 5 9-5" />
  </Svg>
);

export const BookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5A1.5 1.5 0 0 1 20 20.5z" />
  </Svg>
);

export const CardsIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="7" width="13" height="13" rx="2" />
    <path d="M8 4h9a2 2 0 0 1 2 2v9" />
  </Svg>
);

export const TargetIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const ShuffleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h4l8 10h4M4 17h4l2-2.5M14 9l2-2h4M17 4l3 3-3 3M17 14l3 3-3 3" />
  </Svg>
);

export const ChatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 4V7a2 2 0 0 1 2-2z" />
  </Svg>
);

/** Horizontal swap (⇄) — the Note perspective toggle (Modul ⇄ Session). */
export const SwapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 8h11M15 5l3 3-3 3" />
    <path d="M17 16H6M9 13l-3 3 3 3" />
  </Svg>
);

/** Generic sparkle — used for the "Add manually / classify" affordance. */
export const SparkleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" />
    <path d="M18 15l.7 1.8L20.5 17.5l-1.8.7L18 20l-.7-1.8L15.5 17.5l1.8-.7z" />
  </Svg>
);
