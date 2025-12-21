<script lang="ts">
	import type { SavedAddress } from '$lib/types/address';
	import type { ScheduleRange, ScheduleStatus } from '$lib/types/dtek';
	import type { StatusCacheEntry } from '$lib/stores/address-status';
	import AddressCard from '$lib/components/composite/AddressCard.svelte';
	import { getUkrainianDayOfWeek } from '$lib/utils/schedule';

	// Get current day for schedule
	const today = getUkrainianDayOfWeek();

	// Helper to create full day schedule for display
	function createDaySchedule(currentStatus: ScheduleStatus): ScheduleRange[] {
		const ranges: ScheduleRange[] = [];
		const now = new Date();
		const currentHour = now.getHours();

		// Create hourly ranges for a realistic schedule
		for (let hour = 0; hour < 24; hour++) {
			let status: ScheduleStatus;
			if (hour === currentHour) {
				// Current hour has the target status
				status = currentStatus;
			} else if (hour < currentHour) {
				// Past hours - alternate between yes and no
				status = hour % 2 === 0 ? 'yes' : 'no';
			} else {
				// Future hours - mix of statuses
				status = hour % 3 === 0 ? 'no' : hour % 3 === 1 ? 'maybe' : 'yes';
			}
			ranges.push({ from: hour, to: hour + 1, status });
		}

		return ranges;
	}

	// Mock addresses
	const mockAddresses: SavedAddress[] = [
		{
			id: 'test-1',
			region: 'kem',
			city: 'м. Тест',
			street: 'вул. Тестова',
			building: '1',
			label: 'Світло є',
			createdAt: Date.now(),
		},
		{
			id: 'test-2',
			region: 'kem',
			city: 'м. Тест',
			street: 'вул. Тестова',
			building: '2',
			label: 'Можливо вимкнення',
			createdAt: Date.now(),
		},
		{
			id: 'test-3',
			region: 'oem',
			city: 'м. Тест',
			street: 'вул. Тестова',
			building: '3',
			label: 'Світла немає',
			createdAt: Date.now(),
		},
		{
			id: 'test-4',
			region: 'oem',
			city: 'м. Тест',
			street: 'вул. Аварійна',
			building: '1',
			label: 'Аварія',
			createdAt: Date.now(),
		},
		{
			id: 'test-5',
			region: 'dnem',
			city: 'м. Тест',
			street: 'вул. Тестова',
			building: '5',
			label: 'Перші 30 хв',
			createdAt: Date.now(),
		},
		{
			id: 'test-6',
			region: 'dnem',
			city: 'м. Тест',
			street: 'вул. Тестова',
			building: '6',
			label: 'Другі 30 хв',
			createdAt: Date.now(),
		},
		{
			id: 'test-7',
			region: 'dem',
			city: 'м. Тест',
			street: 'вул. Тестова',
			building: '7',
			label: 'Можливо перші 30 хв',
			createdAt: Date.now(),
		},
		{
			id: 'test-8',
			region: 'dem',
			city: 'м. Тест',
			street: 'вул. Тестова',
			building: '8',
			label: 'Завантаження',
			createdAt: Date.now(),
		},
		{
			id: 'test-9',
			region: 'kem',
			city: 'м. Тест',
			street: 'вул. Тестова',
			building: '9',
			label: 'Оновлення',
			createdAt: Date.now(),
		},
		{
			id: 'test-10',
			region: 'kem',
			city: 'м. Тест',
			street: 'вул. Тестова',
			building: '10',
			label: 'Помилка',
			createdAt: Date.now(),
		},
	];

	// Mock statuses
	const fetchedAt = Date.now();

	const mockStatuses = new Map<string, StatusCacheEntry>([
		// 1. Power ON (yes)
		['test-1', { status: { group: 'GPV1.1' }, fetchedAt, loading: false, error: null }],
		// 2. Maybe (maybe)
		['test-2', { status: { group: 'GPV1.2' }, fetchedAt, loading: false, error: null }],
		// 3. Power OFF (no)
		['test-3', { status: { group: 'GPV2.1' }, fetchedAt, loading: false, error: null }],
		// 4. Emergency
		[
			'test-4',
			{
				status: {
					group: 'GPV2.2',
					outage: { type: 'emergency' as const, from: '08:00 20.12.2025', to: '18:00 20.12.2025' },
				},
				fetchedAt,
				loading: false,
				error: null,
			},
		],
		// 5. Off first 30 min (first)
		['test-5', { status: { group: 'GPV3.1' }, fetchedAt, loading: false, error: null }],
		// 6. Off second 30 min (second)
		['test-6', { status: { group: 'GPV3.2' }, fetchedAt, loading: false, error: null }],
		// 7. Maybe first 30 min (mfirst)
		['test-7', { status: { group: 'GPV4.1' }, fetchedAt, loading: false, error: null }],
		// 8. Loading (initial - no status)
		['test-8', { status: null, fetchedAt: 0, loading: true, error: null }],
		// 9. Loading with cached data
		['test-9', { status: { group: 'GPV5.1' }, fetchedAt, loading: true, error: null }],
		// 10. Error
		['test-10', { status: null, fetchedAt, loading: false, error: "Помилка з'єднання з сервером" }],
	]);

	// Mock schedules - each group has different current status
	const mockSchedules: Record<string, Record<string, ScheduleRange[]>> = {
		// Group 1.1 - current hour is 'yes' (power ON)
		'GPV1.1': { [today]: createDaySchedule('yes') },
		// Group 1.2 - current hour is 'maybe'
		'GPV1.2': { [today]: createDaySchedule('maybe') },
		// Group 2.1 - current hour is 'no' (power OFF)
		'GPV2.1': { [today]: createDaySchedule('no') },
		// Group 2.2 - emergency (schedule doesn't matter, emergency takes precedence)
		'GPV2.2': { [today]: createDaySchedule('yes') },
		// Group 3.1 - current hour is 'first' (off first 30 min)
		'GPV3.1': { [today]: createDaySchedule('first') },
		// Group 3.2 - current hour is 'second' (off second 30 min)
		'GPV3.2': { [today]: createDaySchedule('second') },
		// Group 4.1 - current hour is 'mfirst' (maybe first 30 min)
		'GPV4.1': { [today]: createDaySchedule('mfirst') },
		// Group 5.1 - for loading with cached data (shows as 'on')
		'GPV5.1': { [today]: createDaySchedule('yes') },
	};

	// No-op handlers for the cards
	const noop = () => {};
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h2 class="h2 font-bold">Тестова сторінка</h2>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href="/" class="btn variant-ghost-primary">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="w-5 h-5"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
				/>
			</svg>
			<span>На головну</span>
		</a>
	</div>

	<p class="text-surface-600-300-token">
		Ця сторінка містить картки з усіма можливими статусами для тестування тем.
	</p>

	<!-- Cards grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
		{#each mockAddresses as address (address.id)}
			{@const statusEntry = mockStatuses.get(address.id)}
			<AddressCard
				{address}
				status={statusEntry?.status || null}
				loading={statusEntry?.loading || false}
				error={statusEntry?.error}
				fetchedAt={statusEntry?.fetchedAt}
				schedules={mockSchedules}
				onrefresh={noop}
				onedit={noop}
				ondelete={noop}
			/>
		{/each}
	</div>

	<!-- Legend -->
	<div class="card p-4">
		<h3 class="h4 font-bold mb-3">Легенда статусів</h3>
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
			<div class="flex items-center gap-2">
				<span class="w-3 h-3 rounded-full bg-green-500"></span>
				<span>Світло є (yes)</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="w-3 h-3 rounded-full bg-yellow-500"></span>
				<span>Можливо (maybe, mfirst, msecond)</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="w-3 h-3 rounded-full bg-red-500"></span>
				<span>Немає (no, first, second)</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
				<span>Аварія (emergency)</span>
			</div>
		</div>
	</div>
</div>
