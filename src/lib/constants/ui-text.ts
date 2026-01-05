import type { ScheduleStatus } from '$lib/types/dtek.js';

/**
 * UI text constants in Ukrainian
 * All user-facing strings for the DTEK power outage monitoring application
 */
export const UI_TEXT = {
	// Header
	appTitle: 'Відключення світла',
	appSubtitle: 'ДТЕК Електромережі',

	// Theme
	lightMode: 'Світла тема',
	darkMode: 'Темна тема',
	toggleTheme: 'Перемкнути тему',

	// Address list
	savedAddresses: 'Збережені адреси',
	noSavedAddresses: 'Немає збережених адрес',
	addFirstAddress: 'Додайте першу адресу',
	emptyStateValueProp: 'Відстежуйте планові та аварійні відключення',
	refresh: 'Оновити',

	// Address form
	addAddress: 'Додати адресу',
	editAddress: 'Редагувати адресу',
	region: 'Область',
	regionPlaceholder: 'Оберіть область...',
	city: 'Місто',
	cityPlaceholder: 'Оберіть місто...',
	street: 'Вулиця',
	streetPlaceholder: 'Оберіть вулицю...',
	building: 'Будинок',
	buildingPlaceholder: 'Оберіть будинок...',
	label: "Назва (необов'язково)",
	labelPlaceholder: 'Дім, Робота...',
	save: 'Зберегти',
	cancel: 'Скасувати',
	delete: 'Видалити',
	confirmDelete: 'Видалити цю адресу?',

	// Status
	status: 'Статус',
	noOutage: 'Відключень немає',
	emergencyOutage: 'Аварійне відключення',
	startDate: 'Початок',
	endDate: 'Закінчення',
	lastUpdated: 'Оновлено',

	// Loading/Error
	loading: 'Завантаження...',
	error: 'Помилка',
	dtekUnavailable: 'Сервіс ДТЕК тимчасово недоступний',
	regionUnavailable: 'Регіон тимчасово недоступний. Спробуйте пізніше або оберіть інший регіон.',
	tryLater: 'Спробуйте пізніше',
	addressNotFound: 'Адресу не знайдено',
	invalidParams: 'Невірні параметри',
	networkError: "Немає з'єднання",
	checkInternet: 'Перевірте інтернет',
	invalidApiResponse: 'Невірний формат відповіді API',
	cityRequired: "Назва міста обов'язкова",
	streetRequired: "Назва вулиці обов'язкова",
	noResults: 'Нічого не знайдено',

	// Time units for relative time formatting
	time: {
		justNow: 'щойно',
		minutesAgo: 'хв тому',
		hoursAgo: 'год тому',
		yesterday: 'вчора',
		daysAgo: 'дн тому',
		weeksAgo: 'тиж тому',
		monthsAgo: 'міс тому',
		yearsAgo: 'рок тому',
	},

	// Month names in Ukrainian (genitive case for date formatting)
	months: {
		genitive: [
			'січня',
			'лютого',
			'березня',
			'квітня',
			'травня',
			'червня',
			'липня',
			'серпня',
			'вересня',
			'жовтня',
			'листопада',
			'грудня',
		],
	},
} as const;

// Type helper for accessing nested UI_TEXT properties
export type UIText = typeof UI_TEXT;

/**
 * Ukrainian labels for schedule status values
 */
export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
	yes: 'Світло є',
	no: 'Світла немає',
	maybe: 'Можливо відключення',
	mfirst: 'Можливо немає перші 30 хв',
	msecond: 'Можливо немає другі 30 хв',
	first: 'Немає перші 30 хв',
	second: 'Немає другі 30 хв',
};

/**
 * Tailwind color classes for schedule status
 */
export const SCHEDULE_STATUS_COLORS: Record<ScheduleStatus, string> = {
	yes: 'bg-green-500',
	no: 'bg-red-500',
	maybe: 'bg-yellow-500',
	mfirst: 'bg-yellow-500',
	msecond: 'bg-yellow-500',
	first: 'bg-red-500',
	second: 'bg-red-500',
};

/**
 * Full Ukrainian day names (1=Monday, 7=Sunday)
 */
export const DAY_NAMES: Record<string, string> = {
	'1': 'Понеділок',
	'2': 'Вівторок',
	'3': 'Середа',
	'4': 'Четвер',
	'5': "П'ятниця",
	'6': 'Субота',
	'7': 'Неділя',
};

/**
 * Short Ukrainian day names
 */
export const DAY_NAMES_SHORT: Record<string, string> = {
	'1': 'Пн',
	'2': 'Вт',
	'3': 'Ср',
	'4': 'Чт',
	'5': 'Пт',
	'6': 'Сб',
	'7': 'Нд',
};

/**
 * Traffic light status labels for display
 */
export const TRAFFIC_LIGHT_LABELS = {
	on: 'Світло є',
	maybe: 'Можливо відключення',
	off: 'Світла немає',
	emergency: 'Аварійне відключення',
} as const;

/**
 * Schedule info prefix
 */
export const SCHEDULE_INFO_PREFIX = 'За розкладом:';
