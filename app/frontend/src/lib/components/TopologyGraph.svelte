<script lang="ts">
	import { untrack } from 'svelte';
	import type { PeerWithStatus } from '$lib/api/types';
	import { timeAgo } from '$lib/utils/time';
	import { fmtDateTime } from '$lib/utils/format';
	import { isPeerStale, isKraftcert as checkKraftcert } from '$lib/utils/peer';
	import SegmentedControl from './SegmentedControl.svelte';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		peers: PeerWithStatus[];
		selfNodeId?: string;
		selectedId?: string | null;
		onselect?: (nodeId: string) => void;
	}

	let { peers, selfNodeId, selectedId = null, onselect }: Props = $props();

	// ── Layout modes ──
	type LayoutMode = 'force' | 'radial' | 'grid' | 'cluster';
	let layoutMode = $state<LayoutMode>('force');

	const layouts: { value: LayoutMode; label: string }[] = [
		{ value: 'force', label: 'Mesh' },
		{ value: 'radial', label: 'Radial' },
		{ value: 'grid', label: 'Grid' },
		{ value: 'cluster', label: m.topology_layout_cluster() }
	];

	// ── Node model ──
	interface GNode {
		id: string;
		company: string;
		isKraftcert: boolean;
		isStale: boolean;
		lastSeenAt: string | undefined;
		registeredAt: string;
		registeredBy: string;
		x: number;
		y: number;
		vx: number;
		vy: number;
		tx: number;
		ty: number;
	}

	let canvas: HTMLCanvasElement;
	let nodes = $state<GNode[]>([]);
	let raf: number;
	let dragNode: GNode | null = null;
	let w = $state(800);
	let h = $state(500);

	// ── Camera (zoom/pan) ──
	let camX = $state(0);
	let camY = $state(0);
	let camZoom = $state(1);
	let isPanning = $state(false);
	let panStartX = 0;
	let panStartY = 0;
	let panStartCamX = 0;
	let panStartCamY = 0;

	// ── Tooltip ──
	let hoverNode = $state<GNode | null>(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	// ── Trails (gossip path visualization) ──
	interface Trail {
		path: string[]; // node IDs from origin to self
		age: number; // 0→1 (fade progress)
		color: string;
		lineWidth: number;
		curveDir: number; // +1 or -1 for perpendicular offset direction
	}
	let trails: Trail[] = [];
	const MAX_TRAILS = 10;
	const TRAIL_FADE_SPEED = 0.012; // ~1.4s at 60fps

	let SEVERITY_COLORS: Record<string, string> = {
		low: '#4ade80',
		medium: '#38bdf8',
		high: '#fb923c',
		critical: '#f87171'
	};

	/** Show a trail from the event's relay path, fading out over ~1.4s. */
	export function showTrail(path: string[], severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
		if (path.length < 2) return;
		if (trails.length >= MAX_TRAILS) trails.shift(); // drop oldest
		const color = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.medium;
		const lineWidth = severity === 'critical' ? 2.5 : severity === 'high' ? 2 : 1.5;
		// Alternate curve direction based on simple hash of first node id
		const hash = path[0].split('').reduce((a, c) => a + c.charCodeAt(0), 0);
		trails.push({ path, age: 0, color, lineWidth, curveDir: hash % 2 === 0 ? 1 : -1 });
	}

	// ── Catmull-Rom → Bézier helper ──
	function drawCatmullRomPath(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], _dir: number) {
		if (points.length < 2) return;
		// Direct node-to-node line segments
		ctx.moveTo(points[0].x, points[0].y);
		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i].x, points[i].y);
		}
	}

	// ── Cached CSS colors (refreshed on draw) ──
	let _colors: Record<string, string> = {};
	let _colorsDirty = true;
	function refreshColors() {
		if (!_colorsDirty && Object.keys(_colors).length > 0) return;
		const s = getComputedStyle(document.documentElement);
		_colors = {
			mint: s.getPropertyValue('--color-aurora-mint').trim() || '#7fdcb5',
			arctic: s.getPropertyValue('--color-aurora-arctic').trim() || '#6ec8e4',
			line: s.getPropertyValue('--color-line').trim() || '#333',
			fg: s.getPropertyValue('--color-fg').trim() || '#eee',
			fgDim: s.getPropertyValue('--color-fg-dim').trim() || '#888',
			fontDisplay: s.getPropertyValue('--font-display').trim(),
			fontMono: s.getPropertyValue('--font-mono').trim(),
		};
		SEVERITY_COLORS = {
			low: s.getPropertyValue('--color-severity-low').trim() || s.getPropertyValue('--color-aurora-mint').trim() || '#4ade80',
			medium: s.getPropertyValue('--color-severity-medium').trim() || s.getPropertyValue('--color-aurora-arctic').trim() || '#38bdf8',
			high: s.getPropertyValue('--color-severity-high').trim() || s.getPropertyValue('--color-warning').trim() || '#fb923c',
			critical: s.getPropertyValue('--color-severity-critical').trim() || s.getPropertyValue('--color-danger').trim() || '#f87171',
		};
		_colorsDirty = false;
	}

	// Refresh colors when theme changes
	$effect(() => {
		const obs = new MutationObserver(() => { _colorsDirty = true; });
		obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => obs.disconnect();
	});

	function screenToWorld(sx: number, sy: number): [number, number] {
		return [(sx - w / 2) / camZoom + w / 2 - camX, (sy - h / 2) / camZoom + h / 2 - camY];
	}

	// ── Sync peers → nodes ──
	$effect(() => {
		const peerList = peers;
		const mode = layoutMode;
		untrack(() => {
			const existing = new Map(nodes.map((n) => [n.id, n]));
			nodes = peerList.map((p) => {
				const isSelf = p.node_id === selfNodeId;
				const stale = isPeerStale(p.last_seen_at, undefined, isSelf);
				const prev = existing.get(p.node_id);
				if (prev) {
					prev.company = p.company;
					prev.isKraftcert = checkKraftcert(p);
					prev.isStale = stale;
					prev.lastSeenAt = p.last_seen_at;
					prev.registeredBy = p.registered_by;
					return prev;
				}
			return {
				id: p.node_id,
				company: p.company,
				isKraftcert: checkKraftcert(p),
				isStale: stale,
				lastSeenAt: p.last_seen_at,
				registeredAt: p.registered_at,
				registeredBy: p.registered_by,
				x: p.node_id === selfNodeId ? w / 2 : w / 2 + (Math.random() - 0.5) * Math.min(w, 600),
				y: p.node_id === selfNodeId ? h / 2 : h / 2 + (Math.random() - 0.5) * Math.min(h, 400),
					vx: 0,
					vy: 0,
					tx: 0,
					ty: 0
				};
			});
			computeTargets();
			// Auto-zoom to fit on first large load
			if (nodes.length > 50 && camZoom === 1) {
				camZoom = Math.max(0.25, Math.min(1, 20 / Math.sqrt(nodes.length)));
			}
		});
	});

	function computeTargets() {
		const cx = w / 2;
		const cy = h / 2;
		const n = nodes.length;
		if (n === 0) return;

		if (layoutMode === 'radial') {
			const kraftcert = nodes.filter((n) => n.isKraftcert);
			const others = nodes.filter((n) => !n.isKraftcert);
			for (const k of kraftcert) { k.tx = cx; k.ty = cy; }
			// Multiple rings for large counts
			const perRing = Math.max(20, Math.ceil(Math.sqrt(others.length) * 4));
			const ringCount = Math.ceil(others.length / perRing);
			const baseRadius = Math.min(w, h) * 0.2;
			others.forEach((node, i) => {
				const ring = Math.floor(i / perRing);
				const posInRing = i % perRing;
				const ringSize = Math.min(perRing, others.length - ring * perRing);
				const radius = baseRadius + ring * 80;
				const angle = (posInRing / ringSize) * Math.PI * 2 - Math.PI / 2;
				node.tx = cx + Math.cos(angle) * radius;
				node.ty = cy + Math.sin(angle) * radius;
			});
		} else if (layoutMode === 'grid') {
			const sorted = [...nodes].sort((a, b) => a.company.localeCompare(b.company));
			const cols = Math.ceil(Math.sqrt(n * (w / h)));
			const rows = Math.ceil(n / cols);
			const cellW = w / (cols + 1);
			const cellH = h / (rows + 1);
			sorted.forEach((node, i) => {
				node.tx = cellW * ((i % cols) + 1);
				node.ty = cellH * (Math.floor(i / cols) + 1);
			});
		} else if (layoutMode === 'cluster') {
			const groups = new Map<string, GNode[]>();
			for (const node of nodes) {
				const list = groups.get(node.company) ?? [];
				list.push(node);
				groups.set(node.company, list);
			}
			const groupArr = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
			const gCount = groupArr.length;
			// Arrange clusters in a grid-like pattern rather than a single ring
			const cols = Math.ceil(Math.sqrt(gCount * (w / h)));
			const rows = Math.ceil(gCount / cols);
			const spacingX = w / (cols + 1);
			const spacingY = h / (rows + 1);
			groupArr.forEach(([, members], gi) => {
				const col = gi % cols;
				const row = Math.floor(gi / cols);
				const gx = spacingX * (col + 1);
				const gy = spacingY * (row + 1);
				const clusterRadius = Math.min(spacingX * 0.35, 15 + Math.sqrt(members.length) * 12);
				members.forEach((node, mi) => {
					if (members.length === 1) {
						node.tx = gx;
						node.ty = gy;
					} else {
						const a = (mi / members.length) * Math.PI * 2;
						const r = clusterRadius * (0.4 + 0.6 * (mi / members.length));
						node.tx = gx + Math.cos(a) * r;
						node.ty = gy + Math.sin(a) * r;
					}
				});
			});
		}
	}

	// ── Resize ──
	function resize() {
		if (!canvas) return;
		const parent = canvas.parentElement;
		if (!parent) return;
		w = parent.clientWidth;
		h = parent.clientHeight;
		canvas.width = w * devicePixelRatio;
		canvas.height = h * devicePixelRatio;
		canvas.style.width = w + 'px';
		canvas.style.height = h + 'px';
		computeTargets();
	}

	// ── Barnes-Hut Quadtree ──
	interface QTNode {
		cx: number; cy: number;  // center of mass
		mass: number;
		x0: number; y0: number; x1: number; y1: number;  // bounds
		children: (QTNode | null)[];
		leaf: GNode | null;
	}

	function buildQuadtree(nodes: GNode[]): QTNode | null {
		if (nodes.length === 0) return null;
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const n of nodes) {
			if (n.x < minX) minX = n.x;
			if (n.y < minY) minY = n.y;
			if (n.x > maxX) maxX = n.x;
			if (n.y > maxY) maxY = n.y;
		}
		// Pad to square
		const size = Math.max(maxX - minX, maxY - minY, 1) + 10;
		const root: QTNode = {
			cx: 0, cy: 0, mass: 0,
			x0: minX - 5, y0: minY - 5, x1: minX + size + 5, y1: minY + size + 5,
			children: [null, null, null, null], leaf: null
		};
		for (const n of nodes) insertQT(root, n);
		return root;
	}

	function insertQT(qt: QTNode, n: GNode) {
		// Update center of mass
		const totalMass = qt.mass + 1;
		qt.cx = (qt.cx * qt.mass + n.x) / totalMass;
		qt.cy = (qt.cy * qt.mass + n.y) / totalMass;
		qt.mass = totalMass;

		if (qt.leaf === null && qt.mass === 1) {
			qt.leaf = n;
			return;
		}

		// Subdivide if leaf exists
		if (qt.leaf) {
			const old = qt.leaf;
			qt.leaf = null;
			insertIntoChild(qt, old);
		}
		insertIntoChild(qt, n);
	}

	function insertIntoChild(qt: QTNode, n: GNode) {
		const midX = (qt.x0 + qt.x1) / 2;
		const midY = (qt.y0 + qt.y1) / 2;
		const right = n.x > midX ? 1 : 0;
		const bottom = n.y > midY ? 1 : 0;
		const idx = right + bottom * 2;
		if (!qt.children[idx]) {
			qt.children[idx] = {
				cx: 0, cy: 0, mass: 0,
				x0: right ? midX : qt.x0, y0: bottom ? midY : qt.y0,
				x1: right ? qt.x1 : midX, y1: bottom ? qt.y1 : midY,
				children: [null, null, null, null], leaf: null
			};
		}
		insertQT(qt.children[idx]!, n);
	}

	/** Barnes-Hut: apply repulsive force from quadtree to node. θ = 0.7 */
	function applyRepulsion(qt: QTNode | null, node: GNode, repulsion: number) {
		if (!qt || qt.mass === 0) return;
		const dx = qt.cx - node.x;
		const dy = qt.cy - node.y;
		const distSq = dx * dx + dy * dy + 0.01;
		const size = qt.x1 - qt.x0;

		// If sufficiently far, treat as single body
		if (size * size / distSq < 0.49 || qt.mass === 1) {
			if (qt.leaf === node) return;
			const force = repulsion * qt.mass / distSq;
			const dist = Math.sqrt(distSq);
			node.vx -= (dx / dist) * force;
			node.vy -= (dy / dist) * force;
			return;
		}

		// Recurse into children
		for (const child of qt.children) {
			applyRepulsion(child, node, repulsion);
		}
	}

	// ── Spatial grid for neighbor links ──
	function buildSpatialGrid(nodes: GNode[], cellSize: number): Map<string, GNode[]> {
		const grid = new Map<string, GNode[]>();
		for (const n of nodes) {
			const key = `${Math.floor(n.x / cellSize)},${Math.floor(n.y / cellSize)}`;
			const cell = grid.get(key);
			if (cell) cell.push(n);
			else grid.set(key, [n]);
		}
		return grid;
	}

	function getNearbyNodes(grid: Map<string, GNode[]>, node: GNode, cellSize: number, maxDist: number): GNode[] {
		const cx = Math.floor(node.x / cellSize);
		const cy = Math.floor(node.y / cellSize);
		const r = Math.ceil(maxDist / cellSize);
		const result: GNode[] = [];
		const maxDistSq = maxDist * maxDist;
		for (let dx = -r; dx <= r; dx++) {
			for (let dy = -r; dy <= r; dy++) {
				const cell = grid.get(`${cx + dx},${cy + dy}`);
				if (!cell) continue;
				for (const n of cell) {
					if (n === node) continue;
					const ddx = n.x - node.x, ddy = n.y - node.y;
					if (ddx * ddx + ddy * ddy < maxDistSq) result.push(n);
				}
			}
		}
		return result;
	}

	// ── Simulation ──
	function simulate() {
		const cx = w / 2;
		const cy = h / 2;
		const n = nodes.length;
		if (n === 0) return;

		if (layoutMode === 'force') {
			// Barnes-Hut repulsion — O(n log n)
			const qt = buildQuadtree(nodes);
			const repulsion = n > 200 ? 800 : n > 80 ? 1500 : 3000;
			const gravity = n > 200 ? 0.003 : n > 80 ? 0.001 : 0.0005;
			const damping = n > 200 ? 0.8 : 0.85;

			for (const node of nodes) {
				if (node === dragNode || node.id === selfNodeId) continue;
				// Gravity towards center
				node.vx += (cx - node.x) * gravity;
				node.vy += (cy - node.y) * gravity;
				// Repulsion via quadtree
				applyRepulsion(qt, node, repulsion);
			}

			// Apply velocity
			for (const node of nodes) {
				if (node === dragNode || node.id === selfNodeId) continue;
				node.vx *= damping;
				node.vy *= damping;
				node.x += node.vx;
				node.y += node.vy;
			}

			// Pin self node to center
			const selfNode = nodes.find((n) => n.id === selfNodeId);
			if (selfNode) {
				selfNode.x = cx;
				selfNode.y = cy;
				selfNode.vx = 0;
				selfNode.vy = 0;
			}
		} else {
			// Lerp towards target positions
			for (const node of nodes) {
				if (node === dragNode) continue;
				node.vx = (node.tx - node.x) * 0.08;
				node.vy = (node.ty - node.y) * 0.08;
				node.x += node.vx;
				node.y += node.vy;
			}
		}

		// Advance trails (fade out)
		for (let i = trails.length - 1; i >= 0; i--) {
			trails[i].age += TRAIL_FADE_SPEED;
			if (trails[i].age >= 1) {
				trails.splice(i, 1);
			}
		}
	}

	// ── Drawing ──
	function draw() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const dpr = devicePixelRatio;

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);

		refreshColors();
		const { mint, arctic, line, fg, fgDim, fontDisplay, fontMono } = _colors;

		// Apply camera
		ctx.save();
		ctx.translate(w / 2, h / 2);
		ctx.scale(camZoom, camZoom);
		ctx.translate(-w / 2 + camX, -h / 2 + camY);

		const n = nodes.length;
		const showLabels = camZoom >= 0.5 && n < 500;
		const showIds = camZoom >= 0.9 && n < 200;
		const linkDist = n > 200 ? 150 : n > 80 ? 250 : 300;

		// ── Cluster backgrounds ──
		if (layoutMode === 'cluster') {
			const groups = new Map<string, GNode[]>();
			for (const node of nodes) {
				const list = groups.get(node.company) ?? [];
				list.push(node);
				groups.set(node.company, list);
			}
			for (const [company, members] of groups) {
				if (members.length < 2) continue;
				let gx = 0, gy = 0;
				for (const m of members) { gx += m.x; gy += m.y; }
				gx /= members.length;
				gy /= members.length;
				let maxR = 0;
				for (const m of members) {
					const d = Math.hypot(m.x - gx, m.y - gy);
					if (d > maxR) maxR = d;
				}
				ctx.beginPath();
				ctx.arc(gx, gy, maxR + 25, 0, Math.PI * 2);
				ctx.fillStyle = mint + '08';
				ctx.strokeStyle = mint + '18';
				ctx.lineWidth = 1;
				ctx.fill();
				ctx.stroke();
				// Company label for cluster
				if (showLabels) {
					ctx.font = `500 10px ${fontMono}`;
					ctx.fillStyle = fgDim;
					ctx.textAlign = 'center';
					ctx.fillText(company, gx, gy - maxR - 10);
				}
			}
		}

		// ── Links — spatial grid, O(n * k) where k = nearby nodes ──
		if (n <= 300) {
			const grid = buildSpatialGrid(nodes, linkDist);
			ctx.lineWidth = 0.4;
			const drawn = new Set<string>();
			for (const node of nodes) {
				const nearby = getNearbyNodes(grid, node, linkDist, linkDist);
				for (const other of nearby) {
					// In cluster mode, only within company or to kraftcert
					if (layoutMode === 'cluster') {
						if (node.company !== other.company && !node.isKraftcert && !other.isKraftcert) continue;
					}
					// Dedup
					const key = node.id < other.id ? `${node.id}|${other.id}` : `${other.id}|${node.id}`;
					if (drawn.has(key)) continue;
					drawn.add(key);

					const dx = other.x - node.x, dy = other.y - node.y;
					const dist = Math.sqrt(dx * dx + dy * dy);
					const alpha = Math.max(0.03, 1 - dist / linkDist);
					ctx.strokeStyle = line + Math.round(alpha * 180).toString(16).padStart(2, '0');
					ctx.beginPath();
					ctx.moveTo(node.x, node.y);
					ctx.lineTo(other.x, other.y);
					ctx.stroke();
				}
			}
		} else if (selectedId) {
			// 600+ nodes: only draw links to selected
			const sel = nodes.find((n) => n.id === selectedId);
			if (sel) {
				const grid = buildSpatialGrid(nodes, linkDist);
				const nearby = getNearbyNodes(grid, sel, linkDist, linkDist * 2);
				ctx.strokeStyle = arctic + '40';
				ctx.lineWidth = 1;
				for (const n of nearby) {
					ctx.beginPath();
					ctx.moveTo(sel.x, sel.y);
					ctx.lineTo(n.x, n.y);
					ctx.stroke();
				}
			}
		}

		// ── Nodes ──
		// Pre-batch: draw all circles, then all labels (reduces context switches)
		const nodeRadius = n > 200 ? 6 : n > 80 ? 9 : 12;
		const kraftRadius = n > 200 ? 10 : n > 80 ? 14 : 18;

		for (const node of nodes) {
			const isSelected = node.id === selectedId;
			const r = node.isKraftcert ? kraftRadius : nodeRadius;
			const color = node.isStale ? fgDim : node.isKraftcert ? arctic : mint;
			const opacity = node.isStale ? 0.4 : 1;

			ctx.globalAlpha = opacity;

			// Glow for selected / kraftcert
			if (isSelected || (node.isKraftcert && !node.isStale)) {
				ctx.beginPath();
				ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2);
				const grad = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r + 8);
				grad.addColorStop(0, color + '30');
				grad.addColorStop(1, 'transparent');
				ctx.fillStyle = grad;
				ctx.fill();
			}

			// Circle
			ctx.beginPath();
			ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
			ctx.fillStyle = isSelected ? color + '40' : color + '18';
			ctx.fill();
			ctx.strokeStyle = isSelected ? fg : color;
			ctx.lineWidth = isSelected ? 2 : 0.8;
			ctx.stroke();

			// Inner dot
			ctx.beginPath();
			ctx.arc(node.x, node.y, Math.max(2, r * 0.25), 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();

			ctx.globalAlpha = 1;
		}

		// Labels pass (only if zoom allows)
		if (showLabels) {
			ctx.font = `600 ${Math.min(11, 11 / Math.max(camZoom, 0.5))}px ${fontDisplay}`;
			ctx.textAlign = 'center';
			for (const node of nodes) {
				const r = node.isKraftcert ? kraftRadius : nodeRadius;
				ctx.fillStyle = node.isStale ? fgDim : fg;
				ctx.globalAlpha = node.isStale ? 0.4 : 1;
				ctx.fillText(node.company, node.x, node.y + r + 14);
				ctx.globalAlpha = 1;
			}
		}
		if (showIds) {
			ctx.font = `10px ${fontMono}`;
			ctx.fillStyle = fgDim;
			ctx.textAlign = 'center';
			for (const node of nodes) {
				const r = node.isKraftcert ? kraftRadius : nodeRadius;
				ctx.fillText(node.id, node.x, node.y + r + 26);
			}
		}

		// ── Trails (gossip path arcs) ──
		for (const trail of trails) {
			// Resolve path node positions
			const points: { x: number; y: number }[] = [];
			for (const id of trail.path) {
				const node = nodes.find((n) => n.id === id);
				if (node) points.push({ x: node.x, y: node.y });
			}
			if (points.length < 2) continue;

			const alpha = Math.max(0, 1 - trail.age);
			ctx.globalAlpha = alpha;
			ctx.strokeStyle = trail.color;
			ctx.lineWidth = trail.lineWidth;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			ctx.beginPath();
			drawCatmullRomPath(ctx, points, trail.curveDir);
			ctx.stroke();

			// Source node flash (ring) — only in first 30% of trail life
			if (trail.age < 0.3) {
				const src = points[0];
				const flashAlpha = (1 - trail.age / 0.3) * 0.6;
				const ringRadius = 12 + trail.age * 30;
				ctx.globalAlpha = flashAlpha;
				ctx.beginPath();
				ctx.arc(src.x, src.y, ringRadius, 0, Math.PI * 2);
				ctx.strokeStyle = trail.color;
				ctx.lineWidth = 2;
				ctx.stroke();
			}

			// Self node (last point) brief pulse
			if (trail.age < 0.2) {
				const self = points[points.length - 1];
				const pulseAlpha = (1 - trail.age / 0.2) * 0.4;
				ctx.globalAlpha = pulseAlpha;
				ctx.beginPath();
				ctx.arc(self.x, self.y, 8 + trail.age * 20, 0, Math.PI * 2);
				ctx.strokeStyle = trail.color;
				ctx.lineWidth = 1.5;
				ctx.stroke();
			}

			ctx.globalAlpha = 1;
		}

		ctx.restore();

		// ── HUD ──
		ctx.font = `10px ${fontMono}`;
		ctx.fillStyle = fgDim;
		ctx.textAlign = 'left';
		const onlineCount = nodes.filter(n => !n.isStale).length;
		ctx.fillText(`${Math.round(camZoom * 100)}%  ·  ${n} peers  ·  ${onlineCount} online`, 12, h - 12);
	}

	function loop() {
		simulate();
		draw();
		raf = requestAnimationFrame(loop);
	}

	// ── Hit testing ──
	function findNode(sx: number, sy: number): GNode | undefined {
		const [wx, wy] = screenToWorld(sx, sy);
		const n = nodes.length;
		const hitR = n > 200 ? 14 : n > 80 ? 18 : 22;
		// Check in reverse (top-drawn nodes first)
		for (let i = nodes.length - 1; i >= 0; i--) {
			const node = nodes[i];
			if (Math.hypot(node.x - wx, node.y - wy) < hitR) return node;
		}
		return undefined;
	}

	// ── Mouse handlers ──
	function onMouseDown(e: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;
		const n = findNode(sx, sy);
		if (n) {
			dragNode = n;
			canvas.style.cursor = 'grabbing';
		} else {
			isPanning = true;
			panStartX = e.clientX;
			panStartY = e.clientY;
			panStartCamX = camX;
			panStartCamY = camY;
			canvas.style.cursor = 'grabbing';
		}
	}

	function onMouseMove(e: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;

		if (isPanning) {
			camX = panStartCamX + (e.clientX - panStartX) / camZoom;
			camY = panStartCamY + (e.clientY - panStartY) / camZoom;
			hoverNode = null;
			return;
		}
		if (dragNode) {
			const [wx, wy] = screenToWorld(sx, sy);
			dragNode.x = wx;
			dragNode.y = wy;
			dragNode.vx = 0;
			dragNode.vy = 0;
			hoverNode = null;
			return;
		}
		const n = findNode(sx, sy);
		canvas.style.cursor = n ? 'pointer' : 'grab';
		hoverNode = n ?? null;
		tooltipX = e.clientX - rect.left;
		tooltipY = e.clientY - rect.top;
	}

	function onMouseUp(e: MouseEvent) {
		if (isPanning) {
			isPanning = false;
			canvas.style.cursor = 'grab';
			return;
		}
		if (dragNode) {
			const rect = canvas.getBoundingClientRect();
			const n = findNode(e.clientX - rect.left, e.clientY - rect.top);
			if (n && onselect) onselect(n.id);
			dragNode = null;
			canvas.style.cursor = 'grab';
		}
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		const factor = e.deltaY > 0 ? 0.9 : 1.1;
		camZoom = Math.max(0.1, Math.min(5, camZoom * factor));
	}

	function resetView() {
		camX = 0;
		camY = 0;
		camZoom = nodes.length > 50 ? Math.max(0.25, 20 / Math.sqrt(nodes.length)) : 1;
	}

	// ── Lifecycle ──
	$effect(() => {
		resize();
		const ro = new ResizeObserver(resize);
		if (canvas.parentElement) ro.observe(canvas.parentElement);
		raf = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});

	let tooltipDetail = $derived(camZoom < 0.6 ? 1 : camZoom < 1.2 ? 2 : 3);
