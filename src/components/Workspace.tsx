import React from "react";
import {
	ArrowUpDown,
	Briefcase,
	ExternalLink,
	LayoutGrid,
	List,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { JobPosting } from "../types";
import { SortBy } from "../hooks/useJobFilters";
import { JobCard } from "./JobCard";
import { JobCompactRow } from "./JobCompactRow";
import { BatchSummaryBanner } from "./BatchSummaryBanner";
import { useAppContext } from "../context/AppContext";

export const Workspace: React.FC = () => {
	const {
		jobs,
		batchReport,
		filteredJobs,
		viewMode,
		setViewMode,
		activeFilter,
		setActiveFilter,
		searchQuery,
		setSearchQuery,
		sortBy,
		setSortBy,
		blockedTabJobs,
		showPopupHelp,
		handleOpenAllAsTabs: onOpenAllAsTabs,
		handleRetryRemainingTabs: onRetryRemainingTabs,
		setBlockedTabJobs,
		onOpenLinkedInSync,
		onOpenPruneConfirm,
		handleToggleDeletion: onToggleDeletion,
		handleToggleApplied: onToggleApplied,
		handleDeleteSingle: onDeleteSingle,
		onOpenAnswerGenerator,
		expandedJobId,
		onToggleExpanded,
	} = useAppContext();
	const validTabsCount = filteredJobs.filter(
		(job) => job.url && job.url.startsWith("http"),
	).length;
	return (
		<main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
			<BatchSummaryBanner
				jobs={jobs}
				report={batchReport}
				onOpenPruneConfirm={onOpenPruneConfirm}
				activeFilter={activeFilter}
				setActiveFilter={setActiveFilter}
			/>
			<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
				<div className="relative flex-1 max-w-md">
					<input
						type="text"
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
						placeholder="Search by title, company, skills, or dealbreakers..."
						className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
					/>
					{searchQuery && (
						<button
							onClick={() => setSearchQuery("")}
							className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white">
							Clear
						</button>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-xl text-xs">
						<button
							type="button"
							onClick={() => setViewMode("compact")}
							className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${viewMode === "compact" ? "bg-slate-800 text-white shadow-sm font-semibold" : "text-slate-400 hover:text-slate-200"}`}
							title="Compact Single-Line List View">
							<List className="w-3.5 h-3.5" />
							<span>Compact (1-Line)</span>
						</button>
						<button
							type="button"
							onClick={() => setViewMode("detailed")}
							className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${viewMode === "detailed" ? "bg-slate-800 text-white shadow-sm font-semibold" : "text-slate-400 hover:text-slate-200"}`}
							title="Detailed Cards View">
							<LayoutGrid className="w-3.5 h-3.5" />
							<span>Detailed Cards</span>
						</button>
					</div>
					<div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
						<ArrowUpDown className="w-3.5 h-3.5" />
						<span>Sort:</span>
						<select
							value={sortBy}
							onChange={(event) => setSortBy(event.target.value as SortBy)}
							className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer">
							<option value="score">Highest Match Score</option>
							<option value="recent">Most Recently Added</option>
							<option value="company">Company Name (A-Z)</option>
						</select>
					</div>
					{validTabsCount > 0 && (
						<button
							onClick={onOpenAllAsTabs}
							className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-950/50 hover:bg-blue-900/70 text-blue-300 border border-blue-700/50 hover:border-blue-500 transition-colors shadow-xs cursor-pointer"
							title={`Open all ${validTabsCount} filtered job links in new browser tabs`}>
							<ExternalLink className="w-3.5 h-3.5 text-blue-400" />
							<span>Open {validTabsCount} in Tabs</span>
						</button>
					)}
				</div>
			</div>
			{blockedTabJobs.length > 0 && (
				<BlockedTabs
					jobs={blockedTabJobs}
					showPopupHelp={showPopupHelp}
					onRetry={onRetryRemainingTabs}
					onDismiss={() => setBlockedTabJobs([])}
				/>
			)}
			{jobs.length === 0 ? (
				<EmptyWorkspace onOpenLinkedInSync={onOpenLinkedInSync} />
			) : filteredJobs.length === 0 ? (
				<div className="text-center py-16 px-4 rounded-2xl border border-slate-800 bg-slate-900/20 text-slate-400 text-xs">
					No opportunities match the current filter or search criteria.
					<button
						onClick={() => {
							setActiveFilter("all");
							setSearchQuery("");
						}}
						className="block mx-auto mt-2 text-blue-400 hover:underline font-medium cursor-pointer">
						Reset Filters
					</button>
				</div>
			) : viewMode === "compact" ? (
				<div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
					<div className="overflow-x-auto">
						<table className="w-full table-fixed text-left text-xs border-collapse">
							<thead>
								<tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
									<th className="py-2.5 px-3 w-10 text-center">
										<span className="sr-only">Prune</span>
										<Trash2 className="w-3.5 h-3.5 mx-auto text-slate-500" />
									</th>
									<th className="py-2.5 px-3 w-16 text-center">Match</th>
									<th className="py-2.5 px-3">Opportunity & Company</th>
									<th className="py-2.5 px-3 w-36 hidden md:table-cell">
										Location
									</th>
									<th className="py-2.5 px-3 w-20 hidden lg:table-cell">
										Salary
									</th>
									<th className="py-2.5 px-3 w-24 text-center hidden sm:table-cell">
										Verdict
									</th>
									<th className="py-2.5 px-3 w-40 text-right">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-800/80">
								{filteredJobs.map((job) => (
									<JobCompactRow
										key={job.id}
										job={job}
										onToggleDeletion={onToggleDeletion}
										onToggleApplied={onToggleApplied}
										onDeleteSingle={onDeleteSingle}
										onOpenAnswerGenerator={onOpenAnswerGenerator}
										isExpanded={expandedJobId === job.id}
										onToggleExpanded={() => onToggleExpanded(job.id)}
									/>
								))}
							</tbody>
						</table>
					</div>
				</div>
			) : (
				<div className="space-y-3.5">
					{filteredJobs.map((job) => (
						<JobCard
							key={job.id}
							job={job}
							onToggleDeletion={onToggleDeletion}
							onToggleApplied={onToggleApplied}
							onDeleteSingle={onDeleteSingle}
							onOpenAnswerGenerator={onOpenAnswerGenerator}
							isExpanded={expandedJobId === job.id}
							onToggleExpanded={() => onToggleExpanded(job.id)}
						/>
					))}
				</div>
			)}
		</main>
	);
};

const BlockedTabs: React.FC<{
	jobs: JobPosting[];
	showPopupHelp: boolean;
	onRetry: () => void;
	onDismiss: () => void;
}> = ({ jobs, showPopupHelp, onRetry, onDismiss }) => (
	<div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/20 px-3 py-2.5 text-xs text-amber-200">
		<div className="w-full">
			<span className="font-semibold">Multiple tabs were blocked.</span>
			{showPopupHelp && (
				<span>
					{" "}
					Allow pop-ups for this site using your browser's address-bar pop-up
					icon, then retry.
				</span>
			)}
		</div>
		<button
			type="button"
			onClick={onRetry}
			className="rounded-md border border-amber-500/40 px-2 py-1 font-semibold text-amber-300 hover:bg-amber-500/10">
			Retry remaining tabs
		</button>
		{jobs.map((job) => (
			<a
				key={job.id}
				href={job.url}
				target="_blank"
				rel="noopener noreferrer"
				className="rounded-md border border-amber-500/40 px-2 py-1 font-semibold text-amber-300 hover:bg-amber-500/10">
				Open {job.company}
			</a>
		))}
		<button
			type="button"
			onClick={onDismiss}
			className="ml-auto text-amber-300/70 hover:text-amber-200">
			Dismiss
		</button>
	</div>
);

const EmptyWorkspace: React.FC<{ onOpenLinkedInSync: () => void }> = ({
	onOpenLinkedInSync,
}) => (
	<div className="text-center py-20 px-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
		<div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4">
			<Briefcase className="w-7 h-7" />
		</div>
		<h3 className="text-base font-bold text-slate-100 mb-1">
			No Jobs Ingested Yet
		</h3>
		<p className="text-xs text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
			Sync your LinkedIn saved jobs tracker or paste links to let Gemini qualify
			them in bulk against your candidate context doc.
		</p>
		<button
			onClick={onOpenLinkedInSync}
			className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition-all cursor-pointer">
			<RefreshCw className="w-4 h-4" />
			<span>Sync with LinkedIn Saved Jobs</span>
		</button>
	</div>
);
