import React from "react";
import {
	ExternalLink,
	ChevronDown,
	ChevronUp,
	Trash2,
	MessageSquareQuote,
	MapPin,
	Check,
	X,
	BookmarkCheck,
	ShieldAlert,
	Sparkles,
} from "lucide-react";
import { JobPosting } from "../../types";

// Reduce a free-form salary string (e.g. "$120,000 - $150,000") to just its floor (e.g. "$120K+").
const formatMinSalary = (raw: string): string => {
	const digits = raw.replace(/,/g, "").match(/\d{4,7}/g);
	if (!digits || digits.length === 0) return raw;
	const min = Math.min(...digits.map(Number));
	const formatted = min >= 1000 ? `$${Math.round(min / 1000)}K` : `$${min}`;
	return digits.length > 1 ? `${formatted}+` : formatted;
};

interface JobCompactRowProps {
	job: JobPosting;
	onToggleDeletion: (jobId: string) => void;
	onToggleApplied: (jobId: string) => void;
	onDeleteSingle: (jobId: string) => void;
	onOpenAnswerGenerator: (job: JobPosting) => void;
	isExpanded: boolean;
	onToggleExpanded: () => void;
}

export const JobCompactRow: React.FC<JobCompactRowProps> = ({
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

	const getScoreColor = (score: number) => {
		if (analysis?.verdict === "STRONG_KEEP")
			return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
		if (analysis?.verdict === "CONSIDER")
			return "text-amber-400 border-amber-500/40 bg-amber-500/10";
		return "text-rose-400 border-rose-500/40 bg-rose-500/10";
	};

	const getVerdictBadge = () => {
		if (!analysis) {
			return (
				<span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
					Unscreened
				</span>
			);
		}
		if (isKeep) {
			return (
				<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
					<Check className="w-3 h-3 text-emerald-400" /> Keep
				</span>
			);
		}
		if (isConsider) {
			return (
				<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
					Consider
				</span>
			);
		}
		return (
			<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 inline-flex items-center gap-1">
				<X className="w-3 h-3 text-rose-400" /> Prune
			</span>
		);
	};

	return (
		<>
			{/* Primary Table Row */}
			<tr
				className={`transition-colors duration-150 text-slate-100 ${
					isDiscard
						? "bg-rose-950/15 hover:bg-rose-950/25"
						: isKeep
							? "bg-emerald-950/10 hover:bg-emerald-950/20"
							: isConsider
								? "bg-amber-950/10 hover:bg-amber-950/20"
								: "bg-slate-900/40 hover:bg-slate-800/40"
				} ${isExpanded ? "border-b-0" : ""}`}>
				{/* 1. Prune Checkbox */}
				<td className="py-2.5 px-3 text-center align-middle">
					<input
						type="checkbox"
						checked={job.isSelectedForDeletion || isDiscard}
						onChange={() => onToggleDeletion(job.id)}
						title="Mark for pruning / deletion"
						className="rounded bg-slate-950 border-slate-700 text-rose-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
					/>
				</td>

				{/* 2. Match Score */}
				<td className="py-2.5 px-3 text-center align-middle">
					{analysis ? (
						<span
							className={`inline-block px-2 py-0.5 rounded-md font-mono font-bold text-[11px] border ${getScoreColor(
								analysis.score,
							)}`}>
							{analysis.score}%
						</span>
					) : (
						<span className="inline-block px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-500 border border-slate-700">
							--
						</span>
					)}
				</td>

				{/* 3. Company & Role Title */}
				<td className="py-2.5 px-3 align-middle min-w-0 overflow-hidden">
					<div className="flex flex-nowrap items-center gap-2 min-w-0 overflow-hidden whitespace-nowrap">
						<span
							className="font-bold text-slate-100 truncate min-w-0"
							title={job.company}>
							{job.company}
						</span>
						<span className="text-slate-600 hidden sm:inline">/</span>
						<span
							className="font-medium text-slate-300 truncate min-w-0"
							title={job.title}>
							{job.title}
						</span>

						{/* Applied Badge */}
						{isApplied && (
							<span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 inline-flex items-center gap-0.5">
								<BookmarkCheck className="w-2.5 h-2.5" /> Applied
							</span>
						)}

						{/* Dealbreaker Alert */}
						{analysis?.dealbreakerTriggers &&
							analysis.dealbreakerTriggers.length > 0 && (
								<span
									className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/80 text-rose-300 border border-rose-800/80 hidden xl:inline-flex items-center gap-1"
									title={analysis.dealbreakerTriggers.join("; ")}>
									<ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
									<span className="truncate max-w-[140px]">
										{analysis.dealbreakerTriggers[0]}
									</span>
								</span>
							)}
					</div>
				</td>

				{/* 4. Location */}
				<td className="py-2.5 px-3 align-middle text-slate-300 hidden md:table-cell">
					<div
						className={`flex items-center gap-1 text-[11px] truncate max-w-[140px] ${
							analysis?.isOutsideHomeCountry &&
							analysis.requiresOutsideHomeCountryReview
								? "text-amber-300"
								: "text-slate-400"
						}`}
						title={
							analysis?.isOutsideHomeCountry &&
							analysis.requiresOutsideHomeCountryReview
								? "Outside home country"
								: job.location
						}>
						<MapPin
							className={`w-3 h-3 shrink-0 ${
								analysis?.isOutsideHomeCountry &&
								analysis.requiresOutsideHomeCountryReview
									? "text-amber-400"
									: "text-slate-500"
							}`}
						/>
						<span className="truncate" title={job.location}>
							{job.location}
						</span>
					</div>
				</td>

				{/* 5. Salary */}
				<td className="py-2.5 px-3 align-middle text-slate-300 hidden lg:table-cell">
					{job.salaryRaw ? (
						<span
							className="inline-block px-2 py-0.5 rounded bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 font-medium text-[11px] whitespace-nowrap"
							title={job.salaryRaw}>
							{formatMinSalary(job.salaryRaw)}
						</span>
					) : (
						<span className="text-slate-600 text-[11px]">Unlisted</span>
					)}
				</td>

				{/* 6. Verdict */}
				<td className="py-2.5 px-3 align-middle text-center hidden sm:table-cell">
					{getVerdictBadge()}
				</td>

				{/* 7. Action Icons */}
				<td className="py-2.5 px-3 align-middle text-right">
					<div className="flex items-center justify-end gap-1.5">
						{/* Generate Answer */}
						<button
							onClick={() => onOpenAnswerGenerator(job)}
							className="w-7 h-7 flex items-center justify-center rounded-lg text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/50 transition-colors cursor-pointer"
							title="Generate tailored application answer">
							<MessageSquareQuote className="w-3.5 h-3.5 text-indigo-400" />
						</button>

						{/* External Link */}
						{job.url && job.url.startsWith("http") ? (
							<a
								href={job.url}
								target="_blank"
								rel="noreferrer"
								className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white transition-colors cursor-pointer"
								title="Open external job link">
								<ExternalLink className="w-3.5 h-3.5" />
							</a>
						) : (
							<span
								className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-900/60 text-slate-700 border border-slate-800 cursor-not-allowed"
								title="No external link">
								<ExternalLink className="w-3.5 h-3.5 text-slate-700" />
							</span>
						)}

						{/* Mark Applied */}
						<button
							onClick={() => onToggleApplied(job.id)}
							className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
								isApplied
									? "bg-blue-900/40 border-blue-600 text-blue-300"
									: "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200"
							}`}
							title={isApplied ? "Marked as Applied" : "Mark as Applied"}>
							<BookmarkCheck className="w-3.5 h-3.5" />
						</button>

						{/* Expand Details */}
						<button
							onClick={onToggleExpanded}
							className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
								isExpanded
									? "bg-slate-800 text-slate-200 border-slate-600"
									: "bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200 hover:border-slate-700"
							}`}
							title={isExpanded ? "Collapse Details" : "Expand Details"}>
							{isExpanded ? (
								<ChevronUp className="w-3.5 h-3.5" />
							) : (
								<ChevronDown className="w-3.5 h-3.5" />
							)}
						</button>

						{/* Delete Single */}
						<button
							onClick={() => onDeleteSingle(job.id)}
							className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-900/80 border border-slate-800 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 hover:border-rose-900/50 transition-colors cursor-pointer"
							title="Remove job from tracker">
							<Trash2 className="w-3.5 h-3.5" />
						</button>
					</div>
				</td>
			</tr>

			{/* Expanded Accordion Row */}
			{isExpanded && (
				<tr className="bg-slate-950/90 border-b border-slate-800">
					<td
						colSpan={7}
						className="p-4 text-xs animate-in fade-in duration-150">
						<div className="space-y-3">
							{analysis ? (
								<>
									{/* Summary & Fit Signals */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										<div className="flex flex-col items-stretch gap-2 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
											<p className="text-slate-300 leading-relaxed">
												<strong className="text-slate-100 font-semibold">
													AI Assessment:{" "}
												</strong>
												{analysis.oneSentenceSummary}
											</p>
											<div className="flex flex-wrap items-center gap-2 text-[11px] pt-1 border-t border-slate-800/80">
												{analysis.salaryFit && (
													<span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
														💰 {analysis.salaryFit}
													</span>
												)}
												{analysis.locationFit && (
													<span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
														📍 {analysis.locationFit}
													</span>
												)}
											</div>
										</div>

										<div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
											<div className="flex items-center justify-between">
												<span className="text-xs font-semibold text-slate-200">
													Score Modifiers
												</span>
												<span className="text-[11px] text-slate-500">
													{analysis.score}% final score
												</span>
											</div>
											<div className="space-y-1.5">
												{analysis.scoreBreakdown?.length ? (
													analysis.scoreBreakdown.map((item, index) => (
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
													))
												) : (
													<span className="text-[11px] text-slate-500 italic">
														Requalify this job to generate modifier details.
													</span>
												)}
											</div>
										</div>
									</div>

									{/* Skills Grid */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										{/* Matched Skills */}
										<div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/30 space-y-1.5">
											<div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
												<Check className="w-3.5 h-3.5 text-emerald-400" />
												<span>
													Matched Skills & Tech (
													{analysis.matchedSkills?.length || 0})
												</span>
											</div>
											<div className="flex flex-wrap items-center gap-1.5">
												{analysis.matchedSkills &&
												analysis.matchedSkills.length > 0 ? (
													analysis.matchedSkills.map((s) => (
														<span
															key={s}
															className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px]">
															{s}
														</span>
													))
												) : (
													<span className="text-slate-500 italic text-[11px]">
														No direct matches
													</span>
												)}
											</div>
										</div>

										{/* Skills Not Mentioned */}
										<div className="p-3 rounded-lg bg-amber-950/20 border border-amber-900/30 space-y-1.5">
											<div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
												<X className="w-3.5 h-3.5 text-amber-400" />
												<span>
													Skills Not Mentioned (
													{analysis.missingSkills?.length || 0})
												</span>
											</div>
											<div className="flex flex-wrap items-center gap-1.5">
												{analysis.missingSkills &&
												analysis.missingSkills.length > 0 ? (
													analysis.missingSkills.map((s) => (
														<span
															key={s}
															className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px]">
															{s}
														</span>
													))
												) : (
													<span className="text-emerald-400 text-[11px]">
														All required skills are mentioned
													</span>
												)}
											</div>
										</div>
									</div>

									{/* Application Pitch */}
									{analysis.tailoredPitch && (
										<div className="p-3 rounded-lg bg-indigo-950/25 border border-indigo-900/30 text-indigo-200">
											<span className="font-semibold text-indigo-300">
												Strategy Pitch:{" "}
											</span>
											{analysis.tailoredPitch}
										</div>
									)}
								</>
							) : (
								<div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
									<strong className="text-slate-200 font-semibold">
										Not yet qualified:{" "}
									</strong>
									Click &quot;Qualify All&quot; in the header to evaluate skills
									and match scores.
								</div>
							)}
						</div>
					</td>
				</tr>
			)}
		</>
	);
};
