import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";

dotenv.config();

export const PORT = 3000;
export const APP_URL = (
	process.env.APP_URL || `http://localhost:${PORT}`
).replace(/\/+$/, "");
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.toLowerCase();
export const SESSION_SECRET = process.env.SESSION_SECRET;
export const SESSION_COOKIE = "linkedin_screener_session";
export const OAUTH_STATE_COOKIE = "linkedin_screener_oauth_state";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const oauthClient =
	GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
		? new OAuth2Client(
				GOOGLE_CLIENT_ID,
				GOOGLE_CLIENT_SECRET,
				`${APP_URL}/api/admin-callback`,
			)
		: null;
