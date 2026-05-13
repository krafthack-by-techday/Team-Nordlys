/**
 * Web Audio API alert sounds for the live event feed.
 * AudioContext is only created on first user gesture to avoid browser warnings.
 */

let audioCtx: AudioContext | null = null;
let unlocked = false;

function playTone(freq: number, duration: number, count = 1, gap = 0.12): void {
	if (!unlocked || !audioCtx) return;
	const ctx = audioCtx;
	for (let i = 0; i < count; i++) {
		const start = ctx.currentTime + i * (duration + gap);
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.frequency.value = freq;
		osc.type = 'sine';
		gain.gain.setValueAtTime(0.22, start);
		gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
		osc.start(start);
		osc.stop(start + duration);
	}
}

/** Play an alert tone matching the given severity. */
export function alertSound(severity: string): void {
	switch (severity.toLowerCase()) {
		case 'critical':
			playTone(880, 0.12, 4, 0.08);
			break;
		case 'high':
			playTone(660, 0.15, 2, 0.12);
			break;
		case 'medium':
			playTone(520, 0.2, 1);
			break;
		case 'low':
			playTone(400, 0.25, 1);
			break;
	}
}

/** Call once on user gesture (click/keydown) to create and unlock AudioContext. */
export function unlockAudio(): void {
	if (unlocked) return;
	try {
		if (!audioCtx) audioCtx = new AudioContext();
		audioCtx.resume().then(() => {
			unlocked = true;
		});
	} catch {
		// Audio not supported
	}
}
