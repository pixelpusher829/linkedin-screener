import assert from "node:assert/strict";
import { evaluateJobHeuristically } from "../server";
import { DEFAULT_USER_CRITERIA } from "../src/data/defaultCriteria";
import { normalizeImportedJob } from "../src/hooks/jobOperationUtils";

const importedAt = new Date("2026-08-27T12:00:00.000Z");

const runImportTrace = (method: string, item: any) => {
	const importedJob = normalizeImportedJob(item, 0, importedAt);
	const analysis = evaluateJobHeuristically(
		importedJob,
		DEFAULT_USER_CRITERIA,
		"",
	);
	assert.ok(importedJob.title, `${method} should import a title`);
	assert.ok(importedJob.company, `${method} should import a company`);
	assert.ok(importedJob.location, `${method} should import a location`);
	assert.ok(
		importedJob.descriptionRaw,
		`${method} should import a description`,
	);
	return { importedJob, analysis };
};

const linksImport = runImportTrace("Links import", {
	url: "https://www.linkedin.com/jobs/view/4399820187/",
	title: "Frontend Engineer, Product UI",
	company: "Micromart",
	location: "Waterloo, Ontario, Canada",
	workplaceType: "Hybrid",
	headerRaw:
		"Frontend Engineer, Product UI · Micromart · Waterloo, Ontario, Canada · Hybrid",
	descriptionRaw: "Hybrid work environment, with access to our Toronto office.",
});
assert.equal(linksImport.importedJob.workplaceType, "Hybrid");
assert.equal(linksImport.analysis.locationFit, "Location Mismatch");

const pastedTrackerImport = runImportTrace("Pasted tracker import", {
	title: "Senior Frontend Engineer",
	company: "Tracker Company",
	location: "Canada",
	workplaceType: "Remote",
	headerRaw: "Senior Frontend Engineer · Tracker Company · Canada · Remote",
	descriptionSummary: "Remote frontend role.",
});
assert.equal(pastedTrackerImport.importedJob.workplaceType, "Remote");
assert.equal(
	pastedTrackerImport.analysis.locationFit,
	"Matches Remote/Location",
);

const bookmarkletImport = runImportTrace("Bookmarklet import", {
	title: "Senior UI Engineer",
	company: "Saved Jobs Company",
	location: "United States",
	workplaceType: "On-site",
	headerRaw: "Senior UI Engineer · Saved Jobs Company · United States · Remote",
	descriptionRaw:
		"Frontend role imported from the authenticated LinkedIn card.",
});
assert.equal(bookmarkletImport.importedJob.workplaceType, "Remote");
assert.equal(bookmarkletImport.analysis.locationFit, "Matches Remote/Location");
assert.equal(
	bookmarkletImport.analysis.dealbreakerTriggers.some((trigger) =>
		trigger.includes("Mandatory in-person"),
	),
	false,
);

const directUrlFallback = runImportTrace("Direct URL fallback", {
	url: "https://www.linkedin.com/jobs/view/1234567890/",
	title: "Unknown Job",
	company: "Unknown Company",
	location: "Unspecified",
	workplaceType: "Unknown",
	descriptionRaw: "Opportunity from the LinkedIn URL.",
});
assert.equal(directUrlFallback.importedJob.workplaceType, "Unknown");
assert.equal(directUrlFallback.analysis.locationFit, "Unspecified");
assert.equal(directUrlFallback.analysis.dealbreakerTriggers.length, 0);

const realLinkedInExamples = [
	{
		url: "https://www.linkedin.com/jobs/view/4434678441/",
		title: "Senior Web Developer",
		company: "Imagine Communications",
		location: "Scarborough, Ontario, Canada",
		workplaceType: "On-site",
		headerRaw:
			"Senior Web Developer · Imagine Communications · Scarborough, Ontario, Canada · On-site",
	},
	{
		url: "https://www.linkedin.com/jobs/view/4449667681/",
		title: "Senior Frontend Engineer",
		company: "Arkion Identity Systems",
		location: "Greater Toronto Area, Canada",
		workplaceType: "Hybrid",
		headerRaw:
			"Senior Frontend Engineer · Arkion Identity Systems · Greater Toronto Area, Canada · Hybrid",
	},
	{
		url: "https://www.linkedin.com/jobs/view/4400582587/",
		title: "Senior Frontend Engineer",
		company: "Rush Street Interactive",
		location: "Canada",
		workplaceType: "Remote",
		headerRaw:
			"Senior Frontend Engineer · Rush Street Interactive · Canada · Remote",
	},
];

for (const example of realLinkedInExamples) {
	const result = runImportTrace(`Real LinkedIn ${example.company}`, example);
	assert.equal(result.importedJob.workplaceType, example.workplaceType);
	assert.equal(
		result.analysis.dealbreakerTriggers.some((trigger) =>
			trigger.includes("Mandatory in-person"),
		),
		example.workplaceType !== "Remote",
	);
}

console.log("All import method traces passed");
