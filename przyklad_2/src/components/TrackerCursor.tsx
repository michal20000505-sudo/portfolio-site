import { useEffect, useRef } from "react";

export function TrackerCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let frame = 0;
    let x = -100;
    let y = -100;

    const draw = () => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
      frame = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(draw);
      cursorRef.current?.classList.add("is-visible");
    };

    const onPointerOver = (event: PointerEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-cursor]",
      );
      const label = target?.dataset.cursor ?? "";
      if (labelRef.current) labelRef.current.textContent = label;
      cursorRef.current?.classList.toggle("has-label", Boolean(label));
    };

    const onPointerLeave = () =>
      cursorRef.current?.classList.remove("is-visible");

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.documentElement.addEventListener("mouseleave", onPointerLeave);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerover", onPointerOver);
      document.documentElement.removeEventListener("mouseleave", onPointerLeave);
    };
  }, []);

  return (
    <div ref={cursorRef} className="tracker-cursor" aria-hidden="true">
      <i />
      <span ref={labelRef} />
    </div>
  );
}
