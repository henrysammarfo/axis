import { useState } from "react";
import { resolveAvatarSrc } from "../../lib/profile";

const TONES: Record<string, string> = {
  "axis-01": "#c8ff00",
  "axis-02": "#7dffb3",
  "axis-03": "#ffffff",
  "axis-04": "#9ae6ff",
  "axis-05": "#ffd4a8",
  "axis-06": "#eaff8a",
};

function Mark({ tone, className }: { tone: string; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" fill="#111" />
      <circle cx="32" cy="32" r="22" fill="none" stroke={tone} strokeWidth="3" />
      <path d="M22 42 L32 18 L42 42 H36 L32 32 L28 42 Z" fill={tone} />
    </svg>
  );
}

export function AxisAvatar({
  avatar,
  alt,
  className,
}: {
  avatar?: string;
  alt: string;
  className?: string;
}) {
  const src = resolveAvatarSrc(avatar);
  const custom = src.startsWith("data:") || src.startsWith("http");
  const [broken, setBroken] = useState(false);
  const tone = TONES[avatar ?? ""] || TONES["axis-01"];

  if (custom && !broken) {
    return (
      <img src={src} alt={alt} className={className} onError={() => setBroken(true)} />
    );
  }

  return <Mark tone={tone} className={className} />;
}
