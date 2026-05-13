/**
 * E2E tests for the SvelteKit BFF setup served with Bun.
 *
 * A tiny mock backend is spun up on port 3999 (matching CORE_API_URL in
 * playwright.config.ts) so the BFF proxy has something to talk to.
 */
import { expect, test, type Page } from '@playwright/test';
import { createServer, type Server } from 'http';

// ---------------------------------------------------------------------------
// Mock backend (simulates the Elysia api-gateway)
// ---------------------------------------------------------------------------

const MOCK_EVENTS = [
	{
		id: 'evt-1',
		node_id: 'n1',
		company: 'Statnett',
		title: 'Suspicious login',
		description: 'Multiple failed logins from foreign IP',
		severity: 'high',
		source: 'siem',
		external_ref: '',
		scenario_id: '',
		created_at: '2026-01-15T10:00:00Z',
		signature: 'sig1'
	},
	{
		id: 'evt-2',
		node_id: 'n2',
		company: 'Hafslund',
		title: 'Port scan detected',
		description: '',
		severity: 'medium',
		source: 'scanner',
		external_ref: '',
		scenario_id: '',
		created_at: '2026-01-15T11:00:00Z',
		signature: 'sig2'
	}
];

const MOCK_STATS = {
	events: 42,
	indicators: 15,
	peers: 7,
	chat_messages: 123,
	vulnerabilities: 9
};

let mockServer: Server;

test.beforeAll(async () => {
	mockServer = createServer((req, res) => {
		res.setHeader('Content-Type', 'application/json');
		const url = new URL(req.url ?? '/', 'http://localhost');
		const path = url.pathname;

		if (path === '/v1/events') {
			res.end(JSON.stringify(MOCK_EVENTS));
		} else if (path === '/v1/stats') {
			res.end(JSON.stringify(MOCK_STATS));
		} else if (path === '/v1/indicators') {
			res.end(JSON.stringify([]));
		} else if (path === '/v1/peers') {
			res.end(JSON.stringify([]));
		} else if (path.startsWith('/v1/events/')) {
			const id = decodeURIComponent(path.replace('/v1/events/', ''));
			const evt = MOCK_EVENTS.find((e) => e.id === id);
			if (evt) {
				res.end(JSON.stringify(evt));
			} else {
				res.statusCode = 404;
				res.end(JSON.stringify({ error: 'not found' }));
			}
		} else if (path === '/health') {
			res.end(JSON.stringify({ status: 'ok' }));
		} else {
			res.statusCode = 404;
			res.end(JSON.stringify({ error: 'not found' }));
		}
	});

	await new Promise<void>((resolve) => mockServer.listen(3999, resolve));
});

test.afterAll(async () => {
	await new Promise<void>((resolve, reject) =>
		mockServer.close((err) => (err ? reject(err) : resolve()))
	);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('App shell', () => {
	test('homepage loads and has heading', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('h1')).toBeVisible();
	});

	test('returns valid HTML with correct content-type', async ({ request }) => {
		const res = await request.get('/');
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type']).toContain('text/html');
	});
});

test.describe('BFF proxy — /api/v1/*', () => {
	test('GET /api/v1/events returns events from upstream', async ({ request }) => {
		const res = await request.get('/api/v1/events');
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body).toHaveLength(2);
		expect(body[0].title).toBe('Suspicious login');
	});

	test('GET /api/v1/stats returns stats from upstream', async ({ request }) => {
		const res = await request.get('/api/v1/stats');
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body.events).toBe(42);
		expect(body.peers).toBe(7);
	});

	test('GET /api/v1/events/:id returns single event', async ({ request }) => {
		const res = await request.get('/api/v1/events/evt-1');
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body.id).toBe('evt-1');
		expect(body.company).toBe('Statnett');
	});

	test('GET /api/v1/events/:id returns 404 for unknown', async ({ request }) => {
		const res = await request.get('/api/v1/events/does-not-exist');
		expect(res.status()).toBe(404);
	});

	test('preserves query params through proxy', async ({ request }) => {
		// The mock returns same data regardless, but we verify no crash
		const res = await request.get('/api/v1/events?severity=high&limit=10');
		expect(res.status()).toBe(200);
	});

	test('returns JSON content-type from upstream', async ({ request }) => {
		const res = await request.get('/api/v1/events');
		expect(res.headers()['content-type']).toContain('application/json');
	});
});

test.describe('Events page (SSR + BFF)', () => {
	test('renders event list from backend', async ({ page }) => {
		await page.goto('/events');
		// Wait for events to load (client-side onMount fetch)
		await expect(page.getByText('Suspicious login')).toBeVisible({ timeout: 10000 });
		await expect(page.getByText('Port scan detected')).toBeVisible();
	});

	test('shows company and severity info', async ({ page }) => {
		await page.goto('/events');
		await expect(page.getByText('Suspicious login')).toBeVisible({ timeout: 10000 });
		await expect(page.getByText('Statnett')).toBeVisible();
		await expect(page.getByText('high')).toBeVisible();
	});

	test('has page title', async ({ page }) => {
		await page.goto('/events');
		await expect(page).toHaveTitle(/Events/);
	});

	test('refresh button is visible', async ({ page }) => {
		await page.goto('/events');
		await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible({ timeout: 10000 });
	});
});
