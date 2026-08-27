import React from "react";
import {
	Briefcase,
	Sliders,
	PlusCircle,
	Sparkles,
	ListFilter,
	CheckCircle2,
	Trash2,
	BookmarkCheck,
	DownloadCloud,
	MessageSquareQuote,
	FileText,
	RefreshCw,
	LogIn,
} from "lucide-react";
import { useAppContext } from "../../context/AppContext";

export const Navbar: React.FC = () => {
	const {
		jobs,
		activeFilter,
		setActiveFilter,
		onOpenCriteria,
		onOpenImport,
		handleRunBatchQualify: onRunBatchQualify,
		isQualifying,
		onOpenExport,
		onOpenAnswerGeneratorMenu: onOpenAnswerGenerator,
		onOpenContextDoc,
		onOpenLinkedInSync,
	} = useAppContext();
	const qualifiedCount = jobs.filter((j) => j.analysis).length;
	const keepCount = jobs.filter(
		(j) =>
			j.analysis?.verdict === "STRONG_KEEP" ||
			j.analysis?.verdict === "CONSIDER",
	).length;
	const discardCount = jobs.filter(
		(j) => j.analysis?.verdict === "REMOVE" || j.isSelectedForDeletion,
	).length;
	const appliedCount = jobs.filter((j) => j.status === "applied").length;

	return (
		<header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
				<div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
					{/* Brand & Identity */}
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
							<Briefcase className="w-5 h-5" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-lg font-bold text-slate-100 tracking-tight">
									LinkedIn Screener & Pruner
								</h1>
								<span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
									Bulk Engine
								</span>
							</div>
							<p className="text-xs text-slate-400">
								Bulk qualify opportunities against James Barnes context doc &
								candidate rubric
							</p>
						</div>
					</div>

					{/* Top Actions: Candidate Profile & Context Tools */}
					<div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
						<a
							href="/admin"
							className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition-colors"
							title="Open administrator sign-in">
							<LogIn className="w-3.5 h-3.5" />
							<span>Admin Sign In</span>
						</a>

						{/* Candidate Profile & Screening Rubric Unified Hub */}
						<div className="inline-flex items-center p-0.5 rounded-lg bg-slate-800/80 border border-slate-700/80 shadow-xs">
							<button
								id="nav-context-doc-btn"
								onClick={onOpenContextDoc}
								className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
								title="View & Edit Narrative Context Doc">
								<FileText className="w-3.5 h-3.5 text-blue-400" />
								<span>Context Doc</span>
							</button>
							<div className="w-[1px] h-3.5 bg-slate-700 my-auto" />
							<button
								id="nav-criteria-btn"
								onClick={onOpenCriteria}
								className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
								title="View & Edit Screening Rubric">
								<Sliders className="w-3.5 h-3.5 text-indigo-400" />
								<span>Rubric</span>
							</button>
						</div>

						{/* LinkedIn 2-Way Sync */}
						<button
							id="nav-linkedin-sync-btn"
							onClick={onOpenLinkedInSync}
							className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
							title="2-Way Sync: Pull saved jobs from LinkedIn & push unsaves for pruned jobs">
							<RefreshCw className="w-3.5 h-3.5 text-blue-400" />
							<span>LinkedIn Sync</span>
						</button>

						{/* Answer Generator Button */}
						<button
							id="nav-answer-gen-btn"
							onClick={onOpenAnswerGenerator}
							className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-200 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/50 transition-colors cursor-pointer"
							title="Generate tailored answers for job application questions">
							<MessageSquareQuote className="w-3.5 h-3.5 text-indigo-400" />
							<span>Answer Gen</span>
						</button>

						{/* If zero jobs, show Import here */}
						{jobs.length === 0 && (
							<>
								<button
									id="nav-import-btn"
									onClick={onOpenImport}
									className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer">
									<PlusCircle className="w-3.5 h-3.5 text-blue-400" />
									<span>Import Jobs</span>
								</button>
							</>
						)}
					</div>
				</div>

				{/* Second Row: Filter Tabs on Left + Pipeline Action Suite (Import, Export, Qualify All) on Right */}
				{jobs.length > 0 && (
					<div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
						{/* Filter Navigation Tabs */}
						<div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
							<button
								onClick={() => setActiveFilter("all")}
								className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
									activeFilter === "all"
										? "bg-slate-700 text-white shadow-sm"
										: "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
								}`}>
								<ListFilter className="w-3.5 h-3.5" />
								<span>All ({jobs.length})</span>
							</button>

							<button
								onClick={() => setActiveFilter("keep")}
								className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
									activeFilter === "keep"
										? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
										: "text-slate-400 hover:text-emerald-300 hover:bg-slate-800"
								}`}>
								<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
								<span>Keep ({keepCount})</span>
							</button>

							<button
								onClick={() => setActiveFilter("discard")}
								className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
									activeFilter === "discard"
										? "bg-rose-600/30 text-rose-300 border border-rose-500/40"
										: "text-slate-400 hover:text-rose-300 hover:bg-slate-800"
								}`}>
								<Trash2 className="w-3.5 h-3.5 text-rose-400" />
								<span>Prune ({discardCount})</span>
							</button>

							<button
								onClick={() => setActiveFilter("applied")}
								className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
									activeFilter === "applied"
										? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
										: "text-slate-400 hover:text-blue-300 hover:bg-slate-800"
								}`}>
								<BookmarkCheck className="w-3.5 h-3.5 text-blue-400" />
								<span>Applied ({appliedCount})</span>
							</button>
						</div>

						{/* Pipeline Actions: Import, Export, & Qualify All */}
						<div className="flex items-center gap-2 justify-end">
							{/* Import Jobs */}
							<button
								id="nav-import-btn"
								onClick={onOpenImport}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
								title="Add LinkedIn Job Tracker Links or Text">
								<PlusCircle className="w-3.5 h-3.5 text-blue-400" />
								<span>Import</span>
							</button>

							{/* Export Shortlist */}
							{keepCount > 0 && (
								<button
									id="nav-export-btn"
									onClick={onOpenExport}
									className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
									title="Export Shortlist to CSV or Markdown">
									<DownloadCloud className="w-3.5 h-3.5 text-emerald-400" />
									<span>Export</span>
								</button>
							)}

							{/* Bulk Qualify Button - Standout Action */}
							<button
								id="nav-bulk-qualify-btn"
								onClick={onRunBatchQualify}
								disabled={isQualifying}
								className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer ${
									isQualifying
										? "bg-slate-700 text-slate-400 cursor-not-allowed"
										: "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-95"
								}`}>
								<Sparkles
									className={`w-3.5 h-3.5 ${isQualifying ? "animate-spin" : ""}`}
								/>
								<span>
									{isQualifying
										? "Evaluating..."
										: qualifiedCount === jobs.length
											? "Re-Qualify All"
											: `Qualify All (${jobs.length})`}
								</span>
							</button>
						</div>
					</div>
				)}
			</div>
		</header>
	);
};
