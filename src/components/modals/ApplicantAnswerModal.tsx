import React, { useState } from "react";
import {
	X,
	MessageSquareQuote,
	Sparkles,
	Copy,
	Check,
	Loader2,
	FileText,
	Building,
	RefreshCw,
	Sliders,
	ChevronRight,
	Send,
	CornerDownLeft,
} from "lucide-react";
import { JobPosting } from "../../types";

interface ApplicantAnswerModalProps {
	isOpen: boolean;
	onClose: () => void;
	contextDoc: string;
	onOpenContextDocModal: () => void;
	jobs: JobPosting[];
	initialSelectedJob?: JobPosting | null;
}

const QUESTION_PRESETS = [
	{
		label: "Why are you leaving your job?",
		question:
			"Why are you currently looking for a new opportunity and leaving your previous position?",
	},
	{
		label: "Why this company?",
		question:
			"Why do you want to work at our company and what caught your attention about this role?",
	},
	{
		label: "Design systems experience",
		question:
			"Tell us about your experience building and scaling enterprise design systems and bridging design with engineering.",
	},
	{
		label: "Handling ambiguity",
		question:
			"How do you handle projects with unclear requirements or shifting product scopes?",
	},
	{
		label: "Greatest technical accomplishment",
		question:
			"Describe your greatest technical accomplishment or a challenging problem you solved from scratch.",
	},
	{
		label: "Salary & Location eligibility",
		question:
			"What are your salary expectations and what is your location / work authorization status?",
	},
	{
		label: "Frontend & testing approach",
		question:
			"What is your philosophy on responsive UI architecture, web performance, and testing?",
	},
];

