import express from "express";
import path from "path";
import { isIP } from "node:net";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { GoogleGenAI, Type } from "@google/genai";
import { OAuth2Client } from "google-auth-library";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

const app = express();
export { app };
const PORT = 3000;
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(
	/\/+$/,
	"",
);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.toLowerCase();
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_COOKIE = "linkedin_screener_session";
const OAUTH_STATE_COOKIE = "linkedin_screener_oauth_state";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const oauthClient =
	GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
		? new OAuth2Client(
				GOOGLE_CLIENT_ID,
				GOOGLE_CLIENT_SECRET,
				`${APP_URL}/api/admin-callback`,
			)
		: null;

app.use(express.json({ limit: "2mb" }));

// Vercel invokes the handler without the /api prefix.
if (process.env.VERCEL) {
	app.use((req, _res, next) => {
		if (!req.url.startsWith("/api")) req.url = `/api${req.url}`;
		next();
	});
}

const requestCounts = new Map<string, { count: number; resetAt: number }>();
app.use("/api", (req, res, next) => {
	const now = Date.now();
	const key = req.ip || "unknown";
	const current = requestCounts.get(key);
	if (!current || current.resetAt <= now) {
		requestCounts.set(key, { count: 1, resetAt: now + 60_000 });
		return next();
	}
	if (current.count >= 60)
		return res
			.status(429)
			.json({ error: "Too many requests. Try again shortly." });
	current.count += 1;
	next();
});

function signValue(value: string): string {
	return createHmac("sha256", SESSION_SECRET || "")
		.update(value)
		.digest("base64url");
}

function createSignedSession(email: string): string {
	const payload = Buffer.from(
		JSON.stringify({
			email,
			exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
		}),
	).toString("base64url");
	return `${payload}.${signValue(payload)}`;
}
export { createSignedSession };

