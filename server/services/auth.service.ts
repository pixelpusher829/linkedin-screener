import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
	ADMIN_EMAIL,
	oauthClient,
	SESSION_COOKIE,
	SESSION_SECRET,
} from "../config";

export function signValue(value: string): string {
	return createHmac("sha256", SESSION_SECRET || "")
		.update(value)
		.digest("base64url");
}

export function createSignedSession(email: string): string {
	const payload = Buffer.from(
		JSON.stringify({
			email,
			exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
		}),
	).toString("base64url");
	return `${payload}.${signValue(payload)}`;
}

export function getSessionEmail(req: express.Request): string | null {
	if (!SESSION_SECRET) return null;
	const raw = req.headers.cookie
		?.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${SESSION_COOKIE}=`))
		?.slice(SESSION_COOKIE.length + 1);
	if (!raw) return null;
	const [payload, signature] = raw.split(".");
	if (!payload || !signature) return null;
	const expected = signValue(payload);
	if (signature.length !== expected.length) return null;
	if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
		return null;
	try {
		const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
		return parsed.exp > Math.floor(Date.now() / 1000) ? parsed.email : null;
	} catch {
		return null;
	}
}

export function isAdminSession(req: express.Request): boolean {
	return (
		!!ADMIN_EMAIL && !!SESSION_SECRET && getSessionEmail(req) === ADMIN_EMAIL
	);
}

export function oauthConfigured() {
	return Boolean(oauthClient && ADMIN_EMAIL && SESSION_SECRET);
}

export function setCookie(
	res: express.Response,
	name: string,
	value: string,
	maxAge: number,
) {
	const cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
	const current = res.getHeader("Set-Cookie");
	const cookies = Array.isArray(current)
		? [...current.map(String), cookie]
		: current
			? [String(current), cookie]
			: [cookie];
	res.setHeader("Set-Cookie", cookies);
}

export function clearCookie(res: express.Response, name: string) {
	setCookie(res, name, "", 0);
}
