import { useEffect, useRef } from "react";

export function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const el = ref.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  return (
    <div
      ref={ref}
      className="hidden lg:block pointer-events-none fixed z-50"
      style={{
        transform: "translate(-50%, -50%)",
        mixBlendMode: "exclusion",
        left: -100,
        top: -100,
      }}
      aria-hidden
    >
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="22.75" fill="none" stroke="#fff" strokeWidth="2.5" />
        <path
          d="M24 12 L24 36 M16 20 L32 20 M18 28 L30 28"
          stroke="#fff"
          strokeWidth="2"
          fill="none"
        />
      </svg>
    </div>
  );
}
