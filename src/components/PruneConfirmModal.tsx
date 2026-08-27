import React, { useEffect, useState } from "react";
import { X, Trash2, ShieldAlert, CheckCircle2, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import { JobPosting } from "../types";

interface PruneConfirmModalProps {
	isOpen: boolean;
	onClose: () => void;
	jobsToDelete: JobPosting[];
	onConfirmPrune: (jobIdsToKeep: string[], jobIdsToDelete: string[]) => void;
}

export const PruneConfirmModal: React.FC<PruneConfirmModalProps> = ({
	isOpen,
	onClose,
	jobsToDelete,
	onConfirmPrune,
}) => {
	// Set of IDs that the user actually confirms for deletion
	const [selectedIds, setSelectedIds] = useState<Set<string>>(
		new Set(jobsToDelete.map((j) => j.id)),
	);

	useEffect(() => {
		if (isOpen) setSelectedIds(new Set(jobsToDelete.map((j) => j.id)));
	}, [isOpen, jobsToDelete]);

	if (!isOpen) return null;

	const toggleJob = (id: string) => {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setSelectedIds(next);
	};

	const handleExecutePrune = () => {
		const deleteList = Array.from(selectedIds);
		const keepList = jobsToDelete
			.filter((j) => !selectedIds.has(j.id))
			.map((j) => j.id);

		// Launch celebratory confetti for completing the pruning cycle
		try {
			confetti({
				particleCount: 80,
				spread: 70,
				origin: { y: 0.6 },
				colors: ["#3b82f6", "#10b981", "#6366f1", "#06b6d4"],
			});
		} catch (e) {
			// ignore
		}

		onConfirmPrune(keepList, deleteList);
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
			<div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-8 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-rose-950/20">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
							<Trash2 className="w-5 h-5" />
						</div>
						<div>
							<h2 className="text-lg font-bold text-slate-100">
								Review & Approve Pipeline Pruning
							</h2>
							<p className="text-xs text-slate-400">
								Purge low-conviction opportunities to leave a laser-focused
								shortlist
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Content Body */}
				<div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
					<div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
						Below are the opportunities identified by AI as low match or
						triggering strict dealbreakers. Uncheck any opportunity you wish to
						keep in your shortlist.
					</div>

					<div className="space-y-2.5">
						{jobsToDelete.map((job) => {
							const isChecked = selectedIds.has(job.id);
							const analysis = job.analysis;
							const dealbreaker = analysis?.dealbreakerTriggers?.[0];
							const score = analysis?.score || 0;

							return (
								<div
									key={job.id}
									onClick={() => toggleJob(job.id)}
									className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
										isChecked
											? "bg-rose-950/20 border-rose-900/50 hover:border-rose-700"
											: "bg-slate-950 border-slate-800 hover:border-slate-700 opacity-60"
									}`}>
									<input
										type="checkbox"
										checked={isChecked}
										onChange={() => {}}
										className="mt-1 rounded bg-slate-900 border-slate-700 text-rose-600 focus:ring-0 w-4 h-4 cursor-pointer"
									/>

									<div className="flex-1 min-w-0 text-xs">
										<div className="flex items-center justify-between gap-2 mb-1">
											<span className="font-bold text-slate-200 truncate">
												{job.title}
											</span>
											<span className="font-mono text-rose-400 font-bold shrink-0">
												{score}% Match
											</span>
										</div>

										<div className="text-slate-400 mb-1.5">
											{job.company} • {job.location} ({job.workplaceType})
										</div>

										{dealbreaker ? (
											<div className="flex items-center gap-1.5 text-rose-300 font-medium bg-rose-950/40 px-2 py-1 rounded-md border border-rose-900/40">
												<ShieldAlert className="w-3.5 h-3.5 shrink-0" />
												<span>Dealbreaker: {dealbreaker}</span>
											</div>
										) : (
											<div className="text-slate-400 italic">
												{analysis?.oneSentenceSummary ||
													"Low alignment with requirements"}
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Footer Actions */}
				<div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors">
						Cancel
					</button>

					<button
						type="button"
						onClick={handleExecutePrune}
						disabled={selectedIds.size === 0}
						className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-40">
						<Trash2 className="w-4 h-4" />
						<span>Confirm & Prune ({selectedIds.size}) Discards</span>
					</button>
				</div>
			</div>
		</div>
	);
};
