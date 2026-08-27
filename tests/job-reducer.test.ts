import assert from "node:assert/strict";
import { jobReducer, JobState } from "../src/hooks/jobReducer";
import { JobPosting } from "../src/types";

const makeJob = (id: string): JobPosting => ({
	id,
	url: `https://example.com/${id}`,
	title: `Job ${id}`,
	company: "Test Company",
	location: "Montreal, QC",
	workplaceType: "Remote",
	descriptionRaw: "Remote role",
	source: "paste",
	status: "to_qualify",
	createdAt: "2026-08-27T12:00:00.000Z",
	updatedAt: "2026-08-27T12:00:00.000Z",
});

const initial: JobState = {
	jobs: [makeJob("one")],
	batchReport: {
		totalJobsAnalyzed: 1,
		strongKeepCount: 0,
		considerCount: 0,
		removeCount: 1,
		averageScore: 20,
		topMatches: [],
		recommendedPrune: [],
		overallVerdictSummary: "old report",
	},
};

const added = jobReducer(initial, {
	type: "ADD_JOBS",
	jobs: [makeJob("two"), makeJob("one")],
});
assert.deepEqual(
	added.jobs.map((job) => job.id),
	["two", "one"],
);

const deleted = jobReducer(added, { type: "DELETE_JOB", jobId: "two" });
assert.deepEqual(
	deleted.jobs.map((job) => job.id),
	["one"],
);

const marked = jobReducer(deleted, { type: "TOGGLE_DELETION", jobId: "one" });
assert.equal(marked.jobs[0].isSelectedForDeletion, true);
assert.equal(marked.jobs[0].status, "discard");

const applied = jobReducer(marked, { type: "TOGGLE_APPLIED", jobId: "one" });
assert.equal(applied.jobs[0].status, "applied");

const replaced = jobReducer(applied, {
	type: "REPLACE_JOBS",
	jobs: [makeJob("three")],
});
assert.deepEqual(
	replaced.jobs.map((job) => job.id),
	["three"],
);

const pruned = jobReducer(initial, {
	type: "CONFIRM_PRUNE",
	jobIdsToDelete: ["one"],
	jobIdsToKeep: [],
});
assert.equal(pruned.jobs.length, 0);
assert.equal(pruned.batchReport, null);

const reported = jobReducer(pruned, {
	type: "SET_REPORT",
	report: initial.batchReport,
});
assert.equal(reported.batchReport?.overallVerdictSummary, "old report");
const cleared = jobReducer(reported, { type: "CLEAR_REPORT" });
assert.equal(cleared.batchReport, null);

console.log("Job reducer tests passed");
