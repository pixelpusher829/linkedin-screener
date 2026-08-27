import express from "express";
import { randomBytes } from "node:crypto";
import {
	ADMIN_EMAIL,
	GOOGLE_CLIENT_ID,
	oauthClient,
	OAUTH_STATE_COOKIE,
	SESSION_COOKIE,
	SESSION_MAX_AGE_SECONDS,
} from "../config";
import {
	clearCookie,
	createSignedSession,
	getSessionEmail,
	oauthConfigured,
	setCookie,
	signValue,
} from "../services/auth.service";

export const authRouter = express.Router();

authRouter.get("/admin-login", (_req, res) => {
	if (!oauthConfigured())
		return res.status(503).send("Google authentication is not configured.");
	const nonce = randomBytes(24).toString("base64url");
	setCookie(res, OAUTH_STATE_COOKIE, `${nonce}.${signValue(nonce)}`, 10 * 60);
	res.redirect(
		oauthClient!.generateAuthUrl({
			access_type: "online",
			prompt: "select_account",
			scope: ["openid", "email", "profile"],
			state: nonce,
		}),
	);
});

authRouter.get("/admin-callback", async (req, res) => {
	try {
		if (!oauthClient || !oauthConfigured())
			return res.redirect("/admin?error=not-configured");
		const cookie = req.headers.cookie
			?.split(";")
			.map((part) => part.trim())
			.find((part) => part.startsWith(`${OAUTH_STATE_COOKIE}=`))
			?.slice(OAUTH_STATE_COOKIE.length + 1);
		const state = typeof req.query.state === "string" ? req.query.state : "";
		if (!cookie || cookie !== `${state}.${signValue(state)}`)
			return res.redirect("/admin?error=invalid-state");
		const { tokens } = await oauthClient.getToken(String(req.query.code || ""));
		const ticket = await oauthClient.verifyIdToken({
			idToken: tokens.id_token!,
			audience: GOOGLE_CLIENT_ID,
		});
		const email = ticket.getPayload()?.email?.toLowerCase();
		if (!email || email !== ADMIN_EMAIL)
			return res.redirect("/admin?error=unauthorized");
		setCookie(
			res,
			SESSION_COOKIE,
			createSignedSession(email),
			SESSION_MAX_AGE_SECONDS,
		);
		clearCookie(res, OAUTH_STATE_COOKIE);
		res.redirect("/admin?authenticated=1");
	} catch {
		res.redirect("/admin?error=oauth-failed");
	}
});

authRouter.get("/admin-session", (req, res) => {
	const email = getSessionEmail(req);
	res.json({ authenticated: Boolean(email && email === ADMIN_EMAIL), email });
});

authRouter.post("/admin-logout", (_req, res) => {
	clearCookie(res, SESSION_COOKIE);
	res.json({ success: true });
});