</script>

<div class="topo-wrap">
	<canvas
		bind:this={canvas}
		onmousedown={onMouseDown}
		onmousemove={onMouseMove}
		onmouseup={onMouseUp}
		onmouseleave={() => { dragNode = null; isPanning = false; hoverNode = null; }}
		onwheel={onWheel}
	></canvas>

	{#if hoverNode}
		<div
			class="tooltip"
			style:left="{tooltipX + 14}px"
			style:top="{tooltipY - 10}px"
		>
			<div class="tooltip__head">
				<span class="tooltip__dot" class:stale={hoverNode.isStale}></span>
				<span class="tooltip__company">{hoverNode.company}</span>
				{#if hoverNode.isKraftcert}
					<span class="tooltip__tag">KraftCERT</span>
				{/if}
			</div>
			<div class="tooltip__id">{hoverNode.id}</div>
			<div class="tooltip__row">
				<span class="tooltip__label">{m.status_online()}/{m.status_offline()}</span>
				<span>{hoverNode.isStale ? m.status_offline() : m.status_online()}</span>
			</div>
			<div class="tooltip__row">
				<span class="tooltip__label">{m.peer_last_seen()}</span>
				<span>{timeAgo(hoverNode.lastSeenAt)}</span>
			</div>
			{#if tooltipDetail >= 2}
				<div class="tooltip__row">
					<span class="tooltip__label">{m.peer_registered_by()}</span>
					<span>{hoverNode.registeredBy}</span>
				</div>
			{/if}
			{#if tooltipDetail >= 3}
				<div class="tooltip__row">
					<span class="tooltip__label">{m.peer_registered()}</span>
					<span>{fmtDateTime(hoverNode.registeredAt)}</span>
				</div>
			{/if}
		</div>
	{/if}

	<div class="topo-controls">
		<SegmentedControl options={layouts} value={layoutMode} onchange={(v) => layoutMode = v} size="xs" />
		<div class="topo-zoom glass--controls">
			<button class="topo-zbtn" onclick={() => { camZoom = Math.min(5, camZoom * 1.3); }}>+</button>
			<button class="topo-zbtn" onclick={() => { camZoom = Math.max(0.1, camZoom * 0.7); }}>&minus;</button>
			<button class="topo-zbtn" onclick={resetView}>&#x2302;</button>
		</div>
	</div>
</div>

<style>
	.topo-wrap {
		flex: 1;
		position: relative;
		overflow: hidden;
		min-height: 300px;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		cursor: grab;
	}
	canvas:active {
		cursor: grabbing;
	}
	.topo-controls {
		position: absolute;
		bottom: 10px;
		right: 10px;
		display: flex;
		gap: 6px;
		z-index: 10;
	}
	.topo-zoom {
		display: flex;
		gap: 2px;
		border-radius: 4px;
		padding: 2px;
	}
	.topo-zbtn {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 3px;
		background: none;
		color: var(--color-fg-dim);
		cursor: pointer;
		transition: color 0.15s, background 0.15s;
	}
	.topo-zbtn:hover {
		color: var(--color-fg);
		background: rgb(from var(--color-aurora-mint) r g b / 0.08);
	}
	.tooltip {
		position: absolute;
		pointer-events: none;
		z-index: 20;
		background: rgb(from var(--color-bg) r g b / 0.92);
		backdrop-filter: blur(12px);
		border: 1px solid var(--color-line-hi);
		border-radius: 6px;
		padding: 10px 14px;
		min-width: 180px;
		max-width: 280px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.tooltip__head {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.tooltip__dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--color-success);
		box-shadow: 0 0 6px var(--color-success);
		flex-shrink: 0;
	}
	.tooltip__dot.stale {
		background: var(--color-line-hi);
		box-shadow: none;
	}
	.tooltip__company {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.88rem;
	}
	.tooltip__tag {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-aurora-arctic);
		background: rgb(from var(--color-aurora-arctic) r g b / 0.12);
		border: 1px solid rgb(from var(--color-aurora-arctic) r g b / 0.25);
		padding: 1px 6px;
		border-radius: 3px;
	}
	.tooltip__id {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--color-fg-dim);
	}
	.tooltip__row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 0.75rem;
	}
	.tooltip__label {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--color-fg-dim);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
</style>
