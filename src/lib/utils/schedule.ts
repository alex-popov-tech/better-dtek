import type { ScheduleRange } from '$lib/types/dtek';

/**
 * Get current day of week in Ukraine (1=Monday, 7=Sunday)
 */
export function getUkrainianDayOfWeek(): string {
	const kyivTime = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' });
	const date = new Date(kyivTime);
	const jsDay = date.getDay(); // 0=Sunday in JavaScript
	return String(jsDay === 0 ? 7 : jsDay);
}

/**
 * Get tomorrow's day of week in Ukraine (1=Monday, 7=Sunday)
 */
export function getTomorrowDayOfWeek(): string {
	const today = parseInt(getUkrainianDayOfWeek());
	return String(today === 7 ? 1 : today + 1);
}

/**
 * Get current time in Ukraine as a float (e.g., 14.5 = 14:30)
 */
export function getCurrentTimeAsFloat(): number {
	const kyivTime = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' });
	const date = new Date(kyivTime);
	return date.getHours() + date.getMinutes() / 60;
}

/**
 * Find which schedule range contains the given time
 * @param ranges Array of schedule ranges for a day
 * @param currentTime Time as float (e.g., 14.5)
 * @returns The matching range or null if none found
 */
export function findCurrentRange(
	ranges: ScheduleRange[],
	currentTime: number
): ScheduleRange | null {
	return ranges.find((r) => currentTime >= r.from && currentTime < r.to) || null;
}

/**
 * Format float time to HH:MM string
 * @param time Time as float (e.g., 9.5 = "09:30")
 */
export function formatTimeFloat(time: number): string {
	const hours = Math.floor(time);
	const minutes = Math.round((time - hours) * 60);
	return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Traffic light status derived from schedule
 */
export type TrafficLightStatus = 'on' | 'maybe' | 'off' | 'emergency';

/**
 * Get traffic light status from current schedule range
 * Maps schedule status to simplified traffic light state
 */
export function getTrafficLightFromSchedule(ranges: ScheduleRange[]): TrafficLightStatus {
	const currentTime = getCurrentTimeAsFloat();
	const currentRange = findCurrentRange(ranges, currentTime);

	if (!currentRange) {
		// No schedule data for current time, default to green
		return 'on';
	}

	const status = currentRange.status;

	if (status === 'yes') {
		return 'on';
	}

	if (status === 'maybe' || status === 'mfirst' || status === 'msecond') {
		return 'maybe';
	}

	// 'no', 'first', 'second' - all mean power is off
	return 'off';
}

/**
 * Get the current schedule range info for display
 * Returns the time range string for the current period
 */
export function getCurrentRangeInfo(ranges: ScheduleRange[]): string | null {
	const currentTime = getCurrentTimeAsFloat();
	const currentRange = findCurrentRange(ranges, currentTime);

	if (!currentRange) {
		return null;
	}

	return `${formatTimeFloat(currentRange.from)}-${formatTimeFloat(currentRange.to)}`;
}
