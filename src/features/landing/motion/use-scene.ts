'use client';

/**
 * useScene: bind a section element to the shared motion engine (scroll-engine.ts). The latest update callback is
 * always used without re-registering, so callers can close over props and state freely.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { registerScene, type RegisterOptions, type SceneUpdate } from './scroll-engine';

export function useScene<T extends HTMLElement>(ref: RefObject<T | null>, update: SceneUpdate, options: RegisterOptions = {}): void {
  const updateRef = useRef(update);
  const measureRef = useRef(options.onMeasure);

  useEffect(() => {
    updateRef.current = update;
    measureRef.current = options.onMeasure;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    return registerScene(element, (frame, box) => updateRef.current(frame, box), { onMeasure: () => measureRef.current?.() });
  }, [ref]);
}
