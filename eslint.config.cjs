const js = require('@eslint/js');
const ts = require('typescript-eslint');
const svelte = require('eslint-plugin-svelte');
const prettier = require('eslint-config-prettier');

module.exports = [
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'node_modules/',
			'.vercel/',
			'*.config.js',
			'*.config.ts',
			'vite.config.ts',
		],
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	{
		files: ['**/*.js', '**/*.ts'],
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		},
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser,
			},
		},
	},
];
