import express from "express";
import { Type } from "@google/genai";
import * as cheerio from "cheerio";
import { isAdminSession } from "../services/auth.service";
import { getGeminiClient } from "../services/gemini.service";
import {
	extractLinkedInJobId,
	inferDetailsFromUrl,
	isPublicHttpUrl,
	scrapeGeneralJob,
	scrapeLinkedInJobGuest,
} from "../services/scraping.service";

export const scrapeRouter = express.Router();

// Endpoint 1: Scrape / Extract details from URLs (LinkedIn & General ATS)
scrapeRouter.post("/scrape-urls", async (req, res) => {
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
scrapeRouter.post("/parse-tracker-text", async (req, res) => {
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
