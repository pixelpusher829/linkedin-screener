import { useMemo, useState } from "react";
import { JobPosting } from "../types";

export type ActiveFilter =
	| "all"
	| "strong"
	| "consider"
	| "keep"
	| "discard"
	| "shortlist"
	| "applied";
export type SortBy = "score" | "recent" | "company";

export function useJobFilters(jobs: JobPosting[]) {
	const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState<SortBy>("score");
	const filteredJobs = useMemo(
		() =>
			jobs
				.filter((job) => {
					if (activeFilter === "strong")
						return job.analysis?.verdict === "STRONG_KEEP";
					if (activeFilter === "consider")
						return job.analysis?.verdict === "CONSIDER";
					if (activeFilter === "keep")
						return (
							(job.analysis?.verdict === "STRONG_KEEP" ||
								job.analysis?.verdict === "CONSIDER") &&
							!job.isSelectedForDeletion
						);
					if (activeFilter === "discard")
						return (
							job.analysis?.verdict === "REMOVE" || job.isSelectedForDeletion
						);
					if (activeFilter === "applied") return job.status === "applied";
					return true;
				})
				.filter((job) => {
					if (!searchQuery.trim()) return true;
					const query = searchQuery.toLowerCase();
					return (
						job.title.toLowerCase().includes(query) ||
						job.company.toLowerCase().includes(query) ||
						job.location.toLowerCase().includes(query) ||
						job.analysis?.oneSentenceSummary?.toLowerCase().includes(query) ||
						job.analysis?.matchedSkills?.some((skill) =>
							skill.toLowerCase().includes(query),
						) ||
						job.analysis?.dealbreakerTriggers?.some((trigger) =>
							trigger.toLowerCase().includes(query),
						)
					);
				})
				.sort((a, b) => {
					if (sortBy === "score")
						return (b.analysis?.score || 0) - (a.analysis?.score || 0);
					if (sortBy === "company") return a.company.localeCompare(b.company);
					return (
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
					);
				}),
		[jobs, activeFilter, searchQuery, sortBy],
	);

	const jobsMarkedForPruning = useMemo(
		() =>
			jobs.filter(
				(job) =>
					job.analysis?.verdict === "REMOVE" || job.isSelectedForDeletion,
			),
		[jobs],
	);

	return {
		activeFilter,
		setActiveFilter,
		searchQuery,
		setSearchQuery,
		sortBy,
		setSortBy,
		filteredJobs,
		jobsMarkedForPruning,
	};
}
