import { useEffect, useMemo, useRef } from "react";

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
      row[b] = placed++;
    }
    rows.push(...row);
    r++;
  }
  return rows;
}

function useCols() {
  const ref = useRef(4);
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      ref.current = w < 640 ? 2 : w < 1024 ? 3 : 4;
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return ref;
}

export function ScatteredGrid({
  items,
  render,
}: {
  items: number;
  render: (index: number) => React.ReactNode;
}) {
  const colsRef = useCols();
  const [cols, setCols] = useMemoState(4);

  useEffect(() => {
    const upd = () => setCols(window.innerWidth < 640 ? 2 : window.innerWidth < 1024 ? 3 : 4);
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, [setCols]);

  const layout = useMemo(() => buildLayout(items, cols), [items, cols]);
  colsRef.current = cols;

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const vh = window.innerHeight;
      const cards = containerRef.current?.querySelectorAll<HTMLElement>(".bp-card") ?? [];
      cards.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const top = rect.top;
        const bottom = rect.bottom;
        let scale = 0;
        if (bottom > 0 && top < vh) {
          const enter = Math.min(1, (vh - top) / (vh * 0.6));
          const exit = Math.min(1, bottom / (vh * 0.4));
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
    <div ref={containerRef} className="w-full grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
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

function useMemoState<T>(initial: T): [T, (v: T) => void] {
  const ref = useRef(initial);
  const forceRef = useRef<(n: number) => void>(() => {});
  const [, setN] = useReactState(0);
  forceRef.current = setN;
  const set = (v: T) => {
    if (ref.current !== v) {
      ref.current = v;
      forceRef.current(Math.random());
    }
  };
  return [ref.current, set];
}

import { useState as useReactState } from "react";
