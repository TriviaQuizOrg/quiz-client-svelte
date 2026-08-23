import {
	signInWithEmailAndPassword,
	signOut,
	onAuthStateChanged,
	sendPasswordResetEmail,
	type User as FirebaseUser
} from 'firebase/auth';
import { requireAuth, firebaseConfigured } from '$lib/firebase';

function nameFromEmail(email: string): string {
	const local = email.split('@')[0]?.replace(/[._]+/g, ' ').trim() || 'Admin';
	return local.replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapFirebaseError(err: unknown): string {
	const code = (err as { code?: string } | null)?.code ?? '';
	switch (code) {
		case 'auth/invalid-credential':
		case 'auth/invalid-email':
		case 'auth/user-not-found':
		case 'auth/wrong-password':
			return 'Incorrect email or password.';
		case 'auth/too-many-requests':
			return 'Too many attempts. Try again in a few minutes.';
		case 'auth/network-request-failed':
			return 'Network error — check your connection and try again.';
		case 'auth/user-disabled':
			return 'This admin account has been disabled.';
		default:
			return 'Something went wrong. Please try again.';
	}
}

class AuthStore {
	firebaseUser = $state<FirebaseUser | null>(null);
	// Firebase restores a persisted session asynchronously — pages must wait for this to
	// go false before deciding whether to redirect, or a real logged-in admin gets
	// briefly bounced to /login on every reload.
	initializing = $state(true);

	get isAuthenticated() {
		return this.firebaseUser !== null;
	}

	get email() {
		return this.firebaseUser?.email ?? '';
	}

	get displayName() {
		if (!this.firebaseUser) return '';
		return this.firebaseUser.displayName || nameFromEmail(this.firebaseUser.email ?? '');
	}

	constructor() {
		if (firebaseConfigured) {
			onAuthStateChanged(requireAuth(), (user) => {
				this.firebaseUser = user;
				this.initializing = false;
			});
		} else {
			// No admin Firebase project configured yet — surface that clearly rather than
			// hanging on a spinner forever.
			this.initializing = false;
		}
	}

	async login(email: string, password: string): Promise<void> {
		const trimmedEmail = email.trim();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
			throw new Error('Enter a valid email address.');
		}
		try {
			await signInWithEmailAndPassword(requireAuth(), trimmedEmail, password);
		} catch (err) {
			throw new Error(mapFirebaseError(err), { cause: err });
		}
	}

	async logout(): Promise<void> {
		await signOut(requireAuth());
	}

	/**
	 * Sends Firebase's own password-reset email — Firebase generates the reset link and
	 * hosts the reset page itself, same as login/logout, no backend involvement.
	 */
	async sendPasswordReset(email: string): Promise<void> {
		const trimmedEmail = email.trim();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
			throw new Error('Enter a valid email address.');
		}
		try {
			await sendPasswordResetEmail(requireAuth(), trimmedEmail);
		} catch (err) {
			const code = (err as { code?: string } | null)?.code ?? '';
			if (code === 'auth/user-not-found') {
				throw new Error('No admin account found with that email.', { cause: err });
			}
			throw new Error(mapFirebaseError(err), { cause: err });
		}
	}

	/** Fresh ID token for the Authorization header — Firebase silently refreshes as needed. */
	async getIdToken(): Promise<string | null> {
		if (!this.firebaseUser) return null;
		return this.firebaseUser.getIdToken();
	}
}

export const auth = new AuthStore();
