/** Shared error class used by both client and server API layers. */
export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly body: string
	) {
		super(`api ${status}: ${body.slice(0, 200)}`);
	}
}