export const ApplicantAnswerModal: React.FC<ApplicantAnswerModalProps> = ({
	isOpen,
	onClose,
	contextDoc,
	onOpenContextDocModal,
	jobs,
	initialSelectedJob = null,
}) => {
	const [question, setQuestion] = useState("");
	const [selectedJobId, setSelectedJobId] = useState<string>(
		initialSelectedJob?.id || "general",
	);
	const [tone, setTone] = useState<
		"standard" | "concise" | "storytelling" | "direct"
	>("standard");
	const [answer, setAnswer] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [copied, setCopied] = useState<boolean>(false);

	// Sync initial selected job if opened from a specific card
	React.useEffect(() => {
		if (initialSelectedJob) {
			setSelectedJobId(initialSelectedJob.id);
		}
	}, [initialSelectedJob]);

	if (!isOpen) return null;

	const selectedJob = jobs.find((j) => j.id === selectedJobId) || null;

	const handleGenerateAnswer = async (customPrompt?: string) => {
		const q = customPrompt || question;
		if (!q.trim()) return;

		setIsLoading(true);
		setAnswer("");

		try {
			const res = await fetch("/api/generate-applicant-answer", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					question: q.trim(),
					contextDoc,
					targetJob: selectedJob,
					tone,
				}),
			});

			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}));
				throw new Error(errorData.error || "Failed to generate answer");
			}

			const data = await res.json();
			setAnswer(data.answer || "No response returned.");
		} catch (err: any) {
			setAnswer(
				"Error generating answer: " +
					(err.message || "Please check connection."),
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleCopy = () => {
		navigator.clipboard.writeText(answer);
		setCopied(true);
		setTimeout(() => setCopied(false), 2500);
	};

	const handleRefine = (refinementDirective: string) => {
		const combinedQuestion = `${question.trim()}\n\n[Refinement request: ${refinementDirective}]`;
		handleGenerateAnswer(combinedQuestion);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
			<div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-8 text-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 text-indigo-400">
							<MessageSquareQuote className="w-5 h-5" />
						</div>
						<div>
							<h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
								<span>Applicant Answer Generator</span>
								<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">
									Context-Grounded
								</span>
							</h2>
							<p className="text-xs text-slate-400">
								Paste any recruiter or job application question to generate
								authentic first-person answers from your context doc
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Sub-bar: Context Doc Status & Target Job Selection */}
				<div className="px-6 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
					{/* Target Job Selector */}
					<div className="flex items-center gap-2 flex-1 min-w-[240px]">
						<Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
						<span className="text-slate-400 font-medium">Target Role:</span>
						<select
							value={selectedJobId}
							onChange={(e) => setSelectedJobId(e.target.value)}
							className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer flex-1 truncate">
							<option value="general">
								General / Any Application Question
							</option>
							{jobs.map((j) => (
								<option key={j.id} value={j.id}>
									{j.company} — {j.title}
								</option>
							))}
						</select>
					</div>

					{/* Context Doc Button */}
					<button
						onClick={onOpenContextDocModal}
						className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 transition-colors cursor-pointer">
						<FileText className="w-3 h-3 text-blue-400" />
						<span>View / Update Context Doc</span>
					</button>
				</div>

				{/* Main Body */}
				<div className="p-6 space-y-4 overflow-y-auto flex-1 bg-slate-950/40">
					{/* Quick Presets */}
					<div>
						<div className="text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
							Quick Application Questions:
						</div>
						<div className="flex flex-wrap gap-1.5">
							{QUESTION_PRESETS.map((preset, idx) => (
								<button
									key={idx}
									onClick={() => {
										setQuestion(preset.question);
									}}
									className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border ${
										question === preset.question
											? "bg-indigo-600/30 text-indigo-200 border-indigo-500/50 shadow-sm"
											: "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700"
									}`}>
									{preset.label}
								</button>
							))}
						</div>
					</div>

					{/* Question Textarea Input */}
					<div className="space-y-1.5">
						<label className="block text-xs font-semibold text-slate-200">
							Application Question or Prompt
						</label>
						<div className="relative">
							<textarea
								value={question}
								onChange={(e) => setQuestion(e.target.value)}
								placeholder="Paste the application question here (e.g. 'Why do you want to work at our company?', 'Tell us about a time you handled ambiguous requirements', 'What is your target salary?')..."
								className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors min-h-[90px] leading-relaxed resize-y"
							/>
							{question && (
								<button
									onClick={() => setQuestion("")}
									className="absolute right-3 top-3 text-[11px] text-slate-500 hover:text-slate-300">
									Clear
								</button>
							)}
						</div>
					</div>

					{/* Tone / Format Options & Generate Button */}
					<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
						<div className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 p-1 rounded-xl">
							<span className="text-slate-400 px-2 font-medium">Tone:</span>
							<button
								type="button"
								onClick={() => setTone("standard")}
								className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
									tone === "standard"
										? "bg-indigo-600 text-white"
										: "text-slate-400 hover:text-slate-200"
								}`}>
								Standard
							</button>
							<button
								type="button"
								onClick={() => setTone("concise")}
								className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
									tone === "concise"
										? "bg-indigo-600 text-white"
										: "text-slate-400 hover:text-slate-200"
								}`}>
								Concise
							</button>
							<button
								type="button"
								onClick={() => setTone("storytelling")}
								className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
									tone === "storytelling"
										? "bg-indigo-600 text-white"
										: "text-slate-400 hover:text-slate-200"
								}`}
								title="STAR Method (Situation, Task, Action, Result)">
								STAR Story
							</button>
							<button
								type="button"
								onClick={() => setTone("direct")}
								className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
									tone === "direct"
										? "bg-indigo-600 text-white"
										: "text-slate-400 hover:text-slate-200"
								}`}>
								Direct
							</button>
						</div>

						<button
							onClick={() => handleGenerateAnswer()}
							disabled={isLoading || !question.trim()}
							className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
							{isLoading ? (
								<>
									<Loader2 className="w-4 h-4 animate-spin" />
									<span>Synthesizing Answer...</span>
								</>
							) : (
								<>
									<Sparkles className="w-4 h-4 text-indigo-200" />
									<span>Generate Relevant Answer</span>
								</>
							)}
						</button>
					</div>

					{/* Generated Answer Display */}
					{(answer || isLoading) && (
						<div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 animate-in fade-in duration-200">
							<div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
								<div className="flex items-center gap-2">
									<span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
										<Sparkles className="w-3.5 h-3.5 text-indigo-400" />
										Generated First-Person Response
									</span>
									{selectedJob && (
										<span className="text-[11px] text-slate-400">
											(tailored for {selectedJob.company})
										</span>
									)}
								</div>

								{answer && !isLoading && (
									<button
										onClick={handleCopy}
										className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition-colors cursor-pointer">
										{copied ? (
											<>
												<Check className="w-3.5 h-3.5 text-emerald-400" />
												<span className="text-emerald-300">
													Copied to Clipboard!
												</span>
											</>
										) : (
											<>
												<Copy className="w-3.5 h-3.5" />
												<span>Copy Answer</span>
											</>
										)}
									</button>
								)}
							</div>

							{isLoading ? (
								<div className="py-8 flex flex-col items-center justify-center gap-2.5 text-slate-400 text-xs">
									<Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
									<span>
										Extracting facts and crafting personalized response...
									</span>
								</div>
							) : (
								<>
									<div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
										{answer}
									</div>

									{/* Refinement Quick Chips */}
									<div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
										<span className="text-[11px] text-slate-500 font-medium mr-1">
											Refine:
										</span>
										<button
											onClick={() =>
												handleRefine("Make it shorter and more concise")
											}
											className="px-2 py-0.5 rounded text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer">
											✂️ Shorter
										</button>
										<button
											onClick={() =>
												handleRefine(
													"Emphasize design systems and UX craftsmanship",
												)
											}
											className="px-2 py-0.5 rounded text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer">
											🎨 Emphasize Design Systems
										</button>
										<button
											onClick={() =>
												handleRefine(
													"Highlight modern Svelte and React technical depth",
												)
											}
											className="px-2 py-0.5 rounded text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer">
											⚡ Deep Technical Depth
										</button>
										<button
											onClick={() =>
												handleRefine(
													"Include the CRM modernization case study at TEC",
												)
											}
											className="px-2 py-0.5 rounded text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer">
											💼 Mention TEC CRM Project
										</button>
									</div>
								</>
							)}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs text-slate-400">
					<span>Grounded in James Barnes Mega Context Doc</span>
					<button
						onClick={onClose}
						className="px-3 py-1.5 text-xs text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
						Close
					</button>
				</div>
			</div>
		</div>
	);
};
