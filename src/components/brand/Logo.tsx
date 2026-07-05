type Props = { className?: string; width?: number | string };

// AXIS wordmark + circled R — merch-ready, single fill, no gradients.
export function Logo({ className, width }: Props) {
  return (
    <svg
      viewBox="0 0 355 110"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={width ? { width } : undefined}
      aria-label="AXIS"
    >
      <g fill="currentColor">
        {/* A */}
        <path d="M8 100 L38 8 H62 L92 100 H72 L66 80 H34 L28 100 Z M40 62 H60 L50 30 Z" />
        {/* X */}
        <path d="M100 8 H122 L140 40 L158 8 H180 L150 54 L182 100 H160 L140 68 L120 100 H98 L130 54 Z" />
        {/* I */}
        <path d="M190 8 H212 V100 H190 Z" />
        {/* S */}
        <path d="M226 72 H246 C246 82 254 86 264 86 C272 86 278 82 278 76 C278 68 272 66 258 62 C238 56 228 50 228 34 C228 18 240 6 262 6 C284 6 296 18 296 34 H276 C276 26 270 22 262 22 C254 22 248 26 248 32 C248 40 254 42 268 46 C288 52 298 60 298 76 C298 92 286 102 264 102 C240 102 226 90 226 72 Z" />
        {/* Circled R */}
        <circle cx="326" cy="26" r="18" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M319 16 H328 C333 16 336 19 336 23 C336 26 334 28 331 29 L337 36 H333 L328 30 H322 V36 H319 Z M322 19 V27 H328 C330 27 332 26 332 23 C332 21 330 19 328 19 Z" />
      </g>
    </svg>
  );
}
