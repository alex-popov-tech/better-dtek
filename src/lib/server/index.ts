/**
 * Server-side library exports
 *
 * Re-exports server-only modules for easy importing:
 * import { getDtekService } from '$lib/server';
 */

export { getDtekService } from './dtek/service';
export type { DtekService } from './dtek/service';

export { transformBuildingStatus } from './dtek/transform';
