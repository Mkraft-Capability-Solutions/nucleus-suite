/**
 * Inline <head> script (root layout): marks <html data-lp-motion> before first paint when the visitor allows motion,
 * so the landing page's entrance states (hidden until the motion engine animates them in) never flash. Without
 * JavaScript, or under prefers-reduced-motion, the attribute is absent and every element renders in its final place.
 */
export const MOTION_FLAG_SCRIPT = `(function(){try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.setAttribute("data-lp-motion","")}catch(e){}})()`;
