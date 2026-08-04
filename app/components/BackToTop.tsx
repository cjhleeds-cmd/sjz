"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const SHOW_THRESHOLD = 600;
const HIDE_THRESHOLD = 200;

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const tickingRef = useRef(false);

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
      tickingRef.current = false;
    });
  }, []);

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
      type="button"
      className={`back-to-top ${visible ? "is-visible" : ""}`}
      onClick={scrollToTop}
      aria-label="返回顶部"
      tabIndex={visible ? 0 : -1}
    >
      <span className="back-to-top-icon" aria-hidden="true">🔝</span>
    </button>
  );
}