function getSessionEmail(req: express.Request): string | null {
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

function isAdminSession(req: express.Request): boolean {
	return (
		!!ADMIN_EMAIL && !!SESSION_SECRET && getSessionEmail(req) === ADMIN_EMAIL
	);
}

function oauthConfigured() {
	return Boolean(oauthClient && ADMIN_EMAIL && SESSION_SECRET);
}

function setCookie(
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

function clearCookie(res: express.Response, name: string) {
	setCookie(res, name, "", 0);
}

app.get("/api/admin-login", (_req, res) => {
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

app.get("/api/admin-callback", async (req, res) => {
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

app.get("/api/admin-session", (req, res) => {
	const email = getSessionEmail(req);
	res.json({ authenticated: Boolean(email && email === ADMIN_EMAIL), email });
});

app.post("/api/admin-logout", (_req, res) => {
	clearCookie(res, SESSION_COOKIE);
	res.json({ success: true });
});

function isPublicHttpUrl(rawUrl: string): boolean {
	try {
		const parsed = new URL(rawUrl);
		if (
			!["http:", "https:"].includes(parsed.protocol) ||
			parsed.username ||
			parsed.password
		)
			return false;
		const hostname = parsed.hostname.toLowerCase();
		if (hostname === "localhost" || hostname.endsWith(".localhost"))
			return false;
		if (
			isIP(hostname) === 6 &&
			(hostname === "::1" || /^(fc|fd|fe8)/.test(hostname))
		)
			return false;
		if (isIP(hostname) === 4) {
			const octets = hostname.split(".").map(Number);
			if (octets[0] === 10 || octets[0] === 127 || octets[0] === 0)
				return false;
			if (octets[0] === 169 && octets[1] === 254) return false;
			if (octets[0] === 192 && octets[1] === 168) return false;
			if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return false;
		}
		return true;
	} catch {
		return false;
	}
}

async function fetchPublicUrl(url: string, init: RequestInit = {}) {
	let currentUrl = url;
	for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
		if (!isPublicHttpUrl(currentUrl))
			throw new Error("Only public HTTP(S) URLs are allowed.");
		const response = await fetch(currentUrl, {
			...init,
			redirect: "manual",
		});
		if (response.status < 300 || response.status >= 400) return response;
		const location = response.headers.get("location");
		if (!location) return response;
		currentUrl = new URL(location, currentUrl).toString();
	}
	throw new Error("Too many redirects.");
}

// Lazy/Safe Gemini AI client
function getGeminiClient(): GoogleGenAI {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error("GEMINI_API_KEY environment variable is missing.");
	}
	return new GoogleGenAI({
		apiKey,
		httpOptions: {
			headers: {
				"User-Agent": "aistudio-build",
			},
		},
	});
}

// Helper to clean scraped text
function cleanText(txt: string): string {
	return txt
		.replace(/\r\n|\r/g, "\n")
		.replace(/\t/g, " ")
		.replace(/\s{2,}/g, " ")
		.trim();
}

// Helper to extract LinkedIn Job ID from various URL formats
function extractLinkedInJobId(url: string): string | null {
	try {
		const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);

		// 1. Check query param: ?currentJobId=4123456789
		const currentJobId = parsed.searchParams.get("currentJobId");
		if (currentJobId && /^\d{8,14}$/.test(currentJobId)) {
			return currentJobId;
		}

		// 2. Check path: /jobs/view/4123456789 or /jobs/view/slug-name-4123456789
		const viewMatch = parsed.pathname.match(
			/\/jobs\/view\/(?:[a-zA-Z0-9\-_]+-)?(\d{8,14})/,
		);
		if (viewMatch) {
			return viewMatch[1];
		}

		// 3. Check any 8-14 digit number in path if hostname is linkedin.com
		if (parsed.hostname.includes("linkedin.com")) {
			const anyNumMatch = parsed.pathname.match(/(\d{8,14})/);
			if (anyNumMatch) {
				return anyNumMatch[1];
			}
		}
	} catch (e) {
		// Regex match directly on string as fallback
		const directMatch = url.match(
			/(?:currentJobId=|\/jobs\/view\/|\/jobs\/view\/[a-zA-Z0-9\-_]+-)(\d{8,14})/,
		);
		if (directMatch) return directMatch[1];
	}
	return null;
}

// Helper to infer title and company from a URL slug if blocked
function inferDetailsFromUrl(rawUrl: string): {
	title?: string;
	company?: string;
} {
	try {
		const parsed = new URL(
			rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`,
		);
		const pathname = parsed.pathname;

		// e.g. /jobs/view/senior-frontend-engineer-at-stripe-4129841021
		const matchAt = pathname.match(/\/jobs\/view\/(.+?)-at-(.+?)(?:-\d+)?$/i);
		if (matchAt) {
			const title = matchAt[1]
				.replace(/-/g, " ")
				.replace(/\b\w/g, (c) => c.toUpperCase());
			const company = matchAt[2]
				.replace(/-/g, " ")
				.replace(/\b\w/g, (c) => c.toUpperCase());
			return { title, company };
		}

		// Greenhouse format: /company-name/jobs/12345
		const ghMatch = pathname.match(/\/([a-zA-Z0-9\-_]+)\/jobs\/\d+/i);
		if (ghMatch && parsed.hostname.includes("greenhouse")) {
			const company = ghMatch[1]
				.replace(/-/g, " ")
				.replace(/\b\w/g, (c) => c.toUpperCase());
			return { company };
		}

		// Lever format: /company-name/job-uuid
		const leverMatch = pathname.match(/\/([a-zA-Z0-9\-_]+)\/[a-f0-9\-]+/i);
		if (leverMatch && parsed.hostname.includes("lever.co")) {
			const company = leverMatch[1]
				.replace(/-/g, " ")
				.replace(/\b\w/g, (c) => c.toUpperCase());
			return { company };
		}
	} catch (e) {}
	return {};
}

// Scrape a LinkedIn Job using the public Guest API
async function scrapeLinkedInJobGuest(jobId: string, originalUrl: string) {
	const guestUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
	const response = await fetch(guestUrl, {
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
			Accept:
				"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.9",
		},
		signal: AbortSignal.timeout(9000),
	});

	if (!response.ok) {
		throw new Error(`LinkedIn Guest API returned ${response.status}`);
	}

	const html = await response.text();
	const $ = cheerio.load(html);

	// 1. JSON-LD schema
	let schemaData: any = null;
	$('script[type="application/ld+json"]').each((_, el) => {
		try {
			const parsed = JSON.parse($(el).text());
			if (
				parsed["@type"] === "JobPosting" ||
				parsed["@type"]?.includes?.("JobPosting")
			) {
				schemaData = parsed;
			} else if (Array.isArray(parsed)) {
				const item = parsed.find((p) => p["@type"] === "JobPosting");
				if (item) schemaData = item;
			}
		} catch (e) {}
	});

	// Extract Title
	let title =
		schemaData?.title ||
		$(
			".top-card-layout__title, .topcard__title, h1.top-card-layout__title, h2.top-card-layout__title",
		)
			.first()
			.text()
			.trim();

	// Extract Company
	let company =
		schemaData?.hiringOrganization?.name ||
		$(
			".topcard__org-name-link, .top-card-layout__first-subline a, .topcard__flavor--black-link",
		)
			.first()
			.text()
			.trim();

	// Extract Location
	let location = "";
	if (schemaData?.jobLocation) {
		const loc = schemaData.jobLocation;
		if (typeof loc === "string") location = loc;
		else if (loc.address) {
			location = [
				loc.address.addressLocality,
				loc.address.addressRegion,
				loc.address.addressCountry,
			]
				.filter(Boolean)
				.join(", ");
		}
	}
	if (!location) {
		location = $(
			".topcard__flavor--bullet, .top-card-layout__first-subline span.topcard__flavor:nth-of-type(2)",
		)
			.first()
			.text()
			.trim();
	}
	const headerText = $(
		".top-card-layout__first-subline, .topcard__first-subline, .topcard__flavor",
	)
		.text()
		.toLowerCase();

	// Extract Salary
	let salaryRaw = "";
	if (schemaData?.baseSalary?.value) {
		const val = schemaData.baseSalary.value;
		salaryRaw =
			typeof val === "number"
				? `$${val.toLocaleString()}`
				: `${val.minValue || ""} - ${val.maxValue || ""} ${val.unitText || ""}`.trim();
	}
	if (!salaryRaw) {
		const salaryEl = $(".compensation__salary, .salary").first().text().trim();
		if (salaryEl) salaryRaw = salaryEl;
	}

	// Extract Description Body
	let bodyText = "";
	const descEl = $(
		".show-more-less-html__markup, .description__text, section.show-more-less-html",
	);
	if (descEl.length > 0) {
		bodyText = cleanText(descEl.text());
	}
	if (!bodyText && schemaData?.description) {
		bodyText = cleanText(cheerio.load(schemaData.description).text());
	}

	// Extract Criteria items (Seniority, Employment Type, Job Function, Industries)
	const criteriaList: string[] = [];
	$(".description__job-criteria-item").each((_, el) => {
		const subheader = $(el)
			.find(".description__job-criteria-subheader")
			.text()
			.trim();
		const text = $(el).find(".description__job-criteria-text").text().trim();
		if (subheader && text) criteriaList.push(`${subheader}: ${text}`);
	});

	if (criteriaList.length > 0) {
		bodyText = `${bodyText}\n\nJob Details:\n${criteriaList.join("\n")}`.trim();
	}

	// Fallback title / company from slug if empty
	if (!title || !company) {
		const slugInferred = inferDetailsFromUrl(originalUrl);
		if (!title && slugInferred.title) title = slugInferred.title;
		if (!company && slugInferred.company) company = slugInferred.company;
	}

	const isRemote =
		headerText.includes("remote") ||
		location.toLowerCase().includes("remote") ||
		schemaData?.jobLocationType === "TELECOMMUTE";
	const isHybrid =
		!isRemote &&
		(headerText.includes("hybrid") ||
			location.toLowerCase().includes("hybrid"));

	return {
		url: `https://www.linkedin.com/jobs/view/${jobId}/`,
		title: title || "LinkedIn Opportunity",
		company: company || "Hiring Company",
		location: location || (isRemote ? "Remote" : "Unspecified"),
		headerRaw: [
			title,
			company,
			location,
			isRemote ? "Remote" : isHybrid ? "Hybrid" : "",
		]
			.filter(Boolean)
			.join(" · "),
		workplaceType: (isRemote
			? "Remote"
			: isHybrid
				? "Hybrid"
				: "Unknown") as any,
		salaryRaw: salaryRaw || undefined,
		descriptionRaw:
			bodyText.slice(0, 6000) ||
			`${title || "Job"} at ${company || "Company"}. Extracted from LinkedIn.`,
		success: true,
	};
}

// Scrape a general / ATS job page (Greenhouse, Lever, Indeed, Workable, etc.)
async function scrapeGeneralJob(cleanUrl: string) {
	const response = await fetchPublicUrl(cleanUrl, {
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
			Accept:
				"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.9",
		},
		signal: AbortSignal.timeout(9000),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	const html = await response.text();
	const $ = cheerio.load(html);

	// 1. JSON-LD schema
	let schemaData: any = null;
	$('script[type="application/ld+json"]').each((_, el) => {
		try {
			const parsed = JSON.parse($(el).text());
			if (
				parsed["@type"] === "JobPosting" ||
				parsed["@type"]?.includes?.("JobPosting")
			) {
				schemaData = parsed;
			} else if (Array.isArray(parsed)) {
				const item = parsed.find((p) => p["@type"] === "JobPosting");
				if (item) schemaData = item;
			}
		} catch (e) {}
	});

	// OpenGraph / Meta tags
	const ogTitle =
		$('meta[property="og:title"]').attr("content") || $("title").text() || "";
	const ogDesc =
		$('meta[property="og:description"]').attr("content") ||
		$('meta[name="description"]').attr("content") ||
		"";
	const ogSiteName = $('meta[property="og:site_name"]').attr("content") || "";

	// Title
	let title = schemaData?.title || "";
	if (!title && ogTitle) {
		title = ogTitle.split("|")[0].split(" - ")[0].split(" at ")[0].trim();
	}
	if (!title) {
		title = $("h1, .job-title, .posting-headline, .app-title")
			.first()
			.text()
			.trim();
	}

	// Company
	let company =
		schemaData?.hiringOrganization?.name ||
		$('meta[property="og:article:author"]').attr("content") ||
		"";
	if (!company && ogTitle.includes(" at ")) {
		company =
			ogTitle.split(" at ")[1]?.split("|")[0]?.split(" - ")[0]?.trim() || "";
	}
	if (
		!company &&
		ogSiteName &&
		!ogSiteName.toLowerCase().includes("linkedin") &&
		!ogSiteName.toLowerCase().includes("greenhouse") &&
		!ogSiteName.toLowerCase().includes("lever")
	) {
		company = ogSiteName;
	}
	if (!company) {
		company = $(".company-name, .org-name, .employer").first().text().trim();
	}

	// Location
	let location = "";
	if (schemaData?.jobLocation) {
		const loc = schemaData.jobLocation;
		if (typeof loc === "string") location = loc;
		else if (loc.address) {
			location = [
				loc.address.addressLocality,
				loc.address.addressRegion,
				loc.address.addressCountry,
			]
				.filter(Boolean)
				.join(", ");
		}
	}
	if (!location) {
		location = $(
			".location, .workplace-type, .job-location, .posting-categories .location",
		)
			.first()
			.text()
			.trim();
	}

	// Salary
	let salaryRaw = "";
	if (schemaData?.baseSalary?.value) {
		const val = schemaData.baseSalary.value;
		salaryRaw =
			typeof val === "number"
				? `$${val.toLocaleString()}`
				: `${val.minValue || ""} - ${val.maxValue || ""} ${val.unitText || ""}`.trim();
	}

	// Description Body
	let bodyText = "";
	const descriptionSelectors = [
		".show-more-less-html__markup",
		".description__text",
		"#job-details",
		".job-description",
		"#content",
		".content",
		".section-page",
		"article",
		"main",
	];

	for (const sel of descriptionSelectors) {
		const matched = $(sel);
		if (matched.length > 0) {
			bodyText = cleanText(matched.text());
			if (bodyText.length > 100) break;
		}
	}

	if (!bodyText || bodyText.length < 50) {
		bodyText = cleanText(ogDesc || $("body").text().slice(0, 3000));
	}

	// Fallbacks from URL slug
	const slugInferred = inferDetailsFromUrl(cleanUrl);
	if (!title && slugInferred.title) title = slugInferred.title;
	if (!company && slugInferred.company) company = slugInferred.company;

	const isRemote =
		bodyText.toLowerCase().includes("remote") ||
		location.toLowerCase().includes("remote") ||
		schemaData?.jobLocationType === "TELECOMMUTE";
	const isHybrid =
		bodyText.toLowerCase().includes("hybrid") ||
		location.toLowerCase().includes("hybrid");

	return {
		url: cleanUrl,
		title: title || "Job Opportunity",
		company: company || "Hiring Company",
		location: location || (isRemote ? "Remote" : "Unspecified"),
		workplaceType: (isRemote
			? "Remote"
			: isHybrid
				? "Hybrid"
				: "On-site") as any,
		salaryRaw: salaryRaw || undefined,
		descriptionRaw:
			bodyText.slice(0, 6000) ||
			`${title || "Job"} at ${company || "Company"}.`,
		success: true,
	};
}

async function fetchJobDescriptionForAnswer(
	url: string,
): Promise<string | null> {
	const cleanUrl = url.trim();
	if (!cleanUrl) return null;

	const linkedInJobId = extractLinkedInJobId(cleanUrl);
	if (linkedInJobId) {
		try {
			const linkedInJob = await scrapeLinkedInJobGuest(linkedInJobId, cleanUrl);
			if (linkedInJob.descriptionRaw?.trim()) {
				return linkedInJob.descriptionRaw.trim();
			}
		} catch (error) {
			console.warn("Could not refresh LinkedIn job description:", error);
		}
	}

	try {
		const scrapedJob = await scrapeGeneralJob(cleanUrl);
		return scrapedJob.descriptionRaw?.trim() || null;
	} catch (error) {
		console.warn("Could not refresh job description from URL:", error);
		return null;
	}
}

// Endpoint 1: Scrape / Extract details from URLs (LinkedIn & General ATS)
app.post("/api/scrape-urls", async (req, res) => {
	try {
		const body = req.body ?? {};
		const rawUrls = Array.isArray(body) ? body : body.urls;
		const urls = Array.isArray(rawUrls)
			? rawUrls.filter((url): url is string => typeof url === "string")
			: [];
		if (urls.length === 0) {
			return res
				.status(400)
				.json({ error: "Please provide a list of URLs to scrape." });
		}

		const results = [];

		for (const rawUrl of urls.slice(0, 30)) {
			const cleanUrl = rawUrl.trim();
			if (!cleanUrl) continue;
			if (!isPublicHttpUrl(cleanUrl)) {
				results.push({
					url: cleanUrl,
					success: false,
					error: "Only public HTTP(S) URLs are allowed.",
				});
				continue;
			}

			try {
				const linkedInJobId = extractLinkedInJobId(cleanUrl);

				if (linkedInJobId) {
					// Use the LinkedIn Guest API which is reliable and bypasses the authwall
					try {
						const jobData = await scrapeLinkedInJobGuest(
							linkedInJobId,
							cleanUrl,
						);
						results.push(jobData);
						continue;
					} catch (guestErr: any) {
						console.warn(
							`LinkedIn guest scrape failed for ID ${linkedInJobId}:`,
							guestErr.message,
						);
						// Fall through to general scraping or slug inference
					}
				}

				// General scraping
				try {
					const generalJob = await scrapeGeneralJob(cleanUrl);
					results.push(generalJob);
				} catch (directErr: any) {
					// If direct fetch was blocked, extract what we can from the URL structure
					const inferred = inferDetailsFromUrl(cleanUrl);
					results.push({
						url: cleanUrl,
						title: inferred.title || "Job Opportunity",
						company: inferred.company || "Hiring Organization",
						location: "Unspecified",
						workplaceType: "Unknown",
						descriptionRaw: `Opportunity from ${cleanUrl}. Direct scrape restricted; ready for evaluation.`,
						success: true,
					});
				}
			} catch (err: any) {
				// Safe fallback record
				const inferred = inferDetailsFromUrl(cleanUrl);
				results.push({
					url: cleanUrl,
					title: inferred.title || "Job Posting",
					company: inferred.company || "Company",
					location: "Unspecified",
					workplaceType: "Unknown",
					descriptionRaw: `Job link: ${cleanUrl}`,
					success: true,
				});
			}
		}

		res.json({ results });
	} catch (error: any) {
		console.error("Error in /api/scrape-urls:", error);
		res.status(200).json({
			results: [],
			warning: error.message || "Failed to scrape URLs; please try again.",
		});
	}
});

// Endpoint 2: Parse raw pasted text, JSON, or HTML from LinkedIn Job Tracker / Saved Jobs
app.post("/api/parse-tracker-text", async (req, res) => {
	try {
		const { content } = req.body as { content: string };
		if (!content || !content.trim()) {
			return res.status(400).json({ error: "Content is required" });
		}

		const trimmed = content.trim();

		// 1. Direct JSON check
		if (
			trimmed.startsWith("[") ||
			(trimmed.startsWith("{") && trimmed.includes('"title"'))
		) {
			try {
				const directJson = JSON.parse(trimmed);
				const arrayData = Array.isArray(directJson)
					? directJson
					: directJson.jobs || [directJson];
				const normalized = arrayData.map((item: any) => ({
					title: item.title || "Job Opportunity",
					company: item.company || "Company",
					location: item.location || "Remote / Unspecified",
					workplaceType:
						item.workplaceType ||
						(item.location?.toLowerCase().includes("remote")
							? "Remote"
							: item.location?.toLowerCase().includes("hybrid")
								? "Hybrid"
								: "Unknown"),
					salaryRaw: item.salaryRaw || undefined,
					url: item.url || "https://www.linkedin.com/jobs",
					descriptionSummary:
						item.descriptionRaw ||
						item.descriptionSummary ||
						`${item.title} at ${item.company}`,
				}));
				return res.json({ jobs: normalized });
			} catch (e) {
				// Not valid JSON, continue to AI/regex parser
			}
		}

		// 2. Try Gemini AI parsing if API key is available (admin session only,
		// since it spends the admin's Gemini quota — everyone else falls through
		// to the free regex/HTML extractor below).
		if (process.env.GEMINI_API_KEY && isAdminSession(req)) {
			try {
				const ai = getGeminiClient();

				const response = await ai.models.generateContent({
					model: "gemini-3.7-flash",
					contents: `You are an expert data parser extracting job postings from user-pasted LinkedIn Job Tracker text, HTML snippets, or bulleted job lists.
Extract each distinct job posting into a structured JSON array.

Input Text / HTML:
"""
${trimmed.slice(0, 15000)}
"""

If a field like salary, workplace type, or url is missing, provide a reasonable estimate or leave undefined. Ensure job links are preserved if present in URLs or href attributes.`,
					config: {
						responseMimeType: "application/json",
						responseSchema: {
							type: Type.ARRAY,
							items: {
								type: Type.OBJECT,
								properties: {
									title: { type: Type.STRING },
									company: { type: Type.STRING },
									location: { type: Type.STRING },
									workplaceType: {
										type: Type.STRING,
										enum: ["Remote", "Hybrid", "On-site", "Unknown"],
									},
									salaryRaw: { type: Type.STRING },
									url: { type: Type.STRING },
									descriptionSummary: { type: Type.STRING },
								},
								required: ["title", "company", "location", "workplaceType"],
							},
						},
					},
				});

				const parsed = JSON.parse(response.text || "[]");
				if (Array.isArray(parsed) && parsed.length > 0) {
					return res.json({ jobs: parsed });
				}
			} catch (aiErr: any) {
				console.warn(
					"Gemini parse-tracker-text failed, falling back to local extractor:",
					aiErr.message,
				);
			}
		}

		// 3. Resilient Local Cheerio/Regex Fallback (Extracts HTML cards and links)
		const localJobs: any[] = [];
		const $ = cheerio.load(trimmed);

		// Look for LinkedIn cards in HTML
		const cards = $(
			".entity-result, .job-card-container, .reusable-search__result-container, li",
		);
		if (cards.length > 0) {
			cards.each((_, el) => {
				const card = $(el);
				const link = card
					.find(
						'a[href*="/jobs/view/"], a.job-card-list__title, a.job-card-container__link, a[href*="currentJobId="]',
					)
					.first();
				const titleText = card
					.find(".entity-result__title-text, .job-card-list__title, h3, h4")
					.first()
					.text()
					.replace(/\s+/g, " ")
					.trim();
				const companyText = card
					.find(
						".entity-result__primary-subtitle, .job-card-container__company-name, .artdeco-entity-lockup__subtitle",
					)
					.first()
					.text()
					.trim();
				const locationText = card
					.find(
						".entity-result__secondary-subtitle, .job-card-container__metadata-item",
					)
					.first()
					.text()
					.trim();
				const cardText = card.text().replace(/\s+/g, " ").trim().toLowerCase();
				const isRemoteInHeader = cardText.includes("remote");
				const isHybridInHeader =
					!isRemoteInHeader && cardText.includes("hybrid");

				const rawHref = link.attr("href") || "";
				let cleanUrl = rawHref;
				const jobId = extractLinkedInJobId(rawHref);
				if (jobId) {
					cleanUrl = `https://www.linkedin.com/jobs/view/${jobId}/`;
				}

				if (titleText && titleText.length > 3) {
					localJobs.push({
						title: titleText.split("\n")[0].trim(),
						company: companyText || "LinkedIn Company",
						location:
							isRemoteInHeader && !locationText.toLowerCase().includes("remote")
								? `${locationText || "Unspecified"} (Remote)`
								: locationText || "Unspecified",
						workplaceType: isRemoteInHeader
							? "Remote"
							: isHybridInHeader
								? "Hybrid"
								: "Unknown",
						url: cleanUrl || "https://www.linkedin.com/jobs",
						descriptionSummary: `${titleText} at ${companyText || "Company"}. ${locationText}`,
					});
				}
			});
		}

		// If still empty, look for URLs in plain text
		if (localJobs.length === 0) {
			const urlMatches = trimmed.match(/https?:\/\/[^\s"'<>]+/g) || [];
			const uniqueUrls = [...new Set(urlMatches)];
			for (const u of uniqueUrls) {
				const inferred = inferDetailsFromUrl(u);
				localJobs.push({
					title: inferred.title || "Job Opportunity",
					company: inferred.company || "Hiring Company",
					location: "Remote / Unspecified",
					workplaceType: "Remote",
					url: u,
					descriptionSummary: `Opportunity from ${u}`,
				});
			}
		}

		res.json({ jobs: localJobs });
	} catch (error: any) {
		console.error("Error parsing tracker text:", error);
		res
			.status(500)
			.json({ error: error.message || "Failed to parse tracker text" });
	}
});

// Helper: Clean raw concatenated LinkedIn strings
function cleanLinkedInJobMeta(
	rawTitle: string,
	rawCompany: string,
	rawLocation: string,
	rawWorkplaceType: string,
) {
	let title = rawTitle || "Software Opportunity";
	let company = rawCompany || "Hiring Company";
	let location = rawLocation || "Remote / Unspecified";
	let workplaceType = rawWorkplaceType || "Unknown";

	// If title has metadata like "Senior Frontend Engineer Rush Street Interactive · Canada (Remote)Reposted 1w ago"
	if (
		title.includes("·") ||
		title.includes("Posted") ||
		title.includes("Reposted") ||
		title.includes("Promoted")
	) {
		const dotParts = title.split("·");
		if (dotParts.length >= 2) {
			const leftPart = dotParts[0].trim();
			const rightPart = dotParts.slice(1).join("·").trim();

			// Clean right part: remove "Posted ... ago", "Reposted ... ago", "Promoted", etc.
			const locMatch = rightPart
				.replace(/(?:Re)?posted\s+[^·\n]+/gi, "")
				.replace(/Promoted/gi, "")
				.trim();
			if (locMatch) {
				location = locMatch;
				if (locMatch.toLowerCase().includes("remote")) workplaceType = "Remote";
				else if (locMatch.toLowerCase().includes("hybrid"))
					workplaceType = "Hybrid";
				else if (
					locMatch.toLowerCase().includes("on-site") ||
					locMatch.toLowerCase().includes("onsite")
				)
					workplaceType = "On-site";
			}

			if (
				company === "LinkedIn Company" ||
				company === "Hiring Company" ||
				!company
			) {
				const titleRegex =
					/^(.*?(?:Engineer|Developer|Architect|Designer|Manager|Lead|Specialist|Consultant|Programmer|VP|Director))\s*(.*?)$/i;
				const match = leftPart.match(titleRegex);
				if (match && match[1] && match[2] && match[2].length > 1) {
					title = match[1].trim();
					company = match[2].trim();
				} else {
					title = leftPart;
				}
			} else {
				title = leftPart;
			}
		} else {
			title = title
				.replace(/(?:Re)?posted\s+[^·\n]+/gi, "")
				.replace(/Promoted/gi, "")
				.trim();
		}
	}

	return { title, company, location, workplaceType };
}

// Deterministic, Comprehensive Local Heuristic Qualification Engine
function getScoreBands(criteria: any) {
	const scoreBands = criteria.weighting?.scoreBands || {};
	const pruneBelow = Math.max(
		0,
		Math.min(99, Number(scoreBands.pruneBelow ?? 55)),
	);
	const keepAt = Math.max(
		pruneBelow + 1,
		Math.min(
			100,
			Number(
				scoreBands.keepAt ??
					criteria.weighting?.scoreWeights?.strongKeepThreshold ??
					78,
			),
		),
	);
	return { pruneBelow, keepAt };
}

export function evaluateJobHeuristically(
	job: any,
	criteria: any,
	contextDoc?: string,
) {
	const descriptionText = job.descriptionRaw || job.descriptionSummary || "";
	const fullText =
		`${job.title} ${job.company} ${job.location} ${job.workplaceType} ${job.headerRaw || ""} ${job.salaryRaw || ""} ${descriptionText}`.toLowerCase();
	const titleLower = (job.title || "").toLowerCase();
	const locLower = (job.location || "").toLowerCase();
	const workplaceLower = (job.workplaceType || "").toLowerCase();
	const homeLoc = (
		criteria.locationPreferences?.homeLocation || "Montreal, QC"
	).toLowerCase();
	const homeCity = homeLoc.split(",")[0].trim().toLowerCase();

	// Start conservatively: a job must earn its way into the shortlist. This avoids
	// generic software-engineering roles becoming matches through keyword overlap.
	const weighting = criteria.weighting || {};
	const scoreBands = getScoreBands(criteria);

	const weights = {
		base: 30,
		remote: 0,
		canada: 0,
		usRemote: 0,
		midLevel: 10,
		unspecifiedSeniority: 8,
		senior: 4,
		leadStaff: -4,
		strictEducation: -20,
		requiredSkill: 3,
		niceSkill: 1,
		missingRequiredSkill: -3,
		junior: -25,
		homeLocation: 20,
		nonLocalOnsite: -40,
		salaryAbove: 10,
		salaryWithin: 5,
		salaryBelow: -20,
		strongKeepThreshold: 78,
		...(weighting.scoreWeights || {}),
	};
	let score = weights.base;
	const scoreBreakdown: { label: string; points: number }[] = [];
	const addScore = (label: string, points: number) => {
		score += points;
		if (points !== 0) scoreBreakdown.push({ label, points });
	};
	const keyPros: string[] = [];
	const keyCons: string[] = [];
	const dealbreakerTriggers: string[] = [];
	const matchedSkills: string[] = [];
	const missingSkills: string[] = [];
	// Only treat a hardcoded red-flag phrase as an actual dealbreaker (and cap the
	// score) if the user has opted into that category themselves; otherwise it's
	// just informational so it doesn't silently override their scorecard weights.
	const configuredDealbreakers = (criteria.dealbreakers || []).map(
		(d: string) => d.toLowerCase(),
	);
	const hasDealbreaker = (...keywords: string[]) =>
		configuredDealbreakers.some((d: string) =>
			keywords.some((k) => d.includes(k)),
		);

	// 1. Role alignment — reward a job title matching one of the user's own
	// target job titles. Title weights are fully user-configurable (see the
	// "Target Job Titles" rubric section); there is no hardcoded title bucketing.
	const targetTitles: string[] = criteria.targetJobTitles || [];
	let titleMatched = false;
	for (const t of targetTitles) {
		const tWords = t
			.toLowerCase()
			.split(/\s+/)
			.filter((w: string) => w.length > 2);
		const matchingWords = tWords.filter((w: string) => titleLower.includes(w));
		if (
			matchingWords.length >= 2 ||
			(tWords.length === 1 && matchingWords.length === 1)
		) {
			titleMatched = true;
			addScore(`Title: ${t}`, weighting.titleWeights?.[t] ?? 10);
			keyPros.push(`High role title alignment with "${t}"`);
			break;
		}
	}
	if (!titleMatched && targetTitles.length > 0) {
		keyCons.push("Job title doesn't match any of your target job titles");
	}

	const isSeniorTitle =
		titleLower.includes("senior") || titleLower.includes("sr.");
	const isLeadOrStaffTitle =
		titleLower.includes("lead") ||
		titleLower.includes("staff") ||
		titleLower.includes("principal") ||
		titleLower.includes("architect");
	const isMidTitle =
		titleLower.includes("mid-level") ||
		titleLower.includes("mid level") ||
		titleLower.includes("intermediate") ||
		titleLower.includes("level 2") ||
		titleLower.includes(" ii");
	const isJuniorTitle =
		titleLower.includes("junior") ||
		titleLower.includes("intern") ||
		titleLower.includes("entry level") ||
		titleLower.includes("jr.");

	let experienceFit:
		| "Matches"
		| "Slight Stretch"
		| "Overqualified"
		| "Underqualified" = "Matches";
	if (isMidTitle) {
		addScore("Seniority: mid-level", weights.midLevel);
		keyPros.push("Mid-level scope matches the preferred seniority band");
	} else if (isSeniorTitle) {
		addScore("Seniority: senior", weights.senior);
		keyPros.push("Seniority level matches target profile");
		experienceFit = "Matches";
	} else if (isJuniorTitle) {
		addScore("Seniority: junior", weights.junior);
		keyCons.push("Junior / entry-level role below target seniority");
		experienceFit = "Overqualified";
		if (
			criteria.dealbreakers?.some(
				(d: string) =>
					d.toLowerCase().includes("junior") ||
					d.toLowerCase().includes("intern"),
			)
		) {
			dealbreakerTriggers.push(
				"Junior / Internship position below seniority target",
			);
		}
	} else if (isLeadOrStaffTitle) {
		addScore("Seniority: lead/staff", weights.leadStaff);
		keyCons.push(
			"Lead/staff scope may be more architecture or management-heavy than the preferred band",
		);
		experienceFit = "Slight Stretch";
	} else {
		addScore("Seniority: unspecified", weights.unspecifiedSeniority);
		keyPros.push(
			"Unspecified seniority is a preferred opportunity to assess scope directly",
		);
	}

	// 2. Location & Remote Assessment (CRITICAL)
	let locationFit:
		| "Matches Remote/Location"
		| "Location Mismatch"
		| "Unspecified" = "Unspecified";
	const isHomeLocation =
		locLower.includes(homeCity) || (homeLoc && locLower.includes(homeLoc));
	const isRemote =
		workplaceLower.includes("remote") ||
		locLower.includes("remote") ||
		(job.headerRaw || "").toLowerCase().includes("remote");
	const isHybrid =
		!isRemote &&
		(workplaceLower.includes("hybrid") ||
			locLower.includes("hybrid") ||
			(job.headerRaw || "").toLowerCase().includes("hybrid"));
	const isOnSite =
		!isRemote &&
		!isHybrid &&
		(workplaceLower.includes("on-site") ||
			workplaceLower.includes("onsite") ||
			workplaceLower.includes("in-person") ||
			fullText.includes(" on-site") ||
			fullText.includes(" onsite") ||
			fullText.includes(" in-person"));

	const locationWeights = weighting.locationWeights || {};
	const workTypeWeights = weighting.workTypeWeights || {};
	const matchedLocation = Object.keys(locationWeights).find((location) =>
		locLower.includes(location.toLowerCase()),
	);
	const isContract =
		fullText.includes("contract") ||
		fullText.includes("1099") ||
		fullText.includes("corp-to-corp");

	if (isHomeLocation) {
		addScore("Location: home area", weights.homeLocation);
		keyPros.push(
			`Located in home metropolitan area (${criteria.locationPreferences?.homeLocation || "Montreal, QC"})`,
		);
		locationFit = "Matches Remote/Location";
	} else if (isRemote) {
		addScore("Work type: remote", workTypeWeights.Remote ?? weights.remote);
		keyPros.push("100% Remote flexibility matching remote preference");
		locationFit = "Matches Remote/Location";

		if (
			locLower.includes("canada") ||
			locLower.includes("on (remote)") ||
			locLower.includes("qc (remote)") ||
			locLower.includes("bc (remote)") ||
			locLower.includes("ottawa") ||
			locLower.includes("toronto") ||
			locLower.includes("waterloo")
		) {
			addScore(
				"Location: Canada",
				locationWeights[matchedLocation || "Canada"] ??
					locationWeights["Canada Remote"] ??
					weights.canada,
			);
			keyPros.push("Direct Canadian domestic hiring jurisdiction");
		} else if (
			locLower.includes("united states") ||
			locLower.includes("usa") ||
			locLower.includes("us (remote)")
		) {
			addScore(
				"Location: United States",
				locationWeights[matchedLocation || "United States"] ??
					locationWeights["US Remote (EOR/Contract)"] ??
					weights.usRemote,
			);
			keyPros.push(
				"US-based remote role (accessible via Canadian contractor/EOR or international remote)",
			);
		}
	} else if (isHybrid || isOnSite) {
		locationFit = "Location Mismatch";
		dealbreakerTriggers.push(
			`Mandatory in-person / hybrid attendance outside home metro (${job.location})`,
		);
		keyCons.push(
			`Requires on-site/hybrid attendance in ${job.location}, violating 100% remote requirement outside home city.`,
		);
		addScore(
			"Location: non-local in-person dealbreaker",
			weights.nonLocalOnsite,
		);
	}

	if (
		matchedLocation &&
		isRemote &&
		!locLower.includes("canada") &&
		!locLower.includes("united states") &&
		!locLower.includes("usa") &&
		!locLower.includes("us (remote)")
	) {
		addScore(
			`Location: ${matchedLocation}`,
			locationWeights[matchedLocation] ?? 0,
		);
	}
	if (isRemote && isHomeLocation)
		addScore("Work type: remote", workTypeWeights.Remote ?? weights.remote);
	if (isHybrid) addScore("Work type: hybrid", workTypeWeights.Hybrid ?? 0);
	if (isOnSite) addScore("Work type: onsite", workTypeWeights["On-site"] ?? 0);
	if (isContract)
		addScore("Work type: contract", workTypeWeights.Contract ?? 0);

	// Design-system, UX, and "heavy backend/platform" keyword signals are not built in
	// here since they only apply to a design/frontend-specific search — add them as
	// Custom Scoring Rules in the rubric UI instead so they stay editable per user.

	// 3. Tech Stack Matching
	const requiredTech: string[] = criteria.techStackRequired || [
		"React",
		"TypeScript",
		"Next.js",
		"Tailwind CSS",
	];
	let requiredSkillPoints = 0;
	for (const tech of requiredTech) {
		const techTerms = tech.toLowerCase().split(/\s*\/\s*/);
		if (techTerms.some((term: string) => fullText.includes(term))) {
			matchedSkills.push(tech);
			requiredSkillPoints +=
				weighting.skillWeights?.[tech] ?? weights.requiredSkill;
		} else {
			missingSkills.push(tech);
		}
	}
	addScore("Required skills", Math.min(18, requiredSkillPoints));
	if (matchedSkills.length >= 2) {
		keyPros.push(
			`Strong core stack overlap (${matchedSkills.slice(0, 4).join(", ")})`,
		);
	}
	if (missingSkills.length > 0) {
		addScore(
			"Missing required skills",
			Math.max(-18, missingSkills.length * weights.missingRequiredSkill),
		);
		keyCons.push(
			`Posting doesn't mention required skills: ${missingSkills.slice(0, 4).join(", ")}`,
		);
	}

	const niceTech: string[] = criteria.techStackNiceToHave || [
		"Svelte",
		"GSAP",
		"Design Systems",
		"TanStack Query",
	];
	let niceSkillPoints = 0;
	for (const tech of niceTech) {
		if (fullText.includes(tech.toLowerCase())) {
			matchedSkills.push(tech);
			niceSkillPoints += weighting.skillWeights?.[tech] ?? weights.niceSkill;
		}
	}

	addScore("Bonus skills", Math.min(6, niceSkillPoints));

	// 4. Dealbreaker Scans
	const strictDegreeRequirement =
		/(?:bachelor'?s|master'?s|b\.s\.|bsc|m\.s\.|msc|degree)\s+(?:degree\s+)?(?:in\s+)?(?:computer science|computer engineering|software engineering|related field)?[^.]{0,100}(?:required|must have|minimum requirement)/i.test(
			fullText,
		) &&
		!/(?:equivalent (?:practical )?experience|or equivalent experience|degree or equivalent)/i.test(
			fullText,
		);
	if (strictDegreeRequirement) {
		addScore("Strict education requirement", weights.strictEducation);
		keyCons.push(
			"Explicit CS/engineering degree requirement with no equivalent-experience path",
		);
		if (
			criteria.dealbreakers?.some(
				(d: string) =>
					d.toLowerCase().includes("strict") &&
					d.toLowerCase().includes("degree"),
			)
		) {
			dealbreakerTriggers.push("Strict CS Degree Requirement");
		}
	}
	if (
		fullText.includes("security clearance") ||
		fullText.includes("ts/sci") ||
		fullText.includes("us citizen only") ||
		fullText.includes("u.s. citizenship required") ||
		fullText.includes("dod clearance")
	) {
		keyCons.push("Requires active US security clearance or US citizenship");
		if (hasDealbreaker("us citizen", "clearance", "sponsorship")) {
			dealbreakerTriggers.push(
				"US Security Clearance / US Citizenship mandatory",
			);
			addScore("US clearance/citizenship restriction", -50);
		}
	}

	if (
		fullText.includes("must reside in the united states") ||
		fullText.includes("us residents only") ||
		fullText.includes("w2 only without c2c")
	) {
		keyCons.push(
			"Requires US domestic residency with no Canadian hiring mechanism",
		);
		if (hasDealbreaker("us w-2", "us citizen", "c2c", "1099")) {
			dealbreakerTriggers.push(
				"Strict US Resident/W2 restriction (Excludes Canadian residents)",
			);
			addScore("US residency restriction", -40);
		}
	}

	if (
		fullText.includes("wordpress") ||
		fullText.includes("php") ||
		fullText.includes("jquery") ||
		fullText.includes("drupal")
	) {
		if (!fullText.includes("react") && !fullText.includes("typescript")) {
			keyCons.push("Role revolves around legacy CMS/frameworks");
			if (hasDealbreaker("legacy stack", "legacy tech")) {
				dealbreakerTriggers.push("Legacy Tech Stack (PHP/WordPress/jQuery)");
				addScore("Legacy technology stack", -30);
			}
		}
	}

	if (
		fullText.includes("staffing agency") ||
		fullText.includes("third-party recruiter") ||
		fullText.includes("recruitment agency")
	) {
		keyCons.push(
			"Third-party agency posting rather than direct product engineering team",
		);
		if (hasDealbreaker("staffing agency")) {
			dealbreakerTriggers.push("Third-Party Staffing / Recruitment Agency");
			addScore("Staffing agency posting", -20);
		}
	}

	// 4b. Fully user-defined scoring rules (name + keywords + weight), so anyone can
	// add or remove their own criteria without touching code.
	const customSignals = weighting.customSignals || [];
	for (const signal of customSignals) {
		const keywords = (signal.keywords || [])
			.map((k) => k.trim().toLowerCase())
			.filter(Boolean);
		if (keywords.length === 0) continue;
		const matched = keywords.some((k) => fullText.includes(k));
		if (matched) {
			addScore(signal.name || "Custom rule", Number(signal.weight) || 0);
			if ((Number(signal.weight) || 0) < 0) {
				keyCons.push(`Matched custom rule: ${signal.name}`);
			} else if ((Number(signal.weight) || 0) > 0) {
				keyPros.push(`Matched custom rule: ${signal.name}`);
			}
		}
	}

	// 5. Salary Fit
	let salaryFit:
		| "Above Target"
		| "Within Target"
		| "Below Target"
		| "Not Disclosed" = "Not Disclosed";
	if (job.salaryRaw) {
		const salaryDigits = (
			job.salaryRaw.replace(/,/g, "").match(/\d{5,7}/g) || []
		).map(Number);
		if (salaryDigits.length > 0) {
			const maxSal = Math.max(...salaryDigits);
			const minSal = Math.min(...salaryDigits);
			const targetMin = criteria.minSalary || 100000;
			if (maxSal >= targetMin * 1.2) {
				salaryFit = "Above Target";
				addScore("Salary above floor", weights.salaryAbove);
				keyPros.push(
					`Compensation exceeds base target ($${maxSal.toLocaleString()} ${criteria.salaryCurrency || "CAD"})`,
				);
			} else if (maxSal >= targetMin || minSal >= targetMin * 0.9) {
				salaryFit = "Within Target";
				addScore("Salary near floor", weights.salaryWithin);
				keyPros.push(
					`Compensation aligns with base salary target ($${targetMin.toLocaleString()}+)`,
				);
			} else if (maxSal < targetMin * 0.85) {
				salaryFit = "Below Target";
				addScore("Salary below floor", weights.salaryBelow);
				keyCons.push(
					`Compensation (${job.salaryRaw}) is below minimum target of $${targetMin.toLocaleString()}`,
				);
				if (hasDealbreaker("below salary floor", "salary floor")) {
					dealbreakerTriggers.push(
						`Base salary below minimum floor ($${targetMin.toLocaleString()})`,
					);
				}
			}
		}
	}

	if (dealbreakerTriggers.length > 0) {
		const dealbreakerCap = Math.max(0, Math.min(45, scoreBands.pruneBelow - 1));
		if (score > dealbreakerCap)
			scoreBreakdown.push({
				label: "Dealbreaker score cap",
				points: dealbreakerCap - score,
			});
		score = Math.min(score, dealbreakerCap);
	}
	score = Math.max(15, Math.min(98, Math.round(score)));

	let verdict: "STRONG_KEEP" | "CONSIDER" | "REMOVE" = "CONSIDER";
	if (dealbreakerTriggers.length > 0 || score < scoreBands.pruneBelow) {
		verdict = "REMOVE";
	} else if (score >= scoreBands.keepAt) {
		verdict = "STRONG_KEEP";
	} else {
		verdict = "CONSIDER";
	}

	const confidence =
		matchedSkills.length > 0 || descriptionText.length > 200
			? "HIGH"
			: "MEDIUM";

	let oneSentenceSummary = "";
	if (verdict === "STRONG_KEEP") {
		oneSentenceSummary = `High-conviction match for ${job.title} at ${job.company} featuring strong technical stack overlap (${matchedSkills.slice(0, 3).join(", ") || "Frontend Engineering"}) and verified remote/location compatibility.`;
	} else if (verdict === "CONSIDER") {
		oneSentenceSummary = `Viable contender for ${job.title} at ${job.company}; exhibits good foundation with minor stack or scope considerations to verify.`;
	} else {
		const mainIssue =
			dealbreakerTriggers[0] ||
			keyCons[0] ||
			"Low criteria alignment with candidate profile";
		oneSentenceSummary = `Recommended for removal: Disqualified due to ${mainIssue.toLowerCase()}.`;
	}

	const yearsExp = criteria.yearsOfExperience || 5;
	const topRequiredSkills = (criteria.techStackRequired || []).slice(0, 3);
	const primaryTitle = criteria.targetJobTitles?.[0] || "this role";
	const stackSummary =
		topRequiredSkills.length > 0
			? topRequiredSkills.join(", ")
			: "the required technology stack";
	const tailoredPitch = `• ${yearsExp}+ years of production experience relevant to ${primaryTitle}, with hands-on depth in ${stackSummary}.\n• Track record aligned with this candidate's stated preferred industries and working style, per their context document.\n• Proven ability to deliver against the seniority level, scope, and remote/location preferences configured in this rubric.`;

	const actionRecommendation =
		verdict === "STRONG_KEEP"
			? `Apply immediately with a tailored resume highlighting ${stackSummary}.`
			: verdict === "CONSIDER"
				? "Review job description requirements and team scope before submitting application."
				: "Prune/discard from active screener to keep pipeline focused on high-fit opportunities.";

	return {
		score,
		scoreBreakdown,
		verdict,
		confidence,
		oneSentenceSummary,
		keyPros:
			keyPros.length > 0 ? keyPros : ["Relevant software engineering domain"],
		keyCons:
			keyCons.length > 0
				? keyCons
				: ["No material risks detected from the available posting details"],
		dealbreakerTriggers,
		matchedSkills,
		missingSkills,
		salaryFit,
		experienceFit,
		locationFit,
		tailoredPitch,
		resumeHighlights:
			matchedSkills.length > 0
				? matchedSkills
						.slice(0, 5)
						.map((skill) => `${yearsExp}+ years working with ${skill}`)
				: [`${yearsExp}+ years of relevant experience for ${primaryTitle}`],
		actionRecommendation,
	};
}

// /api/qualify-job and /api/qualify-batch are deterministic (no AI call) and free
// to use for anyone. /api/sync-rubric-from-context and /api/generate-applicant-answer
// gate their optional AI-powered path behind an admin session internally instead of
// blocking the whole endpoint, so non-admins still get the heuristic fallback for free.

// Endpoint 3: Qualify a Single Job against User Criteria & Context Doc
app.post("/api/qualify-job", async (req, res) => {
	try {
		const { job, criteria, contextDoc } = req.body;
		if (!job || !criteria) {
			return res.status(400).json({ error: "Job and Criteria are required" });
		}

		const cleaned = cleanLinkedInJobMeta(
			job.title,
			job.company,
			job.location,
			job.workplaceType,
		);
		let enrichedJob = { ...job, ...cleaned };

		const liId = extractLinkedInJobId(enrichedJob.url);
		if (liId) {
			try {
				const scraped = await scrapeLinkedInJobGuest(liId, enrichedJob.url);
				if (
					scraped.descriptionRaw &&
					(scraped.descriptionRaw.length > enrichedJob.descriptionRaw.length ||
						scraped.workplaceType !== enrichedJob.workplaceType)
				) {
					const isRemoteDetected =
						enrichedJob.workplaceType === "Remote" ||
						(job.title && job.title.toLowerCase().includes("remote")) ||
						(job.location && job.location.toLowerCase().includes("remote")) ||
						(scraped.location &&
							scraped.location.toLowerCase().includes("remote")) ||
						scraped.workplaceType === "Remote" ||
						(scraped.descriptionRaw &&
							(scraped.descriptionRaw.toLowerCase().includes("100% remote") ||
								scraped.descriptionRaw.toLowerCase().includes("fully remote")));

					enrichedJob = {
						...enrichedJob,
						title: scraped.title || enrichedJob.title,
						company:
							scraped.company !== "LinkedIn Company"
								? scraped.company
								: enrichedJob.company,
						location:
							isRemoteDetected &&
							!scraped.location.toLowerCase().includes("remote")
								? `${scraped.location} (Remote)`
								: scraped.location || enrichedJob.location,
						headerRaw: scraped.headerRaw || enrichedJob.headerRaw,
						workplaceType: isRemoteDetected
							? "Remote"
							: scraped.workplaceType || enrichedJob.workplaceType,
						salaryRaw: scraped.salaryRaw || enrichedJob.salaryRaw,
						descriptionRaw:
							scraped.descriptionRaw.length > enrichedJob.descriptionRaw.length
								? scraped.descriptionRaw
								: enrichedJob.descriptionRaw,
					};
				}
			} catch (e) {}
		}

		// Scores and verdicts must be deterministic: an LLM can explain a fit, but it
		// must not silently override the user's explicit weighting controls.
		const analysis = evaluateJobHeuristically(
			enrichedJob,
			criteria,
			contextDoc,
		);

		const scoreBands = getScoreBands(criteria);
		const verdict =
			analysis.verdict ||
			(analysis.score >= scoreBands.keepAt
				? "STRONG_KEEP"
				: analysis.score < scoreBands.pruneBelow
					? "REMOVE"
					: "CONSIDER");
		const updatedJob = {
			...enrichedJob,
			status: verdict === "REMOVE" ? "discard" : "keep",
			isSelectedForDeletion: verdict === "REMOVE",
			analysis: {
				...analysis,
				verdict,
			},
			updatedAt: new Date().toISOString(),
		};

		res.json({ analysis: updatedJob.analysis, job: updatedJob });
	} catch (error: any) {
		console.error("Error in /api/qualify-job:", error);
		res.status(500).json({ error: error.message || "Failed to qualify job" });
	}
});

// Endpoint 4: Qualify Batch & Generate Overall Summary Report
app.post("/api/qualify-batch", async (req, res) => {
	try {
		const { jobs, criteria, contextDoc } = req.body;
		if (!jobs || !Array.isArray(jobs) || jobs.length === 0 || !criteria) {
			return res
				.status(400)
				.json({ error: "Jobs array and Criteria are required" });
		}

		// Process in batches of 4 with controlled concurrency
		const BATCH_SIZE = 4;
		const analyzedJobs: any[] = [];

		for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
			const chunk = jobs.slice(i, i + BATCH_SIZE);
			const chunkResults = await Promise.all(
				chunk.map(async (rawJob: any) => {
					// 1. Clean metadata and title/company
					const cleaned = cleanLinkedInJobMeta(
						rawJob.title,
						rawJob.company,
						rawJob.location,
						rawJob.workplaceType,
					);
					let enrichedJob = { ...rawJob, ...cleaned };

					// 2. If description is minimal and it has a LinkedIn ID, try guest scrape
					const liId = extractLinkedInJobId(enrichedJob.url);
					if (liId) {
						try {
							const scraped = await scrapeLinkedInJobGuest(
								liId,
								enrichedJob.url,
							);
							if (
								scraped.descriptionRaw &&
								(scraped.descriptionRaw.length >
									(enrichedJob.descriptionRaw?.length || 0) ||
									scraped.workplaceType !== enrichedJob.workplaceType)
							) {
								const isRemoteDetected =
									enrichedJob.workplaceType === "Remote" ||
									(rawJob.title &&
										rawJob.title.toLowerCase().includes("remote")) ||
									(rawJob.location &&
										rawJob.location.toLowerCase().includes("remote")) ||
									(scraped.location &&
										scraped.location.toLowerCase().includes("remote")) ||
									scraped.workplaceType === "Remote" ||
									(scraped.descriptionRaw &&
										(scraped.descriptionRaw
											.toLowerCase()
											.includes("100% remote") ||
											scraped.descriptionRaw
												.toLowerCase()
												.includes("fully remote")));

								enrichedJob = {
									...enrichedJob,
									title: scraped.title || enrichedJob.title,
									company:
										scraped.company !== "LinkedIn Company"
											? scraped.company
											: enrichedJob.company,
									location:
										isRemoteDetected &&
										!scraped.location.toLowerCase().includes("remote")
											? `${scraped.location} (Remote)`
											: scraped.location || enrichedJob.location,
									headerRaw: scraped.headerRaw || enrichedJob.headerRaw,
									workplaceType: isRemoteDetected
										? "Remote"
										: scraped.workplaceType || enrichedJob.workplaceType,
									salaryRaw: scraped.salaryRaw || enrichedJob.salaryRaw,
									descriptionRaw:
										scraped.descriptionRaw.length >
										(enrichedJob.descriptionRaw?.length || 0)
											? scraped.descriptionRaw
											: enrichedJob.descriptionRaw,
								};
							}
						} catch (e) {
							// Ignore guest scrape failure and proceed with available job info
						}
					}

					// Keep qualification deterministic. The scorer directly applies role,
					// location, seniority, education, and strictness weights every time.
					const analysis = evaluateJobHeuristically(
						enrichedJob,
						criteria,
						contextDoc,
					);

					const scoreBands = getScoreBands(criteria);
					const verdict =
						analysis.verdict ||
						(analysis.score >= scoreBands.keepAt
							? "STRONG_KEEP"
							: analysis.score < scoreBands.pruneBelow
								? "REMOVE"
								: "CONSIDER");

					return {
						...enrichedJob,
						status: verdict === "REMOVE" ? "discard" : "keep",
						isSelectedForDeletion: verdict === "REMOVE",
						analysis: {
							...analysis,
							verdict,
						},
						updatedAt: new Date().toISOString(),
					};
				}),
			);

			analyzedJobs.push(...chunkResults);

			// Brief yield between chunks
			if (i + BATCH_SIZE < jobs.length) {
				await new Promise((r) => setTimeout(r, 100));
			}
		}

		// Compute Overall Summary Report
		const keeps = analyzedJobs.filter(
			(j) => j.analysis?.verdict === "STRONG_KEEP",
		);
		const considers = analyzedJobs.filter(
			(j) => j.analysis?.verdict === "CONSIDER",
		);
		const removes = analyzedJobs.filter(
			(j) => j.analysis?.verdict === "REMOVE",
		);
		const avgScore = Math.round(
			analyzedJobs.reduce((acc, j) => acc + (j.analysis?.score || 0), 0) /
				(analyzedJobs.length || 1),
		);

		const report: any = {
			totalJobsAnalyzed: analyzedJobs.length,
			strongKeepCount: keeps.length,
			considerCount: considers.length,
			removeCount: removes.length,
			averageScore: avgScore,
			topMatches: keeps.slice(0, 5).map((j) => ({
				id: j.id,
				title: j.title,
				company: j.company,
				score: j.analysis?.score || 0,
				reason: j.analysis?.oneSentenceSummary || "High criteria alignment",
			})),
			recommendedPrune: removes.map((j) => ({
				id: j.id,
				title: j.title,
				company: j.company,
				score: j.analysis?.score || 0,
				mainIssue:
					j.analysis?.dealbreakerTriggers?.[0] ||
					j.analysis?.keyCons?.[0] ||
					"Location/criteria misalignment",
			})),
			overallVerdictSummary: `Analyzed ${analyzedJobs.length} opportunities: ${keeps.length} high-conviction matches ready to apply, ${considers.length} secondary candidates, and ${removes.length} recommended for deletion due to dealbreakers or misalignment.`,
		};

		res.json({ jobs: analyzedJobs, report });
	} catch (error: any) {
		console.error("Error in /api/qualify-batch:", error);
		res
			.status(500)
			.json({ error: error.message || "Failed to batch qualify jobs" });
	}
});

// Endpoint: Sync / Extract Screening Rubric from Context Document
app.post("/api/sync-rubric-from-context", async (req, res) => {
	try {
		const { contextDoc } = req.body;
		if (!contextDoc || !contextDoc.trim()) {
			return res
				.status(400)
				.json({ error: "Context document text is required" });
		}

		let ai: GoogleGenAI | null = null;
		const effectiveApiKey = process.env.GEMINI_API_KEY;
		// AI extraction costs the admin's Gemini quota, so only run it for an
		// authenticated admin session; everyone else gets the heuristic parser below.
		if (effectiveApiKey && isAdminSession(req)) {
			try {
				ai = new GoogleGenAI({
					apiKey: effectiveApiKey as string,
					httpOptions: { headers: { "User-Agent": "aistudio-build" } },
				});
			} catch (e) {}
		}

		if (ai) {
			try {
				const prompt = `You are an elite Executive Career Strategist and Technical Recruiter.
Analyze the following Candidate Context Document (which includes complete work history, skills, philosophy, salary targets, work authorization, location, and achievements).
Extract a complete, highly structured, tailored Screening Rubric JSON matching the candidate's exact background and market criteria.

APPLICANT CONTEXT DOC:
"""
${contextDoc.slice(0, 18000)}
"""

REQUIREMENTS FOR EXTRACTION:
1. "fullName": Candidate's full name (e.g. "James Barnes").
2. "targetJobTitles": Array of 4-6 realistic, high-impact job titles including seniority where applicable (e.g., ["Senior Frontend Developer", "Senior Design Engineer", "Senior Frontend Architect", "Lead Frontend Developer", "Senior UI/UX Engineer"]).
3. "seniorityLevel": One of ["Senior", "Lead / Staff", "Mid-Level", "Senior / Staff", "Engineering Manager"].
4. "yearsOfExperience": Integer total professional years of experience.
5. "techStackRequired": Array of 5-8 primary core technologies the candidate specializes in (e.g. ["React", "TypeScript", "Next.js", "Tailwind CSS", "Design Systems", "Svelte"]).
6. "techStackNiceToHave": Array of secondary technologies (e.g. ["GSAP", "Astro", "Node.js", "Zustand", "TanStack Query", "WCAG Accessibility"]).
7. "locationPreferences":
   - "homeLocation": City and region of the candidate's primary residence (e.g. "Montreal, QC, Canada").
   - "allowHomeOnsiteHybrid": boolean (true: on-site/hybrid is fine in home city).
   - "remoteOnly": boolean (true: all other locations outside home city must be 100% remote).
   - "allowedRemoteRegions": Array of remote hiring jurisdictions (e.g. ["Canada (Remote)", "US (Remote for Canadian Residents)", "North America (Remote)", "Worldwide Remote"]).
   - "requiresSponsorship": boolean (false if Canadian citizen not needing domestic sponsorship).
8. "minSalary": Number representing the absolute minimum base salary floor (e.g. 100000).
9. "salaryCurrency": "CAD" or "USD".
10. "dealbreakers": Array of 5-8 SHORT, CONCISE, PUNCHY disqualification phrases (MAX 4-6 WORDS EACH!).
11. "preferredIndustries": Array of preferred industry verticals.
12. "customEvaluationPrompt": A crisp 2-sentence strategic evaluation guidance prompt.
13. "syncSummary": A 2-sentence summary of what was extracted from the doc.`;

				const candidateModels = [
					"gemini-2.5-flash",
					"gemini-2.0-flash",
					"gemini-1.5-flash",
					"gemini-2.5-pro",
				];
				for (const modelName of candidateModels) {
					try {
						const response = await ai.models.generateContent({
							model: modelName,
							contents: prompt,
							config: {
								responseMimeType: "application/json",
								responseSchema: {
									type: Type.OBJECT,
									properties: {
										fullName: { type: Type.STRING },
										targetJobTitles: {
											type: Type.ARRAY,
											items: { type: Type.STRING },
										},
										seniorityLevel: { type: Type.STRING },
										yearsOfExperience: { type: Type.INTEGER },
										techStackRequired: {
											type: Type.ARRAY,
											items: { type: Type.STRING },
										},
										techStackNiceToHave: {
											type: Type.ARRAY,
											items: { type: Type.STRING },
										},
										locationPreferences: {
											type: Type.OBJECT,
											properties: {
												homeLocation: { type: Type.STRING },
												allowHomeOnsiteHybrid: { type: Type.BOOLEAN },
												remoteOnly: { type: Type.BOOLEAN },
												allowedRemoteRegions: {
													type: Type.ARRAY,
													items: { type: Type.STRING },
												},
												requiresSponsorship: { type: Type.BOOLEAN },
											},
											required: [
												"homeLocation",
												"remoteOnly",
												"requiresSponsorship",
											],
										},
										minSalary: { type: Type.INTEGER },
										salaryCurrency: { type: Type.STRING, enum: ["CAD", "USD"] },
										dealbreakers: {
											type: Type.ARRAY,
											items: { type: Type.STRING },
										},
										preferredIndustries: {
											type: Type.ARRAY,
											items: { type: Type.STRING },
										},
										customEvaluationPrompt: { type: Type.STRING },
										syncSummary: { type: Type.STRING },
									},
									required: [
										"fullName",
										"targetJobTitles",
										"seniorityLevel",
										"yearsOfExperience",
										"techStackRequired",
										"techStackNiceToHave",
										"locationPreferences",
										"minSalary",
										"dealbreakers",
										"preferredIndustries",
										"customEvaluationPrompt",
										"syncSummary",
									],
								},
							},
						});

						const parsed = JSON.parse(response.text || "{}");
						const { syncSummary, ...criteria } = parsed;
						return res.json({ criteria, syncSummary });
					} catch (e) {}
				}
			} catch (aiErr: any) {
				console.warn(
					"AI sync-rubric-from-context failed, using heuristic extraction:",
					aiErr.message,
				);
			}
		}

		// Heuristic Context Doc Parser (no AI key configured / AI extraction failed).
		// Best-effort regex extraction directly from the pasted doc — never fabricates
		// a persona, so every user gets their own values back (or none, if not found).
		const doc = String(contextDoc);
		const matchField = (label: string) => {
			const re = new RegExp(`\\*{0,2}${label}\\*{0,2}\\s*:?\\s*([^\\n]+)`, "i");
			const m = doc.match(re);
			return m ? m[1].replace(/[*_`]/g, "").trim() : undefined;
		};
		const splitList = (value?: string) =>
			value
				? value
						.split(/[,;]/)
						.map((s) => s.trim())
						.filter(Boolean)
				: [];
		const extractBulletSection = (heading: string) => {
			const re = new RegExp(
				`#{1,4}\\s*${heading}[^\\n]*\\n((?:\\s*[-*]\\s*.+\\n?)+)`,
				"i",
			);
			const m = doc.match(re);
			if (!m) return [] as string[];
			return m[1]
				.split("\n")
				.map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
				.filter(Boolean);
		};

		const nameMatch = matchField("Name");
		const locationMatch = matchField("Location");
		const yearsMatch = doc.match(/(\d+)\+?\s*years?/i);
		const salaryMatch = doc.match(/\$\s?(\d{2,3}(?:,\d{3})|\d{5,6})/);
		const targetRolesMatch = matchField("Target Roles?");
		const skillsMatch = matchField("Core Skills|Skills");
		const dealbreakerBullets = extractBulletSection("Dealbreakers?");
		const preferredWorkBullets = extractBulletSection(
			"Preferred Work|Preferred Industries?",
		);

		const criteria: Record<string, any> = {};
		if (nameMatch) criteria.fullName = nameMatch;
		if (targetRolesMatch)
			criteria.targetJobTitles = splitList(targetRolesMatch);
		if (yearsMatch) criteria.yearsOfExperience = Number(yearsMatch[1]);
		if (skillsMatch) criteria.techStackRequired = splitList(skillsMatch);
		if (locationMatch) {
			criteria.locationPreferences = { homeLocation: locationMatch };
		}
		if (salaryMatch) {
			criteria.minSalary = Number(salaryMatch[1].replace(/,/g, ""));
		}
		if (dealbreakerBullets.length > 0) {
			criteria.dealbreakers = dealbreakerBullets;
		}
		if (preferredWorkBullets.length > 0) {
			criteria.preferredIndustries = preferredWorkBullets;
		}

		const extractedFields = Object.keys(criteria);
		const syncSummary =
			extractedFields.length > 0
				? `Heuristic extraction (no AI key configured) found: ${extractedFields.join(", ")}. Review and fill in any remaining fields manually.`
				: "No AI key configured and no recognizable fields found in the document. Please fill in the rubric fields manually.";
		res.json({ criteria, syncSummary });
	} catch (error: any) {
		console.error("Error in /api/sync-rubric-from-context:", error);
		res.status(500).json({
			error: error.message || "Failed to sync rubric from context doc",
		});
	}
});

// Endpoint 5: Generate Applicant Answer based on Context Doc
app.post("/api/generate-applicant-answer", async (req, res) => {
	try {
		const { question, contextDoc, targetJob, tone } = req.body as {
			question: string;
			contextDoc: string;
			targetJob?: any;
			tone?: "standard" | "concise" | "storytelling" | "direct";
		};

		if (!question || !question.trim()) {
			return res
				.status(400)
				.json({ error: "Application question is required." });
		}

		let ai: GoogleGenAI | null = null;
		const effectiveApiKey = process.env.GEMINI_API_KEY;
		// AI-generated answers cost the admin's Gemini quota, so only run it for an
		// authenticated admin session; everyone else gets the heuristic template below.
		if (effectiveApiKey && isAdminSession(req)) {
			try {
				ai = new GoogleGenAI({
					apiKey: effectiveApiKey as string,
					httpOptions: { headers: { "User-Agent": "aistudio-build" } },
				});
			} catch (e) {}
		}

		let toneInstruction =
			"Standard tone: Engaging, authentic, professional, and well-structured in 2-3 focused paragraphs.";
		if (tone === "concise") {
			toneInstruction =
				"Concise tone: Extremely crisp, direct, and under 120 words or 3 short impactful bullets.";
		} else if (tone === "storytelling") {
			toneInstruction =
				"In-depth STAR method (Situation, Task, Action, Result): Provide a vivid, structured story demonstrating real-world problem solving, measurable impact, and craftsmanship.";
		} else if (tone === "direct") {
			toneInstruction =
				"Direct & factual: Straight to the point, clear answers to logistics, salary, location, tech stack, or background.";
		}

		let answerTargetJob = targetJob;
		if (ai && targetJob?.url) {
			const refreshedDescription = await fetchJobDescriptionForAnswer(
				targetJob.url,
			);
			if (refreshedDescription) {
				answerTargetJob = {
					...targetJob,
					descriptionRaw: refreshedDescription,
				};
			}
		}

		if (ai) {
			try {
				const prompt = `You are writing as the job applicant (James Barnes), directly responding to a job application question or screening prompt.
You MUST write authentically in the FIRST PERSON ("I", "my experience", "at TEC...", "with Crux Digital...").

APPLICATION QUESTION / PROMPT:
"""
${question.trim()}
"""


${
	answerTargetJob
		? `TARGET ROLE & COMPANY CONTEXT:
- Role Title: ${answerTargetJob.title}
- Company: ${answerTargetJob.company}
- Job Description Excerpt: ${(answerTargetJob.descriptionRaw || "").slice(0, 1500)}
`
		: `TARGET ROLE CONTEXT: General application or screening question`
}

APPLICANT CONTEXT DOC (Ground truth for work history, skills, philosophy, achievements, and answers):
"""
${(contextDoc || "").slice(0, 18000)}
"""

TONE / FORMAT DIRECTIVE:
${toneInstruction}

STRICT GUIDELINES:
1. Ground every claim strictly in the Applicant Context Doc. Use the real companies (Technology Evaluation Centers / TEC, Crux Digital, Johannesburg Art School), real projects (Lumina Estates, Delicimo, Prospera), real frameworks (Svelte, SvelteKit, React, TypeScript, Next.js, Tailwind, GSAP), and real case studies (Design System overhaul, Legacy CRM modernization into React + shadcn/ui, AI automated image pipeline).
2. Never invent fake companies or unverifiable degrees.
3. If asked about salary, refer to the target range: $100,000 – $120,000 CAD base.
4. If asked about location / work authorization, state clearly: Canadian citizen/resident based in Montreal, QC, open to remote North American roles that hire Canadian residents without requiring US citizenship/clearance.
5. If asked about why leaving: Explain the temporary layoff due to corporate financial difficulties at previous company, pivoting towards greater craftsmanship and technical growth.
6. Return a clean, ready-to-paste answer formatted with markdown paragraphs or bullet points where appropriate. Do NOT include meta-commentary like "Here is your answer:".`;

				const candidateModels = [
					"gemini-2.5-flash",
					"gemini-2.0-flash",
					"gemini-1.5-flash",
					"gemini-2.5-pro",
				];
				for (const modelName of candidateModels) {
					try {
						const response = await ai.models.generateContent({
							model: modelName,
							contents: prompt,
						});
						if (response.text) {
							return res.json({ answer: response.text });
						}
					} catch (e) {}
				}
			} catch (aiErr: any) {
				console.warn(
					"AI generate-applicant-answer failed, using heuristic template:",
					aiErr.message,
				);
			}
		}

		// Context-grounded first-person response template
		const qLower = question.toLowerCase();
		let generatedAnswer = "";

		if (
			qLower.includes("why") ||
			qLower.includes("interest") ||
			qLower.includes("excited")
		) {
			generatedAnswer = `Throughout my 8+ years as a Senior Frontend Developer and Design Engineer, I have focused on bridging high-fidelity UI/UX design with robust, enterprise-scale engineering. What particularly excites me about ${targetJob?.company || "your team"} and the ${targetJob?.title || "role"} is the dedication to product craftsmanship and building snappy, user-centric web applications.

At Technology Evaluation Centers (TEC), I led our multi-brand frontend architecture and design system overhaul—migrating fragmented codebases into modern TypeScript, React, and Tailwind CSS while reducing client load times by 40%. I thrive in environments where engineering standards, component modularity, and micro-interactions directly elevate the end-user experience.

I am eager to bring my background in design systems, performance optimization, and autonomous delivery to accelerate ${targetJob?.company || "your product"}'s roadmap.`;
		} else if (
			qLower.includes("salary") ||
			qLower.includes("compensation") ||
			qLower.includes("rate")
		) {
			generatedAnswer = `My target base compensation for this role is $100,000 – $120,000 CAD (or equivalent USD), commensurate with the seniority, scope of responsibilities, and total benefits package. I am open to discussing the complete compensation structure based on mutual fit.`;
		} else if (
			qLower.includes("location") ||
			qLower.includes("remote") ||
			qLower.includes("relocate") ||
			qLower.includes("citizen") ||
			qLower.includes("visa")
		) {
			generatedAnswer = `I am based in Montreal, QC, Canada, and work seamlessly in fully remote North American engineering teams across Eastern and Pacific time zones. I am a Canadian citizen and authorized to work domestically in Canada as well as for US companies via Canadian entities, Employer of Record (EOR), or international contractor arrangements without requiring domestic US visa sponsorship.`;
		} else {
			generatedAnswer = `In my recent role as Senior Frontend Developer at Technology Evaluation Centers (TEC), I spearheaded key architecture modernization initiatives—including overhauling our legacy enterprise tools into modular React + TypeScript applications and building accessible, tokenized design systems.

Key highlights from my experience that directly apply:
• **Design System & Component Architecture**: Established multi-brand component libraries with strict accessibility (WCAG 2.1 AA) and automated visual regression testing.
• **Performance & Core Web Vitals**: Refactored critical user flows, eliminating runtime bottlenecks and optimizing bundle payloads to achieve sub-second LCP.
• **Autonomous Execution & Ownership**: Collaborated closely with Product and Design to ship high-impact features end-to-end in rapid, remote-first agile cycles.

I would love to bring this combination of technical rigor and product design sensibility to the ${targetJob?.title || "team"} at ${targetJob?.company || "your company"}.`;
		}

		res.json({ answer: generatedAnswer });
	} catch (error: any) {
		console.error("Error in /api/generate-applicant-answer:", error);
		res
			.status(500)
			.json({ error: error.message || "Failed to generate applicant answer" });
	}
});

// Health check endpoint
app.get("/api/health", (req, res) => {
	res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export async function startServer() {
	if (process.env.NODE_ENV !== "production") {
		const { createServer: createViteServer } = await import("vite");
		const vite = await createViteServer({
			server: {
				middlewareMode: true,
				watch: {
					ignored: [
						"**/app_state.json",
						"**/app_state*.json",
						"**/dist/**",
						"**/.git/**",
						"**/node_modules/**",
						"**/*.log",
					],
				},
			},
			appType: "spa",
		});
		app.use(vite.middlewares);
	} else {
		const distPath = path.join(process.cwd(), "dist");
		app.use(express.static(distPath));
		app.get("*", (req, res) => {
			res.sendFile(path.join(distPath, "index.html"));
		});
	}

	app.listen(PORT, "0.0.0.0", () => {
		console.log(`\n  ➜  Local:   http://localhost:${PORT}/`);
		console.log(`  ➜  Network: http://127.0.0.1:${PORT}/\n`);
	});
}

const isDirectRun = ["server.ts", "server.cjs"].includes(
	path.basename(process.argv[1] || ""),
);

if (isDirectRun) {
	startServer();
}

export default app;
