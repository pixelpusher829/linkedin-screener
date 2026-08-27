import { JobPosting, WorkplaceType } from "../types";

export function getJobDeduplicationKeys(job: JobPosting): string[] {
	const normalizedUrl = job.url.toLowerCase().trim().replace(/\/$/, "");
	const linkedInId = normalizedUrl.match(
		/(?:jobs\/view\/|currentJobId=)(\d+)/i,
	)?.[1];
	const keys = [
		`job:${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}|${job.location.toLowerCase().trim()}`,
	];
	if (linkedInId) keys.push(`linkedin:${linkedInId}`);
	else if (normalizedUrl && !normalizedUrl.endsWith("/linkedin.com/jobs"))
		keys.push(`url:${normalizedUrl}`);
	return keys;
}

export function addUniqueJobs(
	previous: JobPosting[],
	newJobs: JobPosting[],
): { jobs: JobPosting[]; duplicateCount: number } {
	const existingKeys = new Set(previous.flatMap(getJobDeduplicationKeys));
	const seenKeys = new Set<string>();
	const uniqueNew = newJobs.filter((job) => {
		const keys = getJobDeduplicationKeys(job);
		if (keys.some((key) => existingKeys.has(key) || seenKeys.has(key)))
			return false;
		keys.forEach((key) => seenKeys.add(key));
		return true;
	});
	return {
		jobs: [...uniqueNew, ...previous],
		duplicateCount: newJobs.length - uniqueNew.length,
	};
}

export function toggleDeletion(
	jobs: JobPosting[],
	jobId: string,
): JobPosting[] {
	return jobs.map((job) => {
		if (job.id !== jobId) return job;
		const currentFlag =
			job.isSelectedForDeletion ?? job.analysis?.verdict === "REMOVE";
		return {
			...job,
			isSelectedForDeletion: !currentFlag,
			status: !currentFlag ? "discard" : "keep",
		};
	});
}

export function toggleApplied(
	jobs: JobPosting[],
	jobId: string,
	now = new Date(),
): JobPosting[] {
	return jobs.map((job) =>
		job.id === jobId
			? {
					...job,
					status: job.status === "applied" ? "keep" : "applied",
					appliedDate: job.status === "applied" ? undefined : now.toISOString(),
				}
			: job,
	);
}

export function deleteJob(jobs: JobPosting[], jobId: string): JobPosting[] {
	return jobs.filter((job) => job.id !== jobId);
}

export function confirmPrune(
	jobs: JobPosting[],
	jobIdsToDelete: string[],
	jobIdsToKeep: string[],
): JobPosting[] {
	const deleteSet = new Set(jobIdsToDelete);
	return jobs
		.filter((job) => !deleteSet.has(job.id))
		.map((job) =>
			jobIdsToKeep.includes(job.id)
				? { ...job, isSelectedForDeletion: false, status: "keep" }
				: job,
		);
}

export function normalizeImportedJob(
	item: any,
	index: number,
	now = new Date(),
): JobPosting {
	const location = item.location || "Remote / Unspecified";
	const title = item.title || "Software Opportunity";
	const headerRaw = item.headerRaw || item.headerText || "";
	const workplaceText = `${title} ${location} ${headerRaw}`.toLowerCase();
	const workplaceType: WorkplaceType = workplaceText.includes("remote")
		? "Remote"
		: workplaceText.includes("hybrid")
			? "Hybrid"
			: item.workplaceType === "Remote" ||
				  item.workplaceType === "Hybrid" ||
				  item.workplaceType === "On-site"
				? item.workplaceType
				: "Unknown";
	const timestamp = now.toISOString();
	return {
		id: `li-pull-${now.getTime()}-${index}`,
		url: item.url || "https://www.linkedin.com/jobs",
		title,
		company: item.company || "Hiring Company",
		location,
		workplaceType,
		headerRaw: headerRaw || undefined,
		salaryRaw: item.salaryRaw || undefined,
		descriptionRaw:
			item.descriptionRaw ||
			item.descriptionSummary ||
			`${item.title} at ${item.company}. Extracted from LinkedIn saved jobs.`,
		source: "linkedin_tracker",
		status: "to_qualify",
		createdAt: timestamp,
		updatedAt: timestamp,
	};
}
