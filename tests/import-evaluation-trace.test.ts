import assert from "node:assert/strict";
import { evaluateJobHeuristically } from "../server";
import { DEFAULT_USER_CRITERIA } from "../src/data/defaultCriteria";
import { normalizeImportedJob } from "../src/hooks/jobOperationUtils";
import imports from "./fixtures/linkedin-job-imports.json";

const trace = imports.map((rawItem, index) => {
	const importedJob = normalizeImportedJob(rawItem, index);
	const analysis = evaluateJobHeuristically(
		importedJob,
		DEFAULT_USER_CRITERIA,
		"",
	);
	return { rawItem, importedJob, analysis };
});

const micromart = trace[0];
assert.equal(micromart.importedJob.title, "Frontend Engineer, Product UI");
assert.equal(micromart.importedJob.location, "Waterloo, Ontario, Canada");
assert.equal(micromart.importedJob.workplaceType, "Hybrid");
assert.equal(micromart.analysis.locationFit, "Location Mismatch");

const remote = trace[1];
assert.equal(remote.importedJob.headerRaw?.endsWith("Remote"), true);
assert.equal(remote.importedJob.workplaceType, "Remote");
assert.equal(remote.analysis.locationFit, "Matches Remote/Location");
assert.equal(
	remote.analysis.dealbreakerTriggers.some((trigger) =>
		trigger.includes("Mandatory in-person"),
	),
	false,
);

console.log(
	JSON.stringify(
		trace.map(({ rawItem, importedJob, analysis }) => ({
			input: {
				title: rawItem.title,
				location: rawItem.location,
				workplaceType: rawItem.workplaceType,
				headerRaw: rawItem.headerRaw,
			},
			imported: {
				workplaceType: importedJob.workplaceType,
				headerRaw: importedJob.headerRaw,
			},
			evaluation: {
				locationFit: analysis.locationFit,
				dealbreakerTriggers: analysis.dealbreakerTriggers,
			},
		})),
		null,
		2,
	),
);
console.log("Import-to-evaluation trace passed");
