import assert from "node:assert/strict";

// Integration test: exercises the real HTTP path the UI actually calls
// (fetch -> POST /api/qualify-batch -> evaluateJobHeuristically -> response),
// instead of only unit-testing the scoring function in isolation. This is what
// would have caught "the UI shows no change" style bugs: a stale rubric shape,
// a dropped field in transit, or the endpoint silently ignoring criteria.
//
// The endpoint requires an authenticated admin session, so we set test-only
// admin credentials before importing the server module (dotenv won't override
// values already present in process.env) and mint a matching session cookie.
process.env.ADMIN_EMAIL = "test-admin@example.com";
process.env.SESSION_SECRET = "test-only-session-secret";
const { app, createSignedSession } = await import("../server");
const sessionCookie = `linkedin_screener_session=${createSignedSession("test-admin@example.com")}`;

const server = app.listen(0);
const { port } = server.address() as { port: number };
const baseUrl = `http://127.0.0.1:${port}`;

const designJob = {
	id: "design-job",
	url: "https://example.com/jobs/design-1",
	title: "Senior Front End Developer",
	company: "Instrument",
	location: "United States",
	workplaceType: "Unknown",
	source: "direct_link",
	status: "to_qualify",
	descriptionRaw:
		"We bring strategy, design, and engineering together. Strong figma and interaction design collaboration with a component library and design system.",
};

const backendJob = {
	id: "backend-job",
	url: "https://example.com/jobs/backend-1",
	title: "Senior Front End Developer",
	company: "InfraCo",
	location: "United States",
	workplaceType: "Unknown",
	source: "direct_link",
	status: "to_qualify",
	descriptionRaw:
		"Own our microservices and distributed systems running on kubernetes and terraform, plus backend services in golang and devops/site reliability work.",
};

const baseCriteria = {
	targetJobTitles: ["Senior Front End Developer"],
	techStackRequired: ["React", "TypeScript"],
	dealbreakers: [] as string[],
	minSalary: 0,
	locationPreferences: { homeLocation: "Montreal, QC" },
	weighting: {
		scoreBands: { pruneBelow: 40, keepAt: 70 },
	},
};

const criteriaWithCustomSignals = {
	...baseCriteria,
	weighting: {
		...baseCriteria.weighting,
		customSignals: [
			{
				id: "design",
				name: "Design/UX signal",
				keywords: ["design system", "figma", "interaction design"],
				weight: 12,
			},
			{
				id: "engineering",
				name: "Heavy engineering",
				keywords: ["microservices", "kubernetes", "terraform", "devops"],
				weight: -15,
			},
		],
	},
};

async function qualifyBatch(jobs: any[], criteria: any) {
	const res = await fetch(`${baseUrl}/api/qualify-batch`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: sessionCookie },
		body: JSON.stringify({ jobs, criteria, contextDoc: "" }),
	});
	assert.equal(res.status, 200, "qualify-batch should respond 200");
	return res.json();
}

try {
	// Without any custom rules configured, design vs. engineering-heavy jobs
	// should score identically on that dimension (reproducing the reported bug).
	const withoutRules = await qualifyBatch(
		[designJob, backendJob],
		baseCriteria,
	);
	const designNoRules = withoutRules.jobs.find(
		(j: any) => j.id === "design-job",
	);
	const backendNoRules = withoutRules.jobs.find(
		(j: any) => j.id === "backend-job",
	);
	assert.equal(
		designNoRules.analysis.scoreBreakdown.some(
			(r: any) =>
				r.label === "Design/UX signal" || r.label === "Heavy engineering",
		),
		false,
		"with no custom rules configured, no design/engineering row should appear",
	);
	assert.equal(designNoRules.analysis.score, backendNoRules.analysis.score);

	// With the custom rules configured, the two jobs must diverge and the
	// response must actually carry the custom rule labels through the full
	// HTTP round trip.
	const withRules = await qualifyBatch(
		[designJob, backendJob],
		criteriaWithCustomSignals,
	);
	const designWithRules = withRules.jobs.find(
		(j: any) => j.id === "design-job",
	);
	const backendWithRules = withRules.jobs.find(
		(j: any) => j.id === "backend-job",
	);

	const designRow = designWithRules.analysis.scoreBreakdown.find(
		(r: any) => r.label === "Design/UX signal",
	);
	assert.ok(
		designRow,
		"design job response should include the Design/UX signal row",
	);
	assert.equal(designRow.points, 12);

	const engineeringRow = backendWithRules.analysis.scoreBreakdown.find(
		(r: any) => r.label === "Heavy engineering",
	);
	assert.ok(
		engineeringRow,
		"backend job response should include the Heavy engineering row",
	);
	assert.equal(engineeringRow.points, -15);

	assert.ok(
		designWithRules.analysis.score > backendWithRules.analysis.score,
		"design-focused job should score higher than the engineering-heavy job once custom rules are configured",
	);

	console.log("qualify-batch-endpoint.test.ts: all assertions passed");
} finally {
	server.close();
}
