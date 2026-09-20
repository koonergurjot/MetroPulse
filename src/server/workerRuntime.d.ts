/**
 * Minimal ambient types for the Cloudflare Workers `HTMLRewriter` global.
 *
 * Deliberately hand-rolled instead of depending on `@cloudflare/workers-types`:
 * that package redefines `Request`/`Response`/`Element` project-wide, which
 * would fight the DOM `lib` this (intentionally portable, framework-free)
 * codebase already relies on everywhere else. `HTMLRewriterElement` is named
 * to avoid colliding with DOM's own `Element`.
 */

interface HTMLRewriterElement {
  setInnerContent(content: string, options?: { html?: boolean }): void;
  append(content: string, options?: { html?: boolean }): void;
  remove(): void;
}

interface HTMLRewriterElementHandlers {
  element?(element: HTMLRewriterElement): void;
}

declare class HTMLRewriter {
  on(selector: string, handlers: HTMLRewriterElementHandlers): HTMLRewriter;
  transform(response: Response): Response;
}
