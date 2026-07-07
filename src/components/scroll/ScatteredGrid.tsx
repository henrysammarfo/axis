import { useEffect, useMemo, useRef, useState } from "react";

function buildLayout(count: number, cols: number): number[] {
  const rows: number[] = [];
  let placed = 0;
  let r = 0;
  while (placed < count) {
    const a = (r * 2 + (r % 2)) % cols;
    const row = Array<number>(cols).fill(-1);
    row[a] = placed++;
    if (placed < count && r % 3 === 0) {
      let b = (a + 2) % cols;
      if (b === a) b = (a + 1) % cols;
      if (row[b] === -1) row[b] = placed++;
    }
    rows.push(...row);
    r++;
  }
  return rows;
}

function getCols() {
  if (typeof window === "undefined") return 4;
  const w = window.innerWidth;
  return w < 640 ? 2 : w < 1024 ? 3 : 4;
}

export function ScatteredGrid({
  items,
  render,
}: {
  items: number;
  render: (index: number) => React.ReactNode;
}) {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const upd = () => setCols(getCols());
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  const layout = useMemo(() => buildLayout(items, cols), [items, cols]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const cards = containerRef.current?.querySelectorAll<HTMLElement>(".bp-card") ?? [];
      cards.forEach((el) => {
        el.style.transform = "scale(1)";
      });
      return;
    }
    let raf = 0;
    const tick = () => {
      const vh = window.innerHeight;
      const cards = containerRef.current?.querySelectorAll<HTMLElement>(".bp-card") ?? [];
      cards.forEach((el) => {
        const rect = el.getBoundingClientRect();
        let scale = 0;
        if (rect.bottom > 0 && rect.top < vh) {
          const enter = Math.min(1, (vh - rect.top) / (vh * 0.6));
          const exit = Math.min(1, rect.bottom / (vh * 0.4));
          scale = Math.max(0, Math.min(enter, exit));
        }
        el.style.transform = `scale(${scale})`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full grid"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {layout.map((idx, i) => {
        const col = i % cols;
        const origin = col < cols / 2 ? "right bottom" : "left bottom";
        if (idx === -1) return <div key={i} style={{ aspectRatio: "2/3" }} />;
        return (
          <div
            key={i}
            className="bp-card"
            style={{ aspectRatio: "2/3", transformOrigin: origin, transform: "scale(0)" }}
          >
            {render(idx)}
          </div>
        );
      })}
    </div>
  );
}
