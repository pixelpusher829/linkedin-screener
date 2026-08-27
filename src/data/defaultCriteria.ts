import { UserCriteria } from "../types";

// Generic starter template — every field is meant to be replaced via the
// Screening Rubric editor (or the context-doc auto-sync) with the user's own
// job search criteria. No values here should assume a specific person, role
// focus, or region.
export const DEFAULT_USER_CRITERIA: UserCriteria = {
	fullName: "",
	targetJobTitles: [],
	seniorityLevel: "Unspecified / Open",
	seniorityLevels: ["Unspecified / Open"],
	yearsOfExperience: 0,
	techStackRequired: [],
	techStackNiceToHave: [],
	locationPreferences: {
		homeLocation: "",
		allowHomeOnsiteHybrid: true,
		remoteOnly: false,
		allowedRemoteRegions: [],
		allowedLocations: [],
		requiresSponsorship: false,
	},
	minSalary: 0,
	salaryCurrency: "USD",
	dealbreakers: [],
	preferredIndustries: [],
	weighting: {
		titleWeights: {},
		seniorityWeights: {
			"Mid-Level": 5,
			Senior: 5,
			"Unspecified / Open": 5,
			"Staff / Lead": 0,
			"Principal / Architect": 0,
			"Engineering Manager": 0,
			"Junior / Intern": -10,
		},
		locationWeights: {},
		workTypeWeights: { Remote: 0, Hybrid: 0, "On-site": 0, Contract: 0 },
		scoreBands: { pruneBelow: 50, keepAt: 75 },
		scoreWeights: {
			base: 30,
			remote: 0,
			canada: 0,
			usRemote: 0,
			midLevel: 5,
			unspecifiedSeniority: 5,
			senior: 5,
			leadStaff: 0,
			strictEducation: -10,
			requiredSkill: 3,
			niceSkill: 1,
			missingRequiredSkill: -3,
			junior: -15,
			homeLocation: 10,
			nonLocalOnsite: -20,
			salaryAbove: 10,
			salaryWithin: 5,
			salaryBelow: -15,
			strongKeepThreshold: 75,
		},
	},
	customEvaluationPrompt: "",
};
