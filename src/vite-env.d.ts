/// <reference types="vite/client" />

/**
 * Compile-time guard defined exclusively during `vite serve` in development mode.
 * Always evaluates to `false` during any `vite build` output.
 */
declare const __BW_DEVTOOLS__: boolean;
