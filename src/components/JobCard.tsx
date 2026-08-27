import React from "react";
import {
	ExternalLink,
	CheckCircle2,
	AlertTriangle,
	ChevronDown,
	ChevronUp,
	Trash2,
	MessageSquareQuote,
	DollarSign,
	MapPin,
	Building,
	Check,
	X,
	BookmarkCheck,
	ShieldAlert,
} from "lucide-react";
import { JobPosting } from "../types";

interface JobCardProps {
	job: JobPosting;
	onToggleDeletion: (jobId: string) => void;
	onToggleApplied: (jobId: string) => void;
	onDeleteSingle: (jobId: string) => void;
	onOpenAnswerGenerator: (job: JobPosting) => void;
	isExpanded: boolean;
	onToggleExpanded: () => void;
}

export const JobCard: React.FC<JobCardProps> = ({
	job,
	onToggleDeletion,
	onToggleApplied,
	onDeleteSingle,
	onOpenAnswerGenerator,
	isExpanded,
	onToggleExpanded,
}) => {
	const analysis = job.analysis;
	const isDiscard = analysis?.verdict === "REMOVE" || job.isSelectedForDeletion;
	const isKeep = analysis?.verdict === "STRONG_KEEP";
	const isConsider = analysis?.verdict === "CONSIDER";
	const isApplied = job.status === "applied";

	// Match score color
	const getScoreColor = (score: number) => {
		if (analysis?.verdict === "STRONG_KEEP")
			return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
		if (analysis?.verdict === "CONSIDER")
			return "text-amber-400 border-amber-500/40 bg-amber-500/10";
		return "text-rose-400 border-rose-500/40 bg-rose-500/10";
	};

	return (
		<div
			className={`rounded-2xl border transition-all duration-200 shadow-md ${
				isDiscard
					? "bg-slate-900/60 border-rose-900/40 hover:border-rose-700/60"
					: isKeep
						? "bg-slate-900/90 border-emerald-900/40 hover:border-emerald-700/60"
						: isConsider
							? "bg-slate-900/90 border-amber-900/40 hover:border-amber-700/60"
							: "bg-slate-900 border-slate-800 hover:border-slate-700"
			} text-slate-100 overflow-hidden`}>
			{/* Top Card Section */}
			<div className="p-5">
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
					{/* Company & Title Header */}
					<div className="flex items-start gap-3.5 flex-1 min-w-0">
						{/* Match Score Indicator (Clean number) */}
						{analysis ? (
							<div
								className={`w-11 h-11 rounded-xl border flex items-center justify-center font-black text-base font-mono shrink-0 shadow-inner ${getScoreColor(
									analysis.score,
								)}`}
								title={`Match Score: ${analysis.score}%`}>
								{analysis.score}
							</div>
						) : (
							<div
								className="w-11 h-11 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center font-bold text-slate-500 shrink-0 text-sm shadow-inner"
								title="Awaiting qualification">
								—
							</div>
						)}

						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2 mb-1">
								<h3 className="text-base font-bold text-slate-100 truncate">
									{job.title}
								</h3>
								{isApplied && (
									<span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
										<BookmarkCheck className="w-3 h-3" /> Applied
									</span>
								)}
							</div>

							<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
								<span className="font-medium text-slate-300 flex items-center gap-1">
									<Building className="w-3.5 h-3.5 text-slate-500" />
									{job.company}
								</span>
								<span className="flex items-center gap-1">
									<MapPin className="w-3.5 h-3.5 text-slate-500" />
									{job.location} ({job.workplaceType})
								</span>
								{job.salaryRaw && (
									<span className="flex items-center gap-1 text-emerald-400 font-medium">
										<DollarSign className="w-3.5 h-3.5 text-emerald-400" />
										{job.salaryRaw}
									</span>
								)}
							</div>
						</div>
					</div>

					{/* Verdict Badge */}
					<div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
						{analysis ? (
							<div
								className={`h-7 px-3 rounded-lg text-xs font-bold uppercase tracking-wider border flex items-center justify-center shadow-xs ${
									analysis.verdict === "STRONG_KEEP"
										? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
										: analysis.verdict === "CONSIDER"
											? "bg-amber-500/20 text-amber-300 border-amber-500/30"
											: "bg-rose-500/20 text-rose-300 border-rose-500/30"
								}`}>
								{analysis.verdict === "STRONG_KEEP"
									? "Strong Keep"
									: analysis.verdict === "CONSIDER"
										? "Consider"
										: "Recommend Removal"}
							</div>
						) : (
							<span className="h-7 px-3 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 flex items-center justify-center">
								Unscreened
							</span>
						)}
					</div>
				</div>

				{/* Dealbreaker Alert Banner */}
				{analysis?.dealbreakerTriggers &&
					analysis.dealbreakerTriggers.length > 0 && (
						<div className="mt-3.5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-200">
							<ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
							<div className="flex-1">
								<span className="font-bold text-rose-300">
									Dealbreaker Triggered:{" "}
								</span>
								{analysis.dealbreakerTriggers.join("; ")}
							</div>
						</div>
					)}

				{/* AI Assessment & Qualification Card */}
				{analysis && (
					<div className="mt-3.5 rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-xs">
						{/* 1-Sentence Summary / Assessment Header */}
						<div
							className={
								isExpanded ? "grid grid-cols-1 md:grid-cols-2 gap-3 p-3" : ""
							}>
							{analysis.oneSentenceSummary && (
								<div className="px-4 py-2.5 bg-slate-900/60 border border-slate-800/80 rounded-lg flex items-start gap-2 text-xs">
									<span className="font-semibold text-slate-200 shrink-0">
										Summary:
									</span>
									<span className="text-slate-300 leading-relaxed">
										{analysis.oneSentenceSummary}
									</span>
								</div>
							)}

							{isExpanded && (
								<div className="px-4 py-3 border border-slate-800/80 rounded-lg bg-slate-950/60 space-y-2">
									<div className="flex items-center justify-between">
										<span className="text-xs font-semibold text-slate-200">
											Score Modifiers
										</span>
										<span className="text-[11px] text-slate-500">
											{analysis.score}% final score
										</span>
									</div>
									{analysis.scoreBreakdown?.length ? (
										<div className="space-y-1.5">
											{analysis.scoreBreakdown.map((item, index) => (
												<div
													key={`${item.label}-${index}`}
													className="flex items-center justify-between gap-3 text-[11px]">
													<span className="text-slate-400 truncate">
														{item.label}
													</span>
													<span
														className={`font-mono font-semibold shrink-0 ${item.points >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
														{item.points >= 0 ? "+" : ""}
														{item.points}
													</span>
												</div>
											))}
										</div>
									) : (
										<span className="text-[11px] text-slate-500 italic">
											Requalify this job to generate modifier details.
										</span>
									)}
								</div>
							)}
						</div>

						{/* 1. Skills & Tech Stack Section */}
						<div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800/80 bg-slate-950/40">
							{/* Left: Matched Skills */}
							<div className="p-3.5 space-y-2 flex flex-col justify-start">
								<div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
									<Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
									<span>Matched Skills & Tech</span>
								</div>

								<div className="flex flex-wrap items-center gap-1.5">
									{analysis.matchedSkills &&
									analysis.matchedSkills.length > 0 ? (
										analysis.matchedSkills.map((s) => (
											<span
												key={s}
												className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium">
												{s}
											</span>
										))
									) : (
										<span className="text-xs text-slate-500 italic">
											No direct skill matches detected
										</span>
									)}
								</div>
							</div>

							{/* Right: Missing Requirements */}
							<div className="p-3.5 space-y-2 flex flex-col justify-start">
								<div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
									<X className="w-3.5 h-3.5 text-rose-400 shrink-0" />
									<span>Missing Requirements & Gaps</span>
								</div>

								<div className="flex flex-wrap items-center gap-1.5">
									{analysis.missingSkills &&
									analysis.missingSkills.length > 0 ? (
										analysis.missingSkills.map((s) => (
											<span
												key={s}
												className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-medium">
												{s}
											</span>
										))
									) : (
										<span className="text-xs text-emerald-400/90 flex items-center gap-1">
											No critical stack gaps
										</span>
									)}
								</div>
							</div>
						</div>

						{/* 2. Fit Signals Bar */}
						{(analysis.salaryFit || analysis.locationFit) && (
							<div className="px-4 py-2 bg-slate-900/40 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-slate-400 font-medium text-[11px]">
										Signals:
									</span>
									{analysis.salaryFit && (
										<span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 flex items-center gap-1 text-[11px]">
											<DollarSign className="w-3 h-3 text-emerald-400" />
											<span>{analysis.salaryFit}</span>
										</span>
									)}
									{analysis.locationFit && (
										<span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 flex items-center gap-1 text-[11px]">
											<MapPin className="w-3 h-3 text-blue-400" />
											<span>{analysis.locationFit}</span>
										</span>
									)}
								</div>
								<span className="text-slate-500 text-[11px]">
									Evaluated by AI Rubric
								</span>
							</div>
						)}

						{/* 3. Distinct Expanded Section: Detailed Qualitative Evaluation */}
						{isExpanded && (
							<div className="border-t border-slate-800/90 bg-slate-900/50 p-4 space-y-4 text-xs animate-in fade-in duration-150">
								{/* 2-Column Qualitative Grid (Full Width, Equal Heights, No Gaps) */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
									{/* Left Box: Key Strengths & Alignment */}
									<div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-900/40 flex flex-col justify-between space-y-2">
										<div className="space-y-2">
											<div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
												<CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
												<span>Strengths & Alignment</span>
											</div>
											{analysis.keyPros && analysis.keyPros.length > 0 ? (
												<ul className="space-y-1.5 text-slate-300 text-xs pl-3.5 list-disc marker:text-emerald-400 leading-relaxed">
													{analysis.keyPros.map((pro, i) => (
														<li key={i}>{pro}</li>
													))}
												</ul>
											) : (
												<p className="text-slate-500 italic text-xs">
													No detailed strengths recorded.
												</p>
											)}
										</div>
									</div>

									{/* Right Box: Gaps & Potential Risks */}
									<div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-900/40 flex flex-col justify-between space-y-2">
										<div className="space-y-2">
											<div className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
												<AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
												<span>Risks & Red Flags</span>
											</div>
											{analysis.keyCons && analysis.keyCons.length > 0 ? (
												<ul className="space-y-1.5 text-slate-300 text-xs pl-3.5 list-disc marker:text-rose-400 leading-relaxed">
													{analysis.keyCons.map((con, i) => (
														<li key={i}>{con}</li>
													))}
												</ul>
											) : (
												<p className="text-emerald-400/90 text-xs">
													No major risks or red flags identified.
												</p>
											)}
										</div>
									</div>
								</div>

								{/* Application Strategy */}
								{analysis.tailoredPitch && (
									<div className="p-3.5 rounded-lg bg-indigo-950/25 border border-indigo-900/40 space-y-1.5">
										<div className="font-semibold text-indigo-300 flex items-center gap-1.5 text-xs">
											<MessageSquareQuote className="w-4 h-4 text-indigo-400 shrink-0" />
											<span>Application Strategy & Pitch</span>
										</div>
										<p className="text-slate-300 leading-relaxed text-xs">
											{analysis.tailoredPitch}
										</p>
									</div>
								)}
							</div>
						)}
					</div>
				)}

				{/* Unqualified State Placeholder */}
				{!analysis && isExpanded && (
					<div className="mt-3.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 text-xs">
						<span className="font-semibold text-slate-200">
							Not yet qualified:{" "}
						</span>
						Click &quot;Bulk Qualify All&quot; in the navigation bar to score
						this role, identify dealbreakers, and generate custom application
						strategies.
					</div>
				)}
			</div>

			{/* Action Footer Bar */}
			<div className="px-5 py-3 bg-slate-950/70 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
				{/* Left Actions: Apply link & Answer generator */}
				<div className="flex flex-wrap items-center gap-2">
					{job.url && job.url.startsWith("http") ? (
						<a
							href={job.url}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all">
							<span>Apply on LinkedIn / Portal</span>
							<ExternalLink className="w-3.5 h-3.5" />
						</a>
					) : (
						<span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 bg-slate-900 border border-slate-800 text-xs">
							<span>No direct link</span>
						</span>
					)}

					<button
						onClick={() => onOpenAnswerGenerator(job)}
						className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-800/50 transition-colors cursor-pointer"
						title="Generate custom first-person answers for this job application">
						<MessageSquareQuote className="w-3.5 h-3.5 text-indigo-400" />
						<span>Generate Answer</span>
					</button>

					<button
						onClick={() => onToggleApplied(job.id)}
						className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
							isApplied
								? "bg-blue-900/40 border-blue-600 text-blue-300 font-semibold"
								: "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
						}`}>
						<BookmarkCheck className="w-3.5 h-3.5" />
						<span>{isApplied ? "Marked as Applied" : "Mark as Applied"}</span>
					</button>
				</div>

				{/* Right Actions: Keep / Prune Toggle, Expand details, Delete */}
				<div className="flex items-center gap-2">
					{/* Toggle Keep vs Mark for Deletion */}
					<label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
						<input
							type="checkbox"
							checked={job.isSelectedForDeletion || isDiscard}
							onChange={() => onToggleDeletion(job.id)}
							className="rounded bg-slate-900 border-slate-700 text-rose-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
						/>
						<span
							className={`font-medium ${
								job.isSelectedForDeletion || isDiscard
									? "text-rose-400"
									: "text-slate-400"
							}`}>
							Mark for Pruning
						</span>
					</label>

					{/* Always Rendered Details Button for Consistent Icon Positioning */}
					<button
						onClick={onToggleExpanded}
						className="px-2.5 py-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer flex items-center gap-1 min-w-[72px] justify-center"
						title={
							isExpanded ? "Collapse Details" : "Expand Details & Analysis"
						}>
						<span className="text-[11px] font-medium">
							{isExpanded ? "Less" : "Details"}
						</span>
						{isExpanded ? (
							<ChevronUp className="w-3.5 h-3.5" />
						) : (
							<ChevronDown className="w-3.5 h-3.5" />
						)}
					</button>

					<button
						onClick={() => onDeleteSingle(job.id)}
						className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
						title="Delete this job from tracker">
						<Trash2 className="w-3.5 h-3.5" />
					</button>
				</div>
			</div>
		</div>
	);
};
