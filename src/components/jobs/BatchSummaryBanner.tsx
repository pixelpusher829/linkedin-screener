import React from "react";
import {
	CheckCircle2,
	Trash2,
	Sparkles,
	ArrowRight,
	TrendingUp,
	Percent,
} from "lucide-react";
import { BatchSummaryReport, JobPosting } from "../../types";

interface BatchSummaryBannerProps {
	jobs: JobPosting[];
	report: BatchSummaryReport | null;
	onOpenPruneConfirm: () => void;
	activeFilter:
		| "all"
		| "strong"
		| "consider"
		| "keep"
		| "discard"
		| "shortlist"
		| "applied";
	setActiveFilter: (
		filter:
			| "all"
			| "strong"
			| "consider"
			| "keep"
			| "discard"
			| "shortlist"
			| "applied",
	) => void;
}

export const BatchSummaryBanner: React.FC<BatchSummaryBannerProps> = ({
	jobs,
	report,
	onOpenPruneConfirm,
	activeFilter,
	setActiveFilter,
}) => {
	const analyzedJobs = jobs.filter((j) => j.analysis);
	if (analyzedJobs.length === 0) return null;

	const keepCount = jobs.filter(
		(j) => j.analysis?.verdict === "STRONG_KEEP",
	).length;
	const considerCount = jobs.filter(
		(j) => j.analysis?.verdict === "CONSIDER",
	).length;
	const removeCount = jobs.filter(
		(j) => j.analysis?.verdict === "REMOVE" || j.isSelectedForDeletion,
	).length;
	const avgScore = Math.round(
		analyzedJobs.reduce((acc, j) => acc + (j.analysis?.score || 0), 0) /
			analyzedJobs.length,
	);

	return (
		<div className="mb-5 rounded-2xl bg-slate-900 border border-slate-800 p-4.5 shadow-sm text-slate-100">
			<div className="flex flex-col lg:flex-row items-stretch lg:items-start justify-between gap-4">
				{/* Left: Scorecard Metrics */}
				<div className="space-y-3 flex-1">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1.5">
								<Sparkles className="w-3 h-3 text-indigo-400" /> Pipeline
								Scorecard
							</span>
							<span className="text-xs text-slate-400">
								{analyzedJobs.length} of {jobs.length} roles evaluated
							</span>
						</div>
					</div>

					<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
						{/* Strong Keep */}
						<button
							type="button"
							onClick={() => setActiveFilter("strong")}
							aria-pressed={activeFilter === "strong"}
							className={`p-3 rounded-xl text-left border transition-colors cursor-pointer ${activeFilter === "strong" ? "bg-emerald-500/15 border-emerald-400/60" : "bg-slate-950/60 border-emerald-500/20 hover:border-emerald-400/50"}`}>
							<div className="flex items-center justify-between text-xs text-slate-400 mb-1">
								<span>Strong Matches</span>
								<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
							</div>
							<div className="text-xl font-bold text-emerald-400 font-mono">
								{keepCount}
							</div>
							<div className="text-[11px] text-emerald-400/70">
								High conviction
							</div>
						</button>

						{/* Consider */}
						<button
							type="button"
							onClick={() => setActiveFilter("consider")}
							aria-pressed={activeFilter === "consider"}
							className={`p-3 rounded-xl text-left border transition-colors cursor-pointer ${activeFilter === "consider" ? "bg-amber-500/15 border-amber-400/60" : "bg-slate-950/60 border-amber-500/20 hover:border-amber-400/50"}`}>
							<div className="flex items-center justify-between text-xs text-slate-400 mb-1">
								<span>Consider</span>
								<TrendingUp className="w-3.5 h-3.5 text-amber-400" />
							</div>
							<div className="text-xl font-bold text-amber-400 font-mono">
								{considerCount}
							</div>
							<div className="text-[11px] text-amber-400/70">
								Minor tradeoffs
							</div>
						</button>

						{/* Remove / Prune */}
						<button
							type="button"
							onClick={() => setActiveFilter("discard")}
							aria-pressed={activeFilter === "discard"}
							className={`p-3 rounded-xl text-left border transition-colors cursor-pointer ${activeFilter === "discard" ? "bg-rose-500/15 border-rose-400/60" : "bg-slate-950/60 border-rose-500/20 hover:border-rose-400/50"}`}>
							<div className="flex items-center justify-between text-xs text-slate-400 mb-1">
								<span>Prune Candidates</span>
								<Trash2 className="w-3.5 h-3.5 text-rose-400" />
							</div>
							<div className="text-xl font-bold text-rose-400 font-mono">
								{removeCount}
							</div>
							<div className="text-[11px] text-rose-400/70">
								Gaps / dealbreakers
							</div>
						</button>

						{/* Average Match */}
						<div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
							<div className="flex items-center justify-between text-xs text-slate-400 mb-1">
								<span>Avg Match Score</span>
								<Percent className="w-3.5 h-3.5 text-blue-400" />
							</div>
							<div className="text-xl font-bold text-blue-400 font-mono">
								{avgScore}%
							</div>
							<div className="text-[11px] text-slate-400">Rubric alignment</div>
						</div>
					</div>

					{/* AI Verdict summary text */}
					{report?.overallVerdictSummary && (
						<p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
							{report.overallVerdictSummary}
						</p>
					)}
				</div>

				{/* Right: Prune Action Call-to-action */}
				{removeCount > 0 && (
					<div className="w-full lg:w-64 lg:self-stretch lg:mt-[2.125rem] shrink-0 p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/40 flex flex-col justify-between gap-2.5">
						<div>
							<div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
								<Trash2 className="w-3.5 h-3.5 text-rose-400" />
								<span>Ready to Prune Pipeline</span>
							</div>
							<p className="text-xs text-slate-300 mt-1 leading-relaxed">
								{removeCount} {removeCount === 1 ? "role fails" : "roles fail"}{" "}
								candidate specs. Purge to keep only high-conviction leads.
							</p>
						</div>

						<button
							onClick={onOpenPruneConfirm}
							className="w-full py-2 px-3 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95">
							<span>Prune {removeCount} Discards</span>
							<ArrowRight className="w-3.5 h-3.5" />
						</button>
					</div>
				)}
			</div>
		</div>
	);
};
