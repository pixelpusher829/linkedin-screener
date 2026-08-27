import assert from "node:assert/strict";
import { evaluateJobHeuristically } from "../server";
import { DEFAULT_USER_CRITERIA } from "../src/data/defaultCriteria";
import { normalizeImportedJob } from "../src/hooks/jobOperationUtils";

const makeJob = (descriptionRaw: string, workplaceType: string) => ({
	id: "test-job",
	title: "Senior Frontend Engineer",
	company: "LinkedIn Test Company",
	location: "United States",
	workplaceType,
	headerRaw: descriptionRaw.split("\n")[0],
	descriptionRaw,
	salaryRaw: "",
});

const remoteHeader = evaluateJobHeuristically(
	makeJob(
		"Remote\nSenior Frontend Engineer building React products.",
		"On-site",
	),
	DEFAULT_USER_CRITERIA,
	"",
);
assert.equal(remoteHeader.locationFit, "Matches Remote/Location");
assert.equal(
	remoteHeader.dealbreakerTriggers.some((trigger) =>
		trigger.includes("Mandatory in-person"),
	),
	false,
);

const hybridHeader = evaluateJobHeuristically(
	makeJob(
		"Hybrid\nSenior Frontend Engineer building React products.",
		"Unknown",
	),
	DEFAULT_USER_CRITERIA,
	"",
);
assert.equal(hybridHeader.locationFit, "Location Mismatch");
assert.equal(
	hybridHeader.dealbreakerTriggers.some((trigger) =>
		trigger.includes("Mandatory in-person"),
	),
	true,
);

const onsiteHeader = evaluateJobHeuristically(
	makeJob(
		"On-site\nSenior Frontend Engineer building React products.",
		"On-site",
	),
	DEFAULT_USER_CRITERIA,
	"",
);
assert.equal(onsiteHeader.locationFit, "Location Mismatch");
assert.equal(
	onsiteHeader.dealbreakerTriggers.some((trigger) =>
		trigger.includes("Mandatory in-person"),
	),
	true,
);

const missingWorkplace = evaluateJobHeuristically(
	makeJob("Senior Frontend Engineer building React products.", "Unknown"),
	DEFAULT_USER_CRITERIA,
	"",
);
assert.equal(missingWorkplace.locationFit, "Unspecified");
assert.equal(missingWorkplace.dealbreakerTriggers.length, 0);

const micromart = normalizeImportedJob(
	{
		url: "https://www.linkedin.com/jobs/view/4399820187/",
		title: "Frontend Engineer, Product UI",
		company: "Micromart",
		location: "Waterloo, Ontario, Canada",
		workplaceType: "On-site",
		headerRaw:
			"Frontend Engineer, Product UI · Micromart · Waterloo, Ontario, Canada · Hybrid",
		descriptionRaw:
			"Hybrid work environment, with access to our Toronto office.",
	},
	0,
);
assert.equal(micromart.workplaceType, "Hybrid");

const micromartAnalysis = evaluateJobHeuristically(
	micromart,
	DEFAULT_USER_CRITERIA,
	"",
);
assert.equal(micromartAnalysis.locationFit, "Location Mismatch");
assert.equal(
	micromartAnalysis.dealbreakerTriggers.some((trigger) =>
		trigger.includes("Mandatory in-person"),
	),
	true,
);

console.log("Workplace classification tests passed");
