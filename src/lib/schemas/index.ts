/**
 * Zod schemas for runtime validation across all cross-module boundaries
 *
 * Covers:
 * - API route input validation
 * - External DTEK API response validation
 * - Parsed template data validation
 * - Form input validation (Superforms)
 */

import { z } from 'zod';
import { REGION_CODES } from '$lib/constants/regions';

// =============================================================================
// Region Schema
// =============================================================================

/**
 * Valid region codes
 */
export const regionCodeSchema = z.enum(REGION_CODES as [string, ...string[]]);

export type RegionCodeValidated = z.infer<typeof regionCodeSchema>;

// =============================================================================
// API Route Input Schemas
// =============================================================================

/**
 * Query params for /api/cities endpoint
 */
export const regionQuerySchema = z.object({
	region: regionCodeSchema,
});

export type RegionQuery = z.infer<typeof regionQuerySchema>;

/**
 * Query params for /api/streets endpoint
 */
export const cityQuerySchema = z.object({
	region: regionCodeSchema,
	city: z.string().min(1, "Параметр city обов'язковий"),
});

export type CityQuery = z.infer<typeof cityQuerySchema>;

/**
 * Query params for /api/status endpoint
 */
export const statusQuerySchema = z.object({
	region: regionCodeSchema,
	city: z.string().min(1, "Параметр city обов'язковий"),
	street: z.string().min(1, "Параметр street обов'язковий"),
});

export type StatusQuery = z.infer<typeof statusQuerySchema>;

// =============================================================================
// DTEK External API Response Schemas
// =============================================================================

/**
 * Schema for individual building status from DTEK API
 * Matches DtekBuildingStatus interface
 */
export const dtekBuildingStatusSchema = z.object({
	sub_type: z.string().nullable(),
	start_date: z.string().nullable(),
	end_date: z.string().nullable(),
	type: z.string().nullable(),
	sub_type_reason: z.array(z.string()).nullable(),
	voluntarily: z.unknown().nullable(),
});

export type DtekBuildingStatusValidated = z.infer<typeof dtekBuildingStatusSchema>;

/**
 * Schema for DTEK getHomeNum AJAX response
 * Matches DtekStatusResponse interface
 */
export const dtekStatusResponseSchema = z.object({
	result: z.boolean(),
	data: z.record(z.string(), dtekBuildingStatusSchema),
});

export type DtekStatusResponseValidated = z.infer<typeof dtekStatusResponseSchema>;

// =============================================================================
// Template Parsing Schemas
// =============================================================================

/**
 * Schedule status values (normalized)
 */
export const normalizedScheduleStatusSchema = z.enum(['yes', 'maybe', 'no']);

/**
 * Schedule range with float times
 */
export const scheduleRangeSchema = z.object({
	from: z.number(),
	to: z.number(),
	status: normalizedScheduleStatusSchema,
});

export type ScheduleRangeValidated = z.infer<typeof scheduleRangeSchema>;

/**
 * Processed schedules: groupId → day → ranges
 */
export const processedSchedulesSchema = z.record(
	z.string(),
	z.record(z.string(), z.array(scheduleRangeSchema))
);

export type ProcessedSchedulesValidated = z.infer<typeof processedSchedulesSchema>;

/**
 * Schema for parsed DTEK template data
 * Matches DtekTemplateData interface
 */
export const dtekTemplateDataSchema = z.object({
	csrf: z.string().min(1, 'CSRF token is required'),
	updateFact: z.string(),
	cities: z.array(z.string()),
	streetsByCity: z.record(z.string(), z.array(z.string())),
	schedules: processedSchedulesSchema.optional(),
});

export type DtekTemplateDataValidated = z.infer<typeof dtekTemplateDataSchema>;

// =============================================================================
// Form Schemas (for Superforms)
// =============================================================================

/**
 * Schema for address form submission
 * Used by Superforms for client and server validation
 */
export const addressFormSchema = z.object({
	region: regionCodeSchema,
	city: z.string().min(1, 'Оберіть місто'),
	street: z.string().min(1, 'Оберіть вулицю'),
	building: z.string().min(1, 'Оберіть будинок'),
	label: z.string().optional(),
});

export type AddressFormData = z.infer<typeof addressFormSchema>;
