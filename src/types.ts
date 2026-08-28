export type WorkplaceType = "Remote" | "Hybrid" | "On-site" | "Unknown";
export type RecommendationVerdict = "STRONG_KEEP" | "CONSIDER" | "REMOVE";
export type JobStatus =
	| "to_qualify"
	| "qualifying"
	| "keep"
	| "discard"
	| "applied"
	| "interviewing"
	| "archived";

export interface CustomSignal {
	id: string;
	name: string;
	/** Keyword/phrase matches (case-insensitive) against the job title + description. */
	keywords: string[];
	/** Points applied once if any keyword matches; negative to penalize, positive to reward. */
	weight: number;
}

export interface RubricWeighting {
	/** Numeric scoring levers. Positive values reward a signal; negative values penalize it. */
	scoreWeights?: Partial<ScoreWeights>;
	/** Optional per-skill overrides, keyed by the exact skill name in the rubric. */
	skillWeights?: Record<string, number>;
	titleWeights?: Record<string, number>;
	seniorityWeights?: Record<string, number>;
	workTypeWeights?: Record<string, number>;
	/** Fully user-defined scoring rules, evaluated in addition to the built-in levers. */
	customSignals?: CustomSignal[];
	scoreBands?: {
		pruneBelow: number;
		keepAt: number;
	};
}

export interface ScoreWeights {
	base: number;
	remote: number;
	midLevel: number;
	unspecifiedSeniority: number;
	senior: number;
	leadStaff: number;
	strictEducation: number;
	requiredSkill: number;
	niceSkill: number;
	junior: number;
	homeLocation: number;
	nonLocalOnsite: number;
	salaryAbove: number;
	salaryWithin: number;
	salaryBelow: number;
	strongKeepThreshold: number;
}

export interface UserCriteria {
	fullName: string;
	targetJobTitles: string[];
	seniorityLevel: string;
	seniorityLevels?: string[];
	yearsOfExperience: number;
	techStackRequired: string[];
	techStackNiceToHave: string[];
	locationPreferences: {
		homeLocation?: string;
		allowHomeOnsiteHybrid?: boolean;
		outsideHomeCountryConsider?: boolean;
		remoteOnly: boolean;
		allowedRemoteRegions?: string[];
		allowedLocations: string[];
		requiresSponsorship: boolean;
	};
	minSalary: number;
	salaryCurrency?: "CAD" | "USD";
	dealbreakers: string[];
	preferredIndustries: string[];
	customEvaluationPrompt: string;
	weighting?: RubricWeighting;
}

export interface JobAnalysis {
	score: number; // 0 to 100
	scoreBreakdown?: { label: string; points: number }[];
	verdict: RecommendationVerdict;
	confidence: "HIGH" | "MEDIUM" | "LOW";
	oneSentenceSummary: string;
	keyPros: string[];
	keyCons: string[];
	dealbreakerTriggers: string[];
	matchedSkills: string[];
	missingSkills: string[];
	salaryFit:
		| "Above Target"
		| "Within Target"
		| "Below Target"
		| "Not Disclosed";
	experienceFit:
		| "Matches"
		| "Slight Stretch"
		| "Overqualified"
		| "Underqualified";
	locationFit: "Matches Remote/Location" | "Location Mismatch" | "Unspecified";
	isOutsideHomeCountry?: boolean;
	requiresOutsideHomeCountryReview?: boolean;
	tailoredPitch: string;
	resumeHighlights: string[];
	actionRecommendation: string;
}

export interface JobPosting {
	id: string;
	url: string;
	title: string;
	company: string;
	location: string;
	workplaceType: WorkplaceType;
	headerRaw?: string;
	salaryRaw?: string;
	salaryEstimatedMin?: number;
	salaryEstimatedMax?: number;
	postedDate?: string;
	descriptionRaw: string;
	source: "linkedin_tracker" | "direct_link" | "paste";
	status: JobStatus;
	analysis?: JobAnalysis;
	isSelectedForDeletion?: boolean;
	notes?: string;
	appliedDate?: string;
	createdAt: string;
	updatedAt: string;
}

export interface BatchSummaryReport {
	totalJobsAnalyzed: number;
	strongKeepCount: number;
	considerCount: number;
	removeCount: number;
	averageScore: number;
	topMatches: {
		id: string;
		title: string;
		company: string;
		score: number;
		reason: string;
	}[];
	recommendedPrune: {
		id: string;
		title: string;
		company: string;
		score: number;
		mainIssue: string;
	}[];
	overallVerdictSummary: string;
}
