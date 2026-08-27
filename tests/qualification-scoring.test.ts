import assert from "node:assert/strict";
import { evaluateJobHeuristically } from "../server";

const baseCriteria = {
	targetJobTitles: ["Frontend Engineer"],
	techStackRequired: ["React", "TypeScript"],
	techStackNiceToHave: ["GraphQL"],
	minSalary: 100000,
	dealbreakers: [] as string[],
	locationPreferences: { homeLocation: "Montreal, QC" },
	weighting: {
		scoreBands: { pruneBelow: 50, keepAt: 75 },
	},
};

const makeJob = (overrides: Record<string, any> = {}) => ({
	title: "Frontend Engineer",
	company: "Acme",
	location: "Remote",
	workplaceType: "Remote",
	descriptionRaw: "Build UI with React and TypeScript.",
	...overrides,
});

// Scorecard weight changes must actually move the score.
{
	const lowWeight = evaluateJobHeuristically(makeJob(), {
		...baseCriteria,
		weighting: {
			...baseCriteria.weighting,
			scoreWeights: { requiredSkill: 1 },
		},
	});
	const highWeight = evaluateJobHeuristically(makeJob(), {
		...baseCriteria,
		weighting: {
			...baseCriteria.weighting,
			scoreWeights: { requiredSkill: 10 },
		},
	});
	assert.ok(
		highWeight.score > lowWeight.score,
		"raising the 'Required skill' scorecard weight should raise the score",
	);
}

// Missing-required-skill penalty scales with the number of missing skills and
// respects the configured weight (not a hardcoded value).
{
	const result = evaluateJobHeuristically(
		makeJob({ descriptionRaw: "No relevant stack mentioned here." }),
		{
			...baseCriteria,
			weighting: {
				...baseCriteria.weighting,
				scoreWeights: { missingRequiredSkill: -3 },
			},
		},
	);
	const row = result.scoreBreakdown.find(
		(r: any) => r.label === "Missing required skills",
	);
	assert.ok(row, "expected a 'Missing required skills' score row");
	// 2 required skills missing * -3 each = -6
	assert.equal(row.points, -6);
}

// Custom scoring rules: a matching keyword applies its configured weight exactly once.
{
	const withCustomSignal = evaluateJobHeuristically(
		makeJob({ descriptionRaw: "React, TypeScript, and travel up to 50%." }),
		{
			...baseCriteria,
			weighting: {
				...baseCriteria.weighting,
				customSignals: [
					{
						id: "1",
						name: "Travel required",
						keywords: ["travel"],
						weight: -15,
					},
				],
			},
		},
	);
	const row = withCustomSignal.scoreBreakdown.find(
		(r: any) => r.label === "Travel required",
	);
	assert.ok(
		row,
		"custom signal should appear in the score breakdown when matched",
	);
	assert.equal(row.points, -15);

	const withoutMatch = evaluateJobHeuristically(makeJob(), {
		...baseCriteria,
		weighting: {
			...baseCriteria.weighting,
			customSignals: [
				{ id: "1", name: "Travel required", keywords: ["travel"], weight: -15 },
			],
		},
	});
	assert.equal(
		withoutMatch.scoreBreakdown.some((r: any) => r.label === "Travel required"),
		false,
		"custom signal must not apply when none of its keywords are present",
	);
}

// Hardcoded red-flag phrases (clearance, staffing agency, legacy stack, US residency)
// must NOT force a dealbreaker/score-cap unless the user actually configured that
// dealbreaker themselves — otherwise they'd silently override the user's scorecard.
{
	const withoutDealbreakerConfigured = evaluateJobHeuristically(
		makeJob({
			descriptionRaw:
				"React and TypeScript role. This is a staffing agency posting requiring active security clearance.",
		}),
		{ ...baseCriteria, dealbreakers: [] },
	);
	assert.equal(
		withoutDealbreakerConfigured.verdict === "REMOVE",
		false,
		"should not auto-REMOVE for clearance/staffing-agency phrases the user never opted into",
	);
	assert.equal(withoutDealbreakerConfigured.dealbreakerTriggers.length, 0);

	const withDealbreakerConfigured = evaluateJobHeuristically(
		makeJob({
			descriptionRaw:
				"React and TypeScript role. This is a staffing agency posting requiring active security clearance.",
		}),
		{ ...baseCriteria, dealbreakers: ["Staffing Agency", "US Citizen Only"] },
	);
	assert.equal(withDealbreakerConfigured.verdict, "REMOVE");
	assert.ok(withDealbreakerConfigured.dealbreakerTriggers.length >= 2);
}

// Score bands must drive the verdict boundaries the user configured.
{
	const strictBands = evaluateJobHeuristically(makeJob(), {
		...baseCriteria,
		weighting: {
			...baseCriteria.weighting,
			scoreBands: { pruneBelow: 90, keepAt: 95 },
		},
	});
	assert.equal(
		strictBands.verdict === "STRONG_KEEP",
		false,
		"a strict keepAt threshold should prevent an ordinary job from being STRONG_KEEP",
	);
}

console.log("qualification-scoring.test.ts: all assertions passed");
