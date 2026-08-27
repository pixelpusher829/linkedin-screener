import assert from "node:assert/strict";
import {
	addUniqueJobs,
	confirmPrune,
	deleteJob,
	normalizeImportedJob,
	toggleApplied,
	toggleDeletion,
} from "../src/hooks/jobOperationUtils";
import { JobPosting } from "../src/types";

const now = new Date("2026-08-27T12:00:00.000Z");
const makeJob = (
	id: string,
	overrides: Partial<JobPosting> = {},
): JobPosting => ({
	id,
	url: `https://www.linkedin.com/jobs/view/${id}/`,
	title: `Job ${id}`,
	company: "Test Company",
	location: "Montreal, QC",
	workplaceType: "Remote",
	descriptionRaw: "Remote role",
	source: "linkedin_tracker",
	status: "to_qualify",
	createdAt: now.toISOString(),
	updatedAt: now.toISOString(),
	...overrides,
});

const importedRemote = normalizeImportedJob(
	{
		title: "Senior Frontend Engineer",
		location: "United States",
		workplaceType: "On-site",
		headerRaw:
			"Senior Frontend Engineer · Test Company · United States · Remote",
		descriptionSummary: "Remote",
	},
	0,
	now,
);
assert.equal(importedRemote.workplaceType, "Remote");
assert.equal(importedRemote.status, "to_qualify");

const firstJob = makeJob("1");
const duplicateJob = makeJob("1", { title: "Different title" });
const secondJob = makeJob("2");
const merged = addUniqueJobs([firstJob], [duplicateJob, secondJob]);
assert.deepEqual(
	merged.jobs.map((job) => job.id),
	["2", "1"],
);
assert.equal(merged.duplicateCount, 1);

const marked = toggleDeletion([firstJob], "1")[0];
assert.equal(marked.isSelectedForDeletion, true);
assert.equal(marked.status, "discard");
const unmarked = toggleDeletion([marked], "1")[0];
assert.equal(unmarked.isSelectedForDeletion, false);
assert.equal(unmarked.status, "keep");

const applied = toggleApplied([firstJob], "1", now)[0];
assert.equal(applied.status, "applied");
assert.equal(applied.appliedDate, now.toISOString());
const unapplied = toggleApplied([applied], "1", now)[0];
assert.equal(unapplied.status, "keep");
assert.equal(unapplied.appliedDate, undefined);

assert.deepEqual(
	deleteJob([firstJob, secondJob], "1").map((job) => job.id),
	["2"],
);

const pruned = confirmPrune(
	[
		makeJob("1", { status: "discard", isSelectedForDeletion: true }),
		makeJob("2", { status: "discard", isSelectedForDeletion: true }),
	],
	["1"],
	["2"],
);
assert.deepEqual(
	pruned.map((job) => job.id),
	["2"],
);
assert.equal(pruned[0].status, "keep");
assert.equal(pruned[0].isSelectedForDeletion, false);

console.log("Job action tests passed");
