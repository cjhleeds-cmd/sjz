"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const SHOW_THRESHOLD = 600;
const HIDE_THRESHOLD = 200;

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [shiftUp, setShiftUp] = useState(false);
  const tickingRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const checkScroll = useCallback(() => {
    if (tickingRef.current) return;
    tickingRef.current = true;
    requestAnimationFrame(() => {
      const scrollY = window.scrollY;
      if (scrollY > SHOW_THRESHOLD) {
        setVisible(true);
      } else if (scrollY < HIDE_THRESHOLD) {
        setVisible(false);
      }

      // Check overlap with sticky timeline dots
      if (btnRef.current && visible) {
        const btnRect = btnRef.current.getBoundingClientRect();
        const dots = document.querySelectorAll<HTMLElement>(".axis-column > span");
        let overlap = false;
        for (const dot of dots) {
          const dotRect = dot.getBoundingClientRect();
          if (
            btnRect.left < dotRect.right &&
            btnRect.right > dotRect.left &&
            btnRect.top < dotRect.bottom &&
            btnRect.bottom > dotRect.top
          ) {
            overlap = true;
            break;
          }
        }
        setShiftUp(overlap);
      }

      tickingRef.current = false;
    });
  }, [visible]);

  useEffect(() => {
    window.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll, { passive: true });
    checkScroll();
    return () => {
      window.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <button
      ref={btnRef}
      type="button"
      className={`back-to-top ${visible ? "is-visible" : ""} ${shiftUp ? "is-shifted" : ""}`}
      onClick={scrollToTop}
      aria-label="返回顶部"
      tabIndex={visible ? 0 : -1}
    >
      <span className="back-to-top-icon" aria-hidden="true">🔝</span>
    </button>
  );
}
