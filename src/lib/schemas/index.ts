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
import {
	DASHBOARD_ID_LENGTH,
	DASHBOARD_NAME_MAX,
	DASHBOARD_LABEL_MAX,
	DASHBOARD_FIELD_MAX,
} from '$lib/types/dashboard';

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

// =============================================================================
// Dashboard Schemas
// =============================================================================

/**
 * Dashboard id: 10 lowercase letters or digits
 */
export const dashboardIdSchema = z
	.string()
	.regex(new RegExp(`^[a-z0-9]{${DASHBOARD_ID_LENGTH}}$`), 'Некоректний ідентифікатор дашборду');

/**
 * Dashboard name: 1-60 characters after trimming
 */
export const dashboardNameSchema = z
	.string()
	.trim()
	.min(1, 'Назва має містити від 1 до 60 символів')
	.max(DASHBOARD_NAME_MAX, 'Назва має містити від 1 до 60 символів');

/**
 * Request body for creating or renaming a dashboard
 */
export const dashboardNameBodySchema = z.object({
	name: dashboardNameSchema,
});

const dashboardFieldSchema = z
	.string()
	.min(1, "Поле обов'язкове")
	.max(DASHBOARD_FIELD_MAX, 'Значення задовге');

/**
 * Address stored in a dashboard: the form schema plus length caps, so the
 * address cap really bounds how much one dashboard can store.
 * An empty label is stored as no label.
 */
export const dashboardAddressSchema = addressFormSchema.extend({
	city: dashboardFieldSchema,
	street: dashboardFieldSchema,
	building: dashboardFieldSchema,
	label: z
		.string()
		.trim()
		.max(DASHBOARD_LABEL_MAX, 'Мітка має містити до 60 символів')
		.optional()
		.transform((label) => (label ? label : undefined)),
});

export type DashboardAddressData = z.infer<typeof dashboardAddressSchema>;
