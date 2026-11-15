// The few colour values that must exist as literals in TypeScript, because
// the place they go cannot read CSS variables (for example
// <meta name="theme-color">). The source of truth is the @theme block in
// app/globals.css: change a colour there and here together.
// Everywhere else, use the Tailwind classes (bg-ink, text-critical, ...) or
// var(--color-*).
export const INK_HEX = "#000000"; // --color-ink
