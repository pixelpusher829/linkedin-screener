import { BatchSummaryReport, JobPosting } from "../types";
import {
	addUniqueJobs,
	confirmPrune,
	deleteJob,
	toggleApplied,
	toggleDeletion,
} from "./jobOperationUtils";

export interface JobState {
	jobs: JobPosting[];
	batchReport: BatchSummaryReport | null;
}

export type JobAction =
	| { type: "REPLACE_JOBS"; jobs: JobPosting[] }
	| { type: "ADD_JOBS"; jobs: JobPosting[] }
	| { type: "TOGGLE_DELETION"; jobId: string }
	| { type: "TOGGLE_APPLIED"; jobId: string; now?: Date }
	| { type: "DELETE_JOB"; jobId: string }
	| {
			type: "CONFIRM_PRUNE";
			jobIdsToKeep: string[];
			jobIdsToDelete: string[];
	  }
	| { type: "SET_REPORT"; report: BatchSummaryReport | null }
	| { type: "CLEAR_REPORT" };

export function jobReducer(state: JobState, action: JobAction): JobState {
	switch (action.type) {
		case "REPLACE_JOBS":
			return { ...state, jobs: action.jobs };
		case "ADD_JOBS":
			return { ...state, jobs: addUniqueJobs(state.jobs, action.jobs).jobs };
		case "TOGGLE_DELETION":
			return { ...state, jobs: toggleDeletion(state.jobs, action.jobId) };
		case "TOGGLE_APPLIED":
			return {
				...state,
				jobs: toggleApplied(state.jobs, action.jobId, action.now),
			};
		case "DELETE_JOB":
			return { ...state, jobs: deleteJob(state.jobs, action.jobId) };
		case "CONFIRM_PRUNE":
			return {
				...state,
				jobs: confirmPrune(
					state.jobs,
					action.jobIdsToDelete,
					action.jobIdsToKeep,
				),
				batchReport: null,
			};
		case "SET_REPORT":
			return { ...state, batchReport: action.report };
		case "CLEAR_REPORT":
			return { ...state, batchReport: null };
	}
}
