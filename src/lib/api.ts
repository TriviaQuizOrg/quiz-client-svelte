import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { auth } from '$lib/stores/auth.svelte';

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	const token = await auth.getIdToken();

	const headers = new Headers(init.headers);
	if (init.body) headers.set('Content-Type', 'application/json');
	if (token) headers.set('Authorization', `Bearer ${token}`);

	const res = await fetch(`${PUBLIC_API_BASE_URL}${path}`, { ...init, headers });

	if (!res.ok) {
		let message = res.statusText || `Request failed (${res.status})`;
		try {
			const body = await res.json();
			if (body?.error) message = body.error;
		} catch {
			// non-JSON error body — keep the status-text fallback
		}
		throw new ApiError(res.status, message);
	}

	if (res.status === 204) return undefined as T;

	const contentType = res.headers.get('content-type') ?? '';
	if (!contentType.includes('application/json')) return undefined as T;

	return (await res.json()) as T;
}

export const api = {
	get: <T>(path: string) => request<T>(path),
	post: <T>(path: string, body?: unknown) =>
		request<T>(path, {
			method: 'POST',
			body: body !== undefined ? JSON.stringify(body) : undefined
		}),
	patch: <T>(path: string, body?: unknown) =>
		request<T>(path, {
			method: 'PATCH',
			body: body !== undefined ? JSON.stringify(body) : undefined
		}),
	put: <T>(path: string, body?: unknown) =>
		request<T>(path, {
			method: 'PUT',
			body: body !== undefined ? JSON.stringify(body) : undefined
		})
};

// --- backend quirk helpers ---
// quiz-server currently JSON-encodes Go's sql.NullString/sql.NullTime/sql.NullInt32
// directly on most admin endpoints instead of mapping them to a plain nullable value —
// they arrive as {"String": "...", "Valid": bool} / {"Time": "...", "Valid": bool} rather
// than a plain string/ISO-date-or-null. (uuid.NullUUID fields don't have this problem —
// google/uuid marshals those as a plain string or null already.) Worth fixing backend-side
// eventually since the Flutter player app will hit the exact same shape; unwrapping here
// keeps this integration moving without a mid-task backend refactor.
export interface GoNullString {
	String: string;
	Valid: boolean;
}
export interface GoNullTime {
	Time: string;
	Valid: boolean;
}
export interface GoNullInt {
	Int32?: number;
	Int64?: number;
	Valid: boolean;
}
export interface GoNullBool {
	Bool: boolean;
	Valid: boolean;
}
// pqtype.NullRawMessage has the same problem, wrapped around an already-decoded JSON
// object rather than a string: {"RawMessage": {...}, "Valid": bool}.
export interface GoNullRawMessage {
	RawMessage: unknown;
	Valid: boolean;
}

export function unwrapStr(n: GoNullString | null | undefined): string | null {
	return n?.Valid ? n.String : null;
}
export function unwrapTime(n: GoNullTime | null | undefined): string | null {
	return n?.Valid ? n.Time : null;
}
export function unwrapInt(n: GoNullInt | null | undefined): number | null {
	if (!n?.Valid) return null;
	return n.Int32 ?? n.Int64 ?? null;
}
export function unwrapBool(n: GoNullBool | null | undefined): boolean | null {
	return n?.Valid ? n.Bool : null;
}
export function unwrapRawMessage(n: GoNullRawMessage | null | undefined): unknown {
	return n?.Valid ? n.RawMessage : null;
}

/**
 * Downloads a file from an authenticated endpoint — plain <a href> links can't carry the
 * Bearer token, so this fetches as a blob and triggers the save via a throwaway object URL.
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
	const token = await auth.getIdToken();
	const headers = new Headers();
	if (token) headers.set('Authorization', `Bearer ${token}`);

	const res = await fetch(`${PUBLIC_API_BASE_URL}${path}`, { headers });
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText || `Request failed (${res.status})`);
	}

	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

/** paise (backend's unit) -> whole-rupee number (frontend's formatINR expects this). */
export function paiseToRupees(paise: number): number {
	return Math.round(paise) / 100;
}
