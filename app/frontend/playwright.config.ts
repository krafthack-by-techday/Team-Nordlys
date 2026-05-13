import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && bun ./build/index.js',
		port: 3000,
		env: {
			PORT: '3000',
			CORE_API_URL: 'http://localhost:3999'
		},
		reuseExistingServer: !process.env.CI
	},
	testMatch: '**/*.e2e.{ts,js}',
	use: {
		baseURL: 'http://localhost:3000'
	}
});
