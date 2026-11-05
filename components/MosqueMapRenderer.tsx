/**
 * Resolves the platform-specific mosque map implementation.
 *
 * Metro resolves `MosqueMapRenderer.native.tsx` / `.web.tsx` for those
 * platforms; this file keeps the plain `'../components/MosqueMapRenderer'`
 * import valid for TypeScript and any tooling without platform extensions
 * (Node, tests, SSR of the router's `+html`).
 */
export { MosqueMapRenderer } from './MosqueMapRenderer.native';
