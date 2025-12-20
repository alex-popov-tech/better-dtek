/**
 * Schedule status values from DisconSchedule.preset
 */
export type ScheduleStatus = 'yes' | 'maybe' | 'no' | 'mfirst' | 'msecond' | 'first' | 'second';

/**
 * Compressed schedule range with float times
 * Float convention: 9 = 09:00, 9.5 = 09:30
 * from inclusive, to exclusive
 */
export interface ScheduleRange {
	from: number;
	to: number;
	status: ScheduleStatus;
}

/**
 * Raw preset structure from DisconSchedule.preset
 */
export interface DtekRawPreset {
	sch_names: Record<string, string>;
	time_type: Record<string, string>;
	data: Record<string, Record<string, Record<string, ScheduleStatus>>>;
}

/**
 * Processed schedules: groupId → day → ranges
 * Days: "1" = Monday, "7" = Sunday
 */
export type ProcessedSchedules = Record<string, Record<string, ScheduleRange[]>>;

/**
 * Raw DTEK API response for getHomeNum - status for a single building
 */
export interface DtekBuildingStatus {
	/** "Аварійні ремонтні роботи" | "Планові ремонтні роботи" | null */
	sub_type: string | null;
	/** "00:40 13.12.2025" | null */
	start_date: string | null;
	/** "23:00 17.12.2025" | null */
	end_date: string | null;
	/** "1" = planned, "2" = emergency, null = no outage */
	type: string | null;
	sub_type_reason: string[] | null;
	voluntarily: unknown | null;
}

/**
 * DTEK ajax response from getHomeNum method
 */
export interface DtekStatusResponse {
	result: boolean;
	/** Map of building number to status */
	data: Record<string, DtekBuildingStatus>;
}

/**
 * Parsed template data extracted from DTEK HTML page
 */
export interface DtekTemplateData {
	/** CSRF token from meta tag */
	csrf: string;
	/** Update fact timestamp "11.12.2025 20:51" */
	updateFact: string;
	/** List of all city names */
	cities: string[];
	/** Map of city name to array of street names */
	streetsByCity: Record<string, string[]>;
	/** Processed schedules from DisconSchedule.preset (optional) */
	schedules?: ProcessedSchedules;
}

/**
 * Session state maintained by DtekService
 */
export interface DtekSession {
	cookies: Map<string, string>;
	csrf: string;
	updateFact: string;
	/** Unix timestamp when session expires */
	expiresAt: number;
}
