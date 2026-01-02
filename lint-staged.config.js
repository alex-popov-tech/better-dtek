export default {
	// 1. Format with Prettier (auto-stages fixes)
	'*.{js,ts,svelte,json,css,md,html}': ['prettier --write'],

	// 2. Lint with ESLint (auto-stages fixes)
	'*.{js,ts,svelte}': ['eslint --fix'],

	// 3. Run related tests
	'src/**/*.{js,ts,svelte}': ['vitest related --run'],

	// 4. Type check (runs once, not per-file)
	'*.{ts,svelte}': () => 'npm run check',
};
