import assert from "node:assert/strict";
import { sortJobs } from "../src/hooks/useJobFilters";
import { JobPosting } from "../src/types";

const makeJob = (
	id: string,
	verdict: "STRONG_KEEP" | "CONSIDER",
	score: number,
): JobPosting => ({
	id,
	url: `https://example.com/${id}`,
	title: id,
	company: id,
	location: "Montreal, QC",
	workplaceType: "Remote",
	descriptionRaw: "Remote role",
	source: "paste",
	status: "keep",
	createdAt: "2026-08-28T12:00:00.000Z",
	updatedAt: "2026-08-28T12:00:00.000Z",
	analysis: { score, verdict } as JobPosting["analysis"],
});

const ordered = sortJobs(
	[
		makeJob("consider-high", "CONSIDER", 95),
		makeJob("keep-low", "STRONG_KEEP", 70),
		makeJob("keep-high", "STRONG_KEEP", 90),
		makeJob("consider-low", "CONSIDER", 75),
	],
	"score",
	true,
);

assert.deepEqual(
	ordered.map((job) => job.id),
	["keep-high", "keep-low", "consider-high", "consider-low"],
);

console.log("Job filter sorting tests passed");
