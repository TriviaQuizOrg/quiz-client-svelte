import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
	PUBLIC_FIREBASE_API_KEY,
	PUBLIC_FIREBASE_AUTH_DOMAIN,
	PUBLIC_FIREBASE_PROJECT_ID,
	PUBLIC_FIREBASE_APP_ID
} from '$env/static/public';

// Deliberately the ADMIN CONSOLE Firebase project — a separate project from the player
// app, per quiz-server's design (see internal/firebaseauth). Never point this at the
// player project's config.
export const firebaseConfigured =
	!!PUBLIC_FIREBASE_API_KEY && !!PUBLIC_FIREBASE_PROJECT_ID && !!PUBLIC_FIREBASE_APP_ID;

let authInstance: Auth | null = null;

if (firebaseConfigured) {
	const app: FirebaseApp =
		getApps()[0] ??
		initializeApp({
			apiKey: PUBLIC_FIREBASE_API_KEY,
			authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
			projectId: PUBLIC_FIREBASE_PROJECT_ID,
			appId: PUBLIC_FIREBASE_APP_ID
		});
	authInstance = getAuth(app);
}

/** Throws a clear error rather than letting a null-auth call fail cryptically deeper in the SDK. */
export function requireAuth(): Auth {
	if (!authInstance) {
		throw new Error(
			'Firebase is not configured — set PUBLIC_FIREBASE_* in .env (see .env.example) to the admin console project.'
		);
	}
	return authInstance;
}
