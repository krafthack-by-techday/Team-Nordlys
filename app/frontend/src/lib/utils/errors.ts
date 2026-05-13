/**
 * Maps backend error codes to user-friendly Norwegian messages.
 *
 * RULE: Raw backend error codes must NEVER be shown to users.
 * Always use this utility to translate error responses before displaying them.
 *
 * Usage:
 *   import { mapError } from '$lib/utils/errors';
 *   error = mapError(data.error);
 */

const messages: Record<string, string> = {
	// Auth
	invalid_credentials: 'Feil e-post eller passord.',
	unauthenticated: 'Du må logge inn for å fortsette.',
	invalid_api_key: 'Ugyldig API-nøkkel.',

	// Setup
	setup_already_completed: 'Oppsettet er allerede fullført. Logg inn i stedet.',
	no_pending_setup: 'Ingen ventende oppsett funnet.',
	invalid_code: 'Feil verifiseringskode.',
	code_expired: 'Verifiseringskoden er utløpt. Be om en ny.',
	too_many_attempts: 'For mange forsøk. Vent litt før du prøver igjen.',
	field_immutable: 'Denne verdien kan ikke endres etter oppsett.',
	localhost_only: 'Denne handlingen kan kun utføres lokalt på noden.',

	// Mesh / Registration
	invalid_or_expired_invite: 'Invitasjonskoden er ugyldig eller utløpt.',
	company_mismatch: 'Organisasjonsnavnet samsvarer ikke med invitasjonen.',
	invalid_signature: 'Signaturen kunne ikke verifiseres. Tilgangsforespørselen er ugyldig.',
	kraftcert_role_required: 'Denne handlingen krever KraftCERT-rollen.',
	accept_rate_exceeded: 'For mange tilgangsforespørsler godkjent på kort tid. Prøv igjen senere.',
	rate_cap_exceeded: 'Rate-grensen er nådd. Prøv igjen senere.',
	peer_not_found: 'Fant ingen node med denne identifikatoren.',

	// Scan / target
	target_not_whitelisted: 'Målet er ikke godkjent for skanning.',

	// Generic
	validation_failed: 'Inndata er ugyldig. Sjekk feltene og prøv igjen.',
	core_svc_error: 'Kjernen svarer ikke som forventet. Prøv igjen, eller kontakt support hvis feilen vedvarer.',
	internal_error: 'Noe gikk galt på serveren. Prøv igjen, eller kontakt support hvis feilen vedvarer.',
	not_found: 'Ressursen ble ikke funnet.',
};

/**
 * Translates a backend error code to a user-friendly Norwegian message.
 * Falls back to a generic message if the code is unknown.
 */
export function mapError(code: string | undefined | null): string {
	if (!code) return 'En uventet feil oppstod. Prøv igjen.';
	return messages[code] ?? 'En uventet feil oppstod. Prøv igjen.';
}
