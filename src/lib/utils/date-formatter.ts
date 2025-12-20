import { UI_TEXT } from '$lib/constants/ui-text';

/**
 * Format a timestamp as relative time in Ukrainian
 * Examples: "щойно", "5 хв тому", "2 год тому", "вчора", "3 дн тому"
 */
export function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diffMs = now - timestamp;
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);
	const diffWeeks = Math.floor(diffDays / 7);
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffSeconds < 60) {
		return UI_TEXT.time.justNow;
	} else if (diffMinutes < 60) {
		return `${diffMinutes} ${UI_TEXT.time.minutesAgo}`;
	} else if (diffHours < 24) {
		return `${diffHours} ${UI_TEXT.time.hoursAgo}`;
	} else if (diffDays === 1) {
		return UI_TEXT.time.yesterday;
	} else if (diffDays < 7) {
		return `${diffDays} ${UI_TEXT.time.daysAgo}`;
	} else if (diffWeeks < 4) {
		return `${diffWeeks} ${UI_TEXT.time.weeksAgo}`;
	} else if (diffMonths < 12) {
		return `${diffMonths} ${UI_TEXT.time.monthsAgo}`;
	} else {
		return `${diffYears} ${UI_TEXT.time.yearsAgo}`;
	}
}

/**
 * Parse DTEK date format "14:30 17.12.2025" to Date object
 * Format: "HH:MM DD.MM.YYYY"
 */
export function parseDtekDate(dateString: string): Date {
	// Example: "14:30 17.12.2025"
	const parts = dateString.trim().split(' ');
	if (parts.length !== 2) {
		throw new Error(`Invalid DTEK date format: ${dateString}`);
	}

	const [time, date] = parts;
	const [hours, minutes] = time.split(':').map(Number);
	const [day, month, year] = date.split('.').map(Number);

	// Validate parsed values
	if (
		isNaN(hours) ||
		isNaN(minutes) ||
		isNaN(day) ||
		isNaN(month) ||
		isNaN(year) ||
		hours < 0 ||
		hours > 23 ||
		minutes < 0 ||
		minutes > 59 ||
		day < 1 ||
		day > 31 ||
		month < 1 ||
		month > 12
	) {
		throw new Error(`Invalid date values in: ${dateString}`);
	}

	// Month is 0-indexed in JavaScript Date
	return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Format Date object to Ukrainian format: "17 грудня 2025, 14:30"
 */
export function formatUkrainianDate(date: Date): string {
	const day = date.getDate();
	const month = UI_TEXT.months.genitive[date.getMonth()];
	const year = date.getFullYear();
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');

	return `${day} ${month} ${year}, ${hours}:${minutes}`;
}
