// Vite replaces import.meta.env.DEV with a literal false in production builds,
// which lets the minifier dead-code-eliminate every `if (DEBUG)` branch (and
// anything only reachable from one) out of the shipped bundle.
export const DEBUG = import.meta.env.DEV;
