/**
 * Server-side library exports
 *
 * Re-exports server-only modules for easy importing:
 * import { getDtekService } from '$lib/server';
 */

export { getDtekService, createDtekService } from './dtek/service';
export type { DtekService } from './dtek/service';
