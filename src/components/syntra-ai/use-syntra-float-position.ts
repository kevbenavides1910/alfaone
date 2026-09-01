"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const POS_KEY = "syntra_ai_float_pos";
const DEFAULT_MARGIN = 20;

type Point = { left: number; top: number };

function clampPoint(p: Point, w: number, h: number): Point {
  if (typeof window === "undefined") return p;
  const maxLeft = Math.max(0, window.innerWidth - w);
  const maxTop = Math.max(0, window.innerHeight - h);
  return {
    left: Math.min(Math.max(0, p.left), maxLeft),
    top: Math.min(Math.max(0, p.top), maxTop),
  };
}

function defaultPoint(w: number, h: number): Point {
  if (typeof window === "undefined") return { left: DEFAULT_MARGIN, top: DEFAULT_MARGIN };
  return clampPoint(
    { left: window.innerWidth - w - DEFAULT_MARGIN, top: window.innerHeight - h - DEFAULT_MARGIN },
    w,
    h,
  );
}

function loadPoint(mode: "fab" | "panel", w: number, h: number): Point {
  if (typeof window === "undefined") return defaultPoint(w, h);
  try {
    const raw = sessionStorage.getItem(`${POS_KEY}_${mode}`);
    if (raw) return clampPoint(JSON.parse(raw) as Point, w, h);
  } catch {
    /* ignore */
  }
  return defaultPoint(w, h);
}

export function useSyntraFloatPosition(mode: "fab" | "panel", width: number, height: number) {
  const [pos, setPos] = useState<Point>({ left: 0, top: 0 });
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origLeft: number; origTop: number } | null>(
    null,
  );

  useEffect(() => {
    setPos(loadPoint(mode, width, height));
    setReady(true);
  }, [mode, width, height]);

  useEffect(() => {
    const onResize = () => setPos((p) => clampPoint(p, width, height));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [width, height]);

  const savePos = useCallback(
    (p: Point) => {
      try {
        sessionStorage.setItem(`${POS_KEY}_${mode}`, JSON.stringify(p));
      } catch {
        /* ignore */
      }
    },
    [mode],
  );

  const onPointerDown = useCallback(
    (ev: React.PointerEvent) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.currentTarget.setPointerCapture(ev.pointerId);
      dragRef.current = { startX: ev.clientX, startY: ev.clientY, origLeft: pos.left, origTop: pos.top };
      setDragging(true);
    },
    [pos.left, pos.top],
  );

  const onPointerMove = useCallback(
    (ev: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPos(
        clampPoint(
          { left: dragRef.current.origLeft + dx, top: dragRef.current.origTop + dy },
          width,
          height,
        ),
      );
    },
    [width, height],
  );

  const onPointerUp = useCallback(
    (ev: React.PointerEvent) => {
      if (!dragRef.current) return;
      const moved =
        Math.abs(ev.clientX - dragRef.current.startX) + Math.abs(ev.clientY - dragRef.current.startY);
      dragRef.current = null;
      setDragging(false);
      setPos((p) => {
        savePos(p);
        return p;
      });
      try {
        ev.currentTarget.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      return moved;
    },
    [savePos],
  );

  return { pos, ready, dragging, onPointerDown, onPointerMove, onPointerUp };
}
