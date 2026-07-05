import { useEffect, useRef, useState } from "react";

const LEFT_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_39ca84eAE1ODL9hbR5VhoEj8tBf/hf_20260625_154433_532a85d3-dabf-4265-b8bd-19ac6af31842.mp4";
const RIGHT_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_39ca84eAE1ODL9hbR5VhoEj8tBf/hf_20260625_154401_a664f076-b971-4557-8728-40ef9ea4c49b.mp4";

export function HeroVideos() {
  const leftRef = useRef<HTMLVideoElement>(null);
  const rightRef = useRef<HTMLVideoElement>(null);
  const activeSide = useRef<"left" | "right">("right");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const l = leftRef.current;
    const r = rightRef.current;
    if (!l || !r) return;
    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded >= 2) setReady(true);
    };
    l.addEventListener("loadeddata", onLoad);
    r.addEventListener("loadeddata", onLoad);

    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (isTouch || reduced) {
      // auto-alternating playback
      l.style.display = "none";
      r.style.display = "block";
      const playRight = () => {
        r.currentTime = 0;
        r.play().catch(() => {});
      };
      const playLeft = () => {
        l.currentTime = 0;
        l.play().catch(() => {});
      };
      r.addEventListener("ended", () => {
        r.style.display = "none";
        l.style.display = "block";
        playLeft();
      });
      l.addEventListener("ended", () => {
        l.style.display = "none";
        r.style.display = "block";
        playRight();
      });
      playRight();
      return () => {
        l.removeEventListener("loadeddata", onLoad);
        r.removeEventListener("loadeddata", onLoad);
      };
    }

    // Desktop: cursor scrubbing
    let mouseX = window.innerWidth / 2;
    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
    };
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    const tick = () => {
      const width = window.innerWidth;
      const center = width / 2;
      const dz = Math.max(30, width * 0.05);
      const dx = mouseX - center;

      if (Math.abs(dx) < dz) {
        // dead zone
        const v = activeSide.current === "left" ? l : r;
        if (!v.seeking) v.currentTime = 0;
      } else if (dx < 0) {
        // left of center -> show RIGHT video
        if (activeSide.current !== "right") {
          activeSide.current = "right";
          l.style.display = "none";
          r.style.display = "block";
        }
        const range = center - dz;
        const progress = Math.min(1, Math.max(0, (-dx - dz) / range));
        if (!r.seeking && r.duration) r.currentTime = progress * r.duration;
      } else {
        // right of center -> LEFT video
        if (activeSide.current !== "left") {
          activeSide.current = "left";
          r.style.display = "none";
          l.style.display = "block";
        }
        const range = width - center - dz;
        const progress = Math.min(1, Math.max(0, (dx - dz) / range));
        if (!l.seeking && l.duration) l.currentTime = progress * l.duration;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      l.removeEventListener("loadeddata", onLoad);
      r.removeEventListener("loadeddata", onLoad);
    };
  }, []);

  return (
    <div
      id="main-canvas"
      className="pointer-events-none fixed inset-0 lg:inset-0 z-0 overflow-hidden"
      style={{
        opacity: ready ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    >
      <video
        ref={leftRef}
        src={LEFT_VIDEO}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: "none" }}
      />
      <video
        ref={rightRef}
        src={RIGHT_VIDEO}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: "block" }}
      />
    </div>
  );
}
