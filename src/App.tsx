import React, { useState } from "react";
import { Navbar } from "./components/layout/Navbar";
import { Workspace } from "./components/layout/Workspace";
import { CandidateProfileModal } from "./components/modals/CandidateProfileModal";
import { ImportJobsModal } from "./components/modals/ImportJobsModal";
import { PruneConfirmModal } from "./components/modals/PruneConfirmModal";
import { ApplicantAnswerModal } from "./components/modals/ApplicantAnswerModal";
import { ShortlistExportModal } from "./components/modals/ShortlistExportModal";
import { LinkedInSyncModal } from "./components/modals/LinkedInSyncModal";
import { AdminPage } from "./components/pages/AdminPage";
import { usePersistentState } from "./hooks/usePersistentState";
import { useJobFilters } from "./hooks/useJobFilters";
import { useJobOperations } from "./hooks/useJobOperations";
import { AppContextProvider } from "./context/AppContext";

export default function App() {
	if (window.location.pathname === "/admin") return <AdminPage />;

	const {
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
	} = usePersistentState();
	const {
		activeFilter,
		setActiveFilter,
		searchQuery,
		setSearchQuery,
		sortBy,
		setSortBy,
		filteredJobs,
		jobsMarkedForPruning,
	} = useJobFilters(jobs);
	const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
	const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
	const [profileInitialTab, setProfileInitialTab] = useState<
		"context" | "rubric"
	>("context");
	const [isImportOpen, setIsImportOpen] = useState(false);
	const [isPruneConfirmOpen, setIsPruneConfirmOpen] = useState(false);
	const [isExportOpen, setIsExportOpen] = useState(false);
	const [isAnswerGenOpen, setIsAnswerGenOpen] = useState(false);
	const [answerGenSelectedJob, setAnswerGenSelectedJob] = useState<
		(typeof jobs)[number] | null
	>(null);
	const [isLinkedInSyncOpen, setIsLinkedInSyncOpen] = useState(false);
	const operations = useJobOperations({
		jobs,
		dispatchJobs,
		criteria,
		contextDoc,
		filteredJobs,
		setActiveFilter,
	});

	const openContextDoc = () => {
		setProfileInitialTab("context");
		setIsProfileModalOpen(true);
	};
	const openCriteria = () => {
		setProfileInitialTab("rubric");
		setIsProfileModalOpen(true);
	};
	const openAnswerGenerator = (job: (typeof jobs)[number] | null = null) => {
		setAnswerGenSelectedJob(job);
		setIsAnswerGenOpen(true);
	};

	const contextValue = {
		contextDoc,
		setContextDoc,
		criteria,
		setCriteria,
		jobs,
		setJobs,
		batchReport,
		setBatchReport,
		viewMode,
		setViewMode,
		activeFilter,
		setActiveFilter,
		searchQuery,
		setSearchQuery,
		sortBy,
		setSortBy,
		filteredJobs,
		jobsMarkedForPruning,
		...operations,
		expandedJobId,
		onToggleExpanded: (jobId: string) =>
			setExpandedJobId((current) => (current === jobId ? null : jobId)),
		onOpenLinkedInSync: () => setIsLinkedInSyncOpen(true),
		onOpenCriteria: openCriteria,
		onOpenImport: () => setIsImportOpen(true),
		onOpenExport: () => setIsExportOpen(true),
		onOpenContextDoc: openContextDoc,
		onOpenAnswerGeneratorMenu: () => openAnswerGenerator(),
		onOpenAnswerGenerator: (job: (typeof jobs)[number]) =>
			openAnswerGenerator(job),
		onOpenPruneConfirm: () => setIsPruneConfirmOpen(true),
	};

	return (
		<AppContextProvider value={contextValue}>
			<div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
				<Navbar />
				<Workspace />

				<CandidateProfileModal
					isOpen={isProfileModalOpen}
					onClose={() => setIsProfileModalOpen(false)}
					initialTab={profileInitialTab}
					contextDoc={contextDoc}
					onSaveContextDoc={setContextDoc}
					criteria={criteria}
					onSaveCriteria={setCriteria}
				/>
				<ImportJobsModal
					isOpen={isImportOpen}
					onClose={() => setIsImportOpen(false)}
					onAddJobs={operations.handleAddJobs}
				/>
				<PruneConfirmModal
					isOpen={isPruneConfirmOpen}
					onClose={() => setIsPruneConfirmOpen(false)}
					jobsToDelete={jobsMarkedForPruning}
					onConfirmPrune={operations.handleConfirmPrune}
				/>
				<ApplicantAnswerModal
					isOpen={isAnswerGenOpen}
					onClose={() => setIsAnswerGenOpen(false)}
					contextDoc={contextDoc}
					onOpenContextDocModal={() => {
						setIsAnswerGenOpen(false);
						openContextDoc();
					}}
					jobs={jobs}
					initialSelectedJob={answerGenSelectedJob}
				/>
				<ShortlistExportModal
					isOpen={isExportOpen}
					onClose={() => setIsExportOpen(false)}
					jobs={jobs}
				/>
				<LinkedInSyncModal
					isOpen={isLinkedInSyncOpen}
					onClose={() => setIsLinkedInSyncOpen(false)}
					jobs={jobs}
					onImportExtractedJson={operations.handleImportExtractedJson}
				/>
			</div>
		</AppContextProvider>
	);
}
