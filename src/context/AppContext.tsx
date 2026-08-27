import {
	createContext,
	useContext,
	type Dispatch,
	type SetStateAction,
	type ReactNode,
} from "react";
import { BatchSummaryReport, JobPosting, UserCriteria } from "../types";
import { ActiveFilter, SortBy } from "../hooks/useJobFilters";

export interface AppContextValue {
	jobs: JobPosting[];
	setJobs: Dispatch<SetStateAction<JobPosting[]>>;
	contextDoc: string;
	setContextDoc: Dispatch<SetStateAction<string>>;
	criteria: UserCriteria;
	setCriteria: Dispatch<SetStateAction<UserCriteria>>;
	batchReport: BatchSummaryReport | null;
	setBatchReport: Dispatch<SetStateAction<BatchSummaryReport | null>>;
	viewMode: "detailed" | "compact";
	setViewMode: Dispatch<SetStateAction<"detailed" | "compact">>;
	activeFilter: ActiveFilter;
	setActiveFilter: (filter: ActiveFilter) => void;
	searchQuery: string;
	setSearchQuery: (query: string) => void;
	sortBy: SortBy;
	setSortBy: (sort: SortBy) => void;
	filteredJobs: JobPosting[];
	jobsMarkedForPruning: JobPosting[];
	isQualifying: boolean;
	blockedTabJobs: JobPosting[];
	showPopupHelp: boolean;
	setBlockedTabJobs: (jobs: JobPosting[]) => void;
	handleRunBatchQualify: () => Promise<void>;
	handleToggleDeletion: (jobId: string) => void;
	handleToggleApplied: (jobId: string) => void;
	handleDeleteSingle: (jobId: string) => void;
	handleConfirmPrune: (keepIds: string[], deleteIds: string[]) => void;
	handleAddJobs: (jobs: JobPosting[]) => void;
	handleImportExtractedJson: (input: string) => void;
	handleOpenAllAsTabs: () => void;
	handleRetryRemainingTabs: () => void;
	expandedJobId: string | null;
	onToggleExpanded: (jobId: string) => void;
	onOpenLinkedInSync: () => void;
	onOpenCriteria: () => void;
	onOpenImport: () => void;
	onOpenExport: () => void;
	onOpenContextDoc: () => void;
	onOpenAnswerGeneratorMenu: () => void;
	onOpenAnswerGenerator: (job: JobPosting) => void;
	onOpenPruneConfirm: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext() {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error("useAppContext must be used inside AppContext.Provider");
	}
	return context;
}

export function AppContextProvider({
	value,
	children,
}: {
	value: AppContextValue;
	children: ReactNode;
}) {
	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
