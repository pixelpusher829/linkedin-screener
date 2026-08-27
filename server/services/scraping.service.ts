import { isIP } from "node:net";
import * as cheerio from "cheerio";

// Helper to clean scraped text
export function cleanText(txt: string): string {
	return txt
		.replace(/\r\n|\r/g, "\n")
		.replace(/\t/g, " ")
		.replace(/\s{2,}/g, " ")
		.trim();
}

export function isPublicHttpUrl(rawUrl: string): boolean {
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

export async function fetchPublicUrl(url: string, init: RequestInit = {}) {
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

// Helper to extract LinkedIn Job ID from various URL formats
export function extractLinkedInJobId(url: string): string | null {
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
export function inferDetailsFromUrl(rawUrl: string): {
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
export async function scrapeLinkedInJobGuest(
	jobId: string,
	originalUrl: string,
) {
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
export async function scrapeGeneralJob(cleanUrl: string) {
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

export async function fetchJobDescriptionForAnswer(
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
