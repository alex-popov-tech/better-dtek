/**
 * DTEK Error Types
 *
 * Structured error types for explicit error handling across the application.
 * Each error type includes context for debugging and user-friendly messages.
 */

/**
 * Base interface for all DTEK errors
 */
export interface DtekErrorBase {
	readonly code: string;
	readonly message: string;
	readonly cause?: unknown;
	readonly timestamp: number;
}

/**
 * Network-level errors (fetch failures, timeouts, HTTP errors)
 */
export interface NetworkError extends DtekErrorBase {
	readonly code: 'NETWORK_ERROR';
	readonly url: string;
	readonly httpStatus?: number;
}

/**
 * Parse errors (HTML/JS/JSON parsing failures)
 */
export interface ParseError extends DtekErrorBase {
	readonly code: 'PARSE_ERROR';
	readonly parseType: 'csrf' | 'discon_streets' | 'discon_fact' | 'template' | 'json';
	readonly expected: string;
	readonly found?: string;
}

/**
 * Session/authentication errors
 */
export interface SessionError extends DtekErrorBase {
	readonly code: 'SESSION_ERROR';
	readonly reason: 'expired' | 'invalid' | 'missing' | 'auth_failed' | 'refresh_failed';
	readonly httpStatus?: number;
}

/**
 * Input validation errors
 */
export interface ValidationError extends DtekErrorBase {
	readonly code: 'VALIDATION_ERROR';
	readonly field: string;
	readonly constraint: string;
	readonly providedValue?: unknown;
}

/**
 * Union type for all DTEK-specific errors
 */
export type DtekError = NetworkError | ParseError | SessionError | ValidationError;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a NetworkError
 */
export const networkError = (
	url: string,
	message: string,
	opts?: Partial<Omit<NetworkError, 'code' | 'url' | 'message' | 'timestamp'>>
): NetworkError => ({
	code: 'NETWORK_ERROR',
	url,
	message,
	timestamp: Date.now(),
	...opts,
});

/**
 * Create a ParseError
 */
export const parseError = (
	parseType: ParseError['parseType'],
	message: string,
	opts?: Partial<Omit<ParseError, 'code' | 'parseType' | 'message' | 'timestamp'>>
): ParseError => ({
	code: 'PARSE_ERROR',
	parseType,
	message,
	expected: opts?.expected ?? '',
	timestamp: Date.now(),
	...opts,
});

/**
 * Create a SessionError
 */
export const sessionError = (
	reason: SessionError['reason'],
	message: string,
	opts?: Partial<Omit<SessionError, 'code' | 'reason' | 'message' | 'timestamp'>>
): SessionError => ({
	code: 'SESSION_ERROR',
	reason,
	message,
	timestamp: Date.now(),
	...opts,
});

/**
 * Create a ValidationError
 */
export const validationError = (
	field: string,
	constraint: string,
	message: string,
	providedValue?: unknown
): ValidationError => ({
	code: 'VALIDATION_ERROR',
	field,
	constraint,
	message,
	providedValue,
	timestamp: Date.now(),
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Map error code to appropriate HTTP status
 */
export const errorToHttpStatus = (error: DtekError): number => {
	switch (error.code) {
		case 'NETWORK_ERROR':
			return error.httpStatus ?? 503;
		case 'PARSE_ERROR':
			return 502; // Bad Gateway - upstream sent invalid response
		case 'SESSION_ERROR':
			return error.reason === 'auth_failed' ? 401 : 503;
		case 'VALIDATION_ERROR':
			return 400;
		default:
			return 500;
	}
};

/**
 * Map error to user-friendly message (Ukrainian)
 */
export const errorToUserMessage = (error: DtekError): string => {
	switch (error.code) {
		case 'NETWORK_ERROR':
			return "Немає з'єднання з сервером ДТЕК";
		case 'PARSE_ERROR':
			return 'Сервер ДТЕК повернув некоректні дані';
		case 'SESSION_ERROR':
			return 'Помилка авторизації з сервером ДТЕК';
		case 'VALIDATION_ERROR':
			return 'Невірні параметри запиту';
		default:
			return 'Невідома помилка';
	}
};

/**
 * Format error for logging (includes full context)
 */
export const formatErrorForLog = (error: DtekError): string => {
	const base = `[${error.code}] ${error.message}`;

	switch (error.code) {
		case 'NETWORK_ERROR':
			return `${base} (url: ${error.url}, status: ${error.httpStatus ?? 'N/A'})`;
		case 'PARSE_ERROR':
			return `${base} (type: ${error.parseType}, expected: ${error.expected}, found: ${error.found ?? 'N/A'})`;
		case 'SESSION_ERROR':
			return `${base} (reason: ${error.reason}, status: ${error.httpStatus ?? 'N/A'})`;
		case 'VALIDATION_ERROR':
			return `${base} (field: ${error.field}, constraint: ${error.constraint})`;
		default:
			return base;
	}
};
