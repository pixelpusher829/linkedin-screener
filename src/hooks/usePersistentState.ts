import {
	useEffect,
	useReducer,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";
import { DEFAULT_CONTEXT_DOC } from "../data/defaultContextDoc";
import { DEFAULT_USER_CRITERIA } from "../data/defaultCriteria";
import { BatchSummaryReport, JobPosting, UserCriteria } from "../types";
import { jobReducer, JobState } from "./jobReducer";

export function normalizeTargetTitles(criteria: UserCriteria): UserCriteria {
	const seniority =
		criteria.seniorityLevels?.find((level) => /senior/i.test(level)) ||
		"Senior";
	const titlePattern =
		/\b(junior|jr\.?|mid[- ]?level|intermediate|senior|sr\.?|lead|staff|principal|architect|manager)\b/i;
	const titleMap = new Map<string, string>();
	const targetJobTitles = (criteria.targetJobTitles || []).map((title) => {
		const normalizedTitle = titlePattern.test(title)
			? title
			: `${seniority} ${title}`;
		titleMap.set(title, normalizedTitle);
		return normalizedTitle;
	});
	const oldTitleWeights = criteria.weighting?.titleWeights || {};
	const titleWeights = Object.fromEntries(
		Object.entries(oldTitleWeights).map(([title, weight]) => [
			titleMap.get(title) || title,
			weight,
		]),
	);

	const weightingWithLegacy = criteria.weighting as
		| (NonNullable<typeof criteria.weighting> & {
				locationWeights?: Record<string, number>;
				scoreWeights?: NonNullable<
					typeof criteria.weighting
				>["scoreWeights"] & {
					missingRequiredSkill?: number;
				};
		  })
		| undefined;
	const {
		locationWeights: _removedLocationWeights,
		scoreWeights,
		...weighting
	} = weightingWithLegacy || {};
	const {
		missingRequiredSkill: _removedMissingRequiredSkill,
		...cleanScoreWeights
	} = scoreWeights || {};
	return {
		...criteria,
		targetJobTitles,
		weighting: criteria.weighting
			? { ...weighting, titleWeights, scoreWeights: cleanScoreWeights }
			: criteria.weighting,
	};
}

const isSampleJob = (job: JobPosting) => job.id.startsWith("job-demo-");

function getInitialJobState(): JobState {
	let jobs: JobPosting[] = [];
	let batchReport: BatchSummaryReport | null = null;
	try {
		const savedJobs = localStorage.getItem("linkedin_screener_jobs");
		if (savedJobs) {
			const parsed = JSON.parse(savedJobs);
			if (Array.isArray(parsed))
				jobs = parsed.filter((job) => !isSampleJob(job));
		}
		const savedReport = localStorage.getItem("linkedin_screener_report");
		if (savedReport) batchReport = JSON.parse(savedReport);
	} catch {}
	return { jobs, batchReport };
}

export function usePersistentState() {
	const [contextDoc, setContextDoc] = useState(() => {
		const saved = localStorage.getItem("applicant_context_doc");
		return saved !== null && saved.trim() ? saved : DEFAULT_CONTEXT_DOC;
	});
	const [criteria, setCriteria] = useState<UserCriteria>(() => {
		const saved = localStorage.getItem("linkedin_screener_criteria");
		if (saved !== null) {
			try {
				const parsed = JSON.parse(saved);
				if (parsed && typeof parsed === "object")
					return normalizeTargetTitles(parsed as UserCriteria);
			} catch {}
		}
		return DEFAULT_USER_CRITERIA;
	});
	const [jobState, dispatchJobs] = useReducer(
		jobReducer,
		undefined,
		getInitialJobState,
	);
	const { jobs, batchReport } = jobState;
	const setJobs: Dispatch<SetStateAction<JobPosting[]>> = (update) =>
		dispatchJobs({
			type: "REPLACE_JOBS",
			jobs: typeof update === "function" ? update(jobState.jobs) : update,
		});
	const setBatchReport: Dispatch<SetStateAction<BatchSummaryReport | null>> = (
		update,
	) =>
		dispatchJobs({
			type: "SET_REPORT",
			report:
				typeof update === "function" ? update(jobState.batchReport) : update,
		});
	const [viewMode, setViewMode] = useState<"detailed" | "compact">(() =>
		localStorage.getItem("linkedin_view_mode") === "compact"
			? "compact"
			: "detailed",
	);
	useEffect(() => {
		localStorage.setItem("applicant_context_doc", contextDoc);
		localStorage.setItem(
			"linkedin_screener_criteria",
			JSON.stringify(criteria),
		);
		localStorage.setItem("linkedin_screener_jobs", JSON.stringify(jobs));
		localStorage.setItem("linkedin_view_mode", viewMode);
		if (batchReport)
			localStorage.setItem(
				"linkedin_screener_report",
				JSON.stringify(batchReport),
			);
		else localStorage.removeItem("linkedin_screener_report");
	}, [jobs, criteria, contextDoc, viewMode, batchReport]);

	return {
		contextDoc,
		setContextDoc,
		criteria,
		setCriteria,
		jobs,
		setJobs,
		dispatchJobs,
		batchReport,
		setBatchReport,
		viewMode,
		setViewMode,
	};
}
