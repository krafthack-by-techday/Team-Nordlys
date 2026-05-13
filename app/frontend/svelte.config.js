import { readFileSync } from 'node:fs';
import adapter from 'svelte-adapter-bun';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		version: {
			name: pkg.version
		},
		alias: {
			'@nordlys/contracts': '../be/packages/contracts/src',
			'@nordlys/contracts/*': '../be/packages/contracts/src/*',
			'@sinclair/typebox': './node_modules/@sinclair/typebox',
			'@sinclair/typebox/*': './node_modules/@sinclair/typebox/*'
		}
	}
};

export default config;
