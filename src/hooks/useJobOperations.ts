import { useState, type Dispatch } from "react";
import confetti from "canvas-confetti";
import { JobPosting, UserCriteria } from "../types";
import { addUniqueJobs, normalizeImportedJob } from "./jobOperationUtils";
import type { JobAction } from "./jobReducer";

interface JobOperationsOptions {
	jobs: JobPosting[];
	dispatchJobs: Dispatch<JobAction>;
	criteria: UserCriteria;
	contextDoc: string;
	filteredJobs: JobPosting[];
	setActiveFilter: (
		filter:
			| "all"
			| "strong"
			| "consider"
			| "keep"
			| "discard"
			| "shortlist"
			| "applied",
	) => void;
}

export function useJobOperations({
	jobs,
	dispatchJobs,
	criteria,
	contextDoc,
	filteredJobs,
	setActiveFilter,
}: JobOperationsOptions) {
	const [isQualifying, setIsQualifying] = useState(false);
	const [blockedTabJobs, setBlockedTabJobs] = useState<JobPosting[]>([]);
	const [showPopupHelp, setShowPopupHelp] = useState(false);

	const handleRunBatchQualify = async () => {
		if (jobs.length === 0) return;
		setIsQualifying(true);
		try {
			const res = await fetch("/api/qualify-batch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jobs, criteria, contextDoc }),
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || "Bulk qualification failed.");
			}
			const data = await res.json();
			if (data.jobs && Array.isArray(data.jobs))
				dispatchJobs({ type: "REPLACE_JOBS", jobs: data.jobs });
			if (data.report)
				dispatchJobs({ type: "SET_REPORT", report: data.report });
			try {
				confetti({ particleCount: 65, spread: 60, origin: { y: 0.65 } });
			} catch {}
		} catch (err: any) {
			alert(
				"Error qualifying jobs: " +
					(err.message || "Please check server connection"),
			);
		} finally {
			setIsQualifying(false);
		}
	};

	const handleToggleDeletion = (jobId: string) =>
		dispatchJobs({ type: "TOGGLE_DELETION", jobId });

	const handleToggleApplied = (jobId: string) =>
		dispatchJobs({ type: "TOGGLE_APPLIED", jobId });

	const handleDeleteSingle = (jobId: string) => {
		if (confirm("Remove this job posting from your screener?"))
			dispatchJobs({ type: "DELETE_JOB", jobId });
	};

	const handleConfirmPrune = (
		jobIdsToKeep: string[],
		jobIdsToDelete: string[],
	) => {
		dispatchJobs({ type: "CONFIRM_PRUNE", jobIdsToKeep, jobIdsToDelete });
		setActiveFilter("keep");
	};

	const handleAddJobs = (newJobs: JobPosting[]) => {
		const duplicateCount = addUniqueJobs(jobs, newJobs).duplicateCount;
		if (duplicateCount > 0)
			alert(
				`${duplicateCount} duplicate job${duplicateCount === 1 ? "" : "s"} skipped.`,
			);
		dispatchJobs({ type: "ADD_JOBS", jobs: newJobs });
	};

	const handleImportExtractedJson = (inputString: string) => {
		try {
			const trimmed = inputString.trim();
			let parsedItems: any[] = [];
			if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
				try {
					const parsed = JSON.parse(trimmed);
					parsedItems = Array.isArray(parsed)
						? parsed
						: parsed.jobs || [parsed];
				} catch {}
			}
			if (parsedItems.length === 0) {
				const matches = trimmed.match(/https?:\/\/[^\s"',<>)\]}]+/g) || [];
				const uniqueUrls = [
					...new Set(matches.map((url) => url.replace(/[.,;:]+$/, "").trim())),
				];
				parsedItems = uniqueUrls.map((url) => {
					let inferredTitle = "Software Opportunity";
					let inferredCompany = "LinkedIn Company";
					const matchAt = url.match(/\/jobs\/view\/(.+?)-at-(.+?)(?:-\d+)?$/i);
					if (matchAt) {
						inferredTitle = matchAt[1]
							.replace(/-/g, " ")
							.replace(/\b\w/g, (character) => character.toUpperCase());
						inferredCompany = matchAt[2]
							.replace(/-/g, " ")
							.replace(/\b\w/g, (character) => character.toUpperCase());
					}
					return {
						url,
						title: inferredTitle,
						company: inferredCompany,
						location: "Remote / Unspecified",
						workplaceType: "Remote",
						descriptionRaw: `Imported from ${url}`,
					};
				});
			}
			if (parsedItems.length === 0)
				throw new Error(
					"Could not detect any jobs or valid links in the input.",
				);
			const newPostings: JobPosting[] = parsedItems.map((item, index) =>
				normalizeImportedJob(item, index),
			);
			handleAddJobs(newPostings);
		} catch (err: any) {
			alert("Failed to parse extracted jobs: " + err.message);
		}
	};

	const handleOpenAllAsTabs = () => {
		setBlockedTabJobs([]);
		setShowPopupHelp(false);
		const validUrlJobs = filteredJobs.filter(
			(job) => job.url && job.url.startsWith("http"),
		);
		if (validUrlJobs.length === 0) {
			alert("No valid external job URLs found in this filtered view.");
			return;
		}
		if (
			validUrlJobs.length > 8 &&
			!confirm(
				`Open ${validUrlJobs.length} job postings in separate browser tabs? (Note: Ensure your browser allows pop-ups for this site).`,
			)
		)
			return;
		const blockedJobs = validUrlJobs.filter(
			(job) => !window.open(job.url, "_blank", "noopener,noreferrer"),
		);
		setBlockedTabJobs(blockedJobs);
		setShowPopupHelp(blockedJobs.length > 0);
	};
	const handleRetryRemainingTabs = () => {
		const stillBlocked = blockedTabJobs.filter(
			(job) => !window.open(job.url, "_blank", "noopener,noreferrer"),
		);
		setBlockedTabJobs(stillBlocked);
		setShowPopupHelp(stillBlocked.length > 0);
	};

	return {
		isQualifying,
		blockedTabJobs,
		showPopupHelp,
		setBlockedTabJobs,
		handleRunBatchQualify,
		handleToggleDeletion,
		handleToggleApplied,
		handleDeleteSingle,
		handleConfirmPrune,
		handleAddJobs,
		handleImportExtractedJson,
		handleOpenAllAsTabs,
		handleRetryRemainingTabs,
	};
}
