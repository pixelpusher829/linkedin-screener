import express from "express";
import {
	cleanLinkedInJobMeta,
	evaluateJobHeuristically,
	getScoreBands,
} from "../services/qualification.service";
import {
	extractLinkedInJobId,
	scrapeLinkedInJobGuest,
} from "../services/scraping.service";

export const qualifyRouter = express.Router();

// /api/qualify-job and /api/qualify-batch are deterministic (no AI call) and free
// to use for anyone. /api/sync-rubric-from-context and /api/generate-applicant-answer
// gate their optional AI-powered path behind an admin session internally instead of
// blocking the whole endpoint, so non-admins still get the heuristic fallback for free.

// Endpoint 3: Qualify a Single Job against User Criteria & Context Doc
qualifyRouter.post("/qualify-job", async (req, res) => {
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
qualifyRouter.post("/qualify-batch", async (req, res) => {
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
