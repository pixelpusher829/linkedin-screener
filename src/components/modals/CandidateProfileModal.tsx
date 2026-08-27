import React, { useState, useEffect } from "react";
import {
	X,
	FileText,
	Sliders,
	Sparkles,
	Upload,
	Download,
	RotateCcw,
	Check,
	Copy,
	Plus,
	Trash2,
	AlertTriangle,
	Code2,
	DollarSign,
	MapPin,
	RefreshCw,
	Layers,
	Briefcase,
	Globe,
	Home,
	ShieldAlert,
	Building,
	CheckCircle2,
	ChevronDown,
	Info,
} from "lucide-react";
import { UserCriteria, CustomSignal } from "../../types";
import { DEFAULT_CONTEXT_DOC } from "../../data/defaultContextDoc";

// Small hover tooltip for explaining rubric fields inline without cluttering the UI.
const InfoTooltip: React.FC<{ text: string; className?: string }> = ({
	text,
	className = "",
}) => (
	<span className={`group relative inline-flex ${className}`}>
		<Info className="w-3 h-3 text-slate-500 hover:text-blue-400 cursor-help shrink-0" />
		<span className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-1.5 w-56 -translate-x-1/2 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-[10px] font-normal leading-relaxed text-slate-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 normal-case">
			{text}
		</span>
	</span>
);

interface CandidateProfileModalProps {
	isOpen: boolean;
	onClose: () => void;
	initialTab?: "context" | "rubric";
	contextDoc: string;
	onSaveContextDoc: (newDoc: string) => void;
	criteria: UserCriteria;
	onSaveCriteria: (criteria: UserCriteria) => void;
}

// Preset library of concise, high-impact dealbreakers categorized by topic
const DEALBREAKER_PRESETS = [
	{
		category: "Work Auth & Clearance",
		items: [
			{
				id: "US Citizen Only",
				label: "US Citizen Only",
				description: "Requires US citizenship or active security clearance",
			},
			{
				id: "US W-2 Only",
				label: "US W-2 Only",
				description:
					"Requires US residence/W-2 without Canadian EOR or contractor support",
			},
			{
				id: "No Sponsorship",
				label: "No Sponsorship",
				description: "Disqualifies roles that cannot sponsor candidate visas",
			},
			{
				id: "US C2C / 1099 Only",
				label: "US C2C / 1099 Only",
				description:
					"US 1099 corp-to-corp only with no international contractor path",
			},
		],
	},
	{
		category: "Location & Commute",
		items: [
			{
				id: "Non-Local On-Site",
				label: "Non-Local On-Site",
				description:
					"Mandatory in-person attendance outside candidate's home metro",
			},
			{
				id: "Heavy Hybrid",
				label: "Heavy Hybrid (>2d)",
				description: "Requires more than 2 in-office days per week",
			},
			{
				id: "Relocation Required",
				label: "Relocation Required",
				description: "Mandatory in-person relocation to another city",
			},
		],
	},
	{
		category: "Tech Stack & Codebase",
		items: [
			{
				id: "Legacy Stack",
				label: "Legacy Stack",
				description:
					"Heavy focus on PHP, jQuery, WordPress, or legacy frameworks",
			},
			{
				id: "Angular / Vue Only",
				label: "Angular / Vue Only",
				description: "Angular or Vue with zero modern React / TypeScript scope",
			},
			{
				id: "Heavy Backend / DevOps",
				label: "Heavy Backend / DevOps",
				description:
					"Exclusively backend infrastructure, microservices, or cloud DevOps",
			},
			{
				id: "Mobile Native Only",
				label: "Mobile Native Only",
				description:
					"Swift or Kotlin native mobile development rather than web",
			},
		],
	},
	{
		category: "Role, Pay & Culture",
		items: [
			{
				id: "Staffing Agency",
				label: "Staffing Agency",
				description: "Third-party recruitment agency or outsourcing firm",
			},
			{
				id: "Mandatory French",
				label: "Mandatory French",
				description: "Strict French fluency requirement",
			},
			{
				id: "Junior / Intern",
				label: "Junior / Intern",
				description: "Junior, entry-level, or internship positions",
			},
			{
				id: "Below Salary Floor",
				label: "Below Salary Floor",
				description: "Compensation falls below candidate base salary minimum",
			},
			{
				id: "Commission Only",
				label: "Commission Only",
				description:
					"Commission or OTE only without competitive guaranteed base salary",
			},
			{
				id: "Strict CS Degree Requirement",
				label: "Strict CS Degree",
				description:
					"Requires a CS/engineering degree and does not accept equivalent experience",
			},
		],
	},
];

const SKILL_SUGGESTIONS = [
	"React",
	"TypeScript",
	"Next.js",
	"Svelte / SvelteKit",
	"Tailwind CSS",
	"Design Systems",
	"GSAP / Animations",
	"Node.js",
	"Zustand",
	"TanStack Query",
	"GraphQL",
	"WCAG Accessibility",
	"Figma",
	"Astro",
	"Vitest",
];

const INDUSTRY_PRESETS = [
	"Product SaaS",
	"Developer Tools",
	"High-Craft Web Products",
	"Design Engineering & Creative Tech",
	"FinTech",
	"AI & ML Interfaces",
	"E-Commerce & Retail Tech",
	"Healthcare Tech",
];

const REMOTE_REGION_PRESETS = [
	{ id: "Canada", label: "Canada", description: "Hiring location is Canada" },
	{
		id: "United States",
		label: "United States",
		description: "Hiring location is the United States",
	},
	{
		id: "North America",
		label: "North America",
		description: "Hiring location is within North American timezones",
	},
	{
		id: "Worldwide",
		label: "Worldwide",
		description: "Hiring location is open worldwide",
	},
	{
		id: "UK / Europe",
		label: "UK / Europe",
		description: "Hiring location is within the UK or Europe",
	},
];

const SENIORITY_OPTIONS = [
	"Unspecified / Open",
	"Senior",
	"Staff / Lead",
	"Principal / Architect",
	"Mid-Level",
	"Engineering Manager",
];

const SCORE_WEIGHT_FIELDS = [
	{
		key: "base",
		label: "Starting score",
		hint: "Every job starts at this score before any other weights are applied.",
	},
	{
		key: "strictEducation",
		label: "Strict education",
		hint: "Applied when a posting explicitly requires a degree with no equivalent-experience alternative.",
	},
	{
		key: "salaryAbove",
		label: "Salary above floor",
		hint: "Applied when the posted salary clears your minimum by a healthy margin (20%+).",
	},
	{
		key: "salaryWithin",
		label: "Salary near floor",
		hint: "Applied when the posted salary is at or close to your minimum base salary.",
	},
	{
		key: "salaryBelow",
		label: "Salary below floor",
		hint: "Applied when the posted salary is clearly below your minimum base salary.",
	},
	{
		key: "requiredSkill",
		label: "Required skill",
		hint: "Points added per matched skill from your Required Core Tech Stack list, unless that skill has its own override weight.",
	},
	{
		key: "niceSkill",
		label: "Bonus skill",
		hint: "Points added per matched skill from your Nice-to-Have list, unless that skill has its own override weight.",
	},
	{
		key: "missingRequiredSkill",
		label: "Missing skill",
		hint: "Penalty applied per required skill that isn't mentioned in the posting. Set to 0 to only reward matches without penalizing gaps.",
	},
] as const;

const WORK_TYPE_OPTIONS = ["Remote", "On-site", "Hybrid", "Contract"] as const;

const DEFAULT_SCORE_WEIGHTS: Record<string, number> = {
	base: 30,
	canada: 20,
	usRemote: -20,
	remote: 8,
	midLevel: 10,
	unspecifiedSeniority: 8,
	senior: 4,
	leadStaff: -4,
	strictEducation: -20,
	requiredSkill: 3,
	niceSkill: 1,
	missingRequiredSkill: -3,
	junior: -25,
	homeLocation: 20,
	nonLocalOnsite: -40,
	salaryAbove: 10,
	salaryWithin: 5,
	salaryBelow: -20,
	strongKeepThreshold: 78,
};

export const CandidateProfileModal: React.FC<CandidateProfileModalProps> = ({
	isOpen,
	onClose,
	initialTab = "context",
	contextDoc,
	onSaveContextDoc,
	criteria,
	onSaveCriteria,
}) => {
	const [activeTab, setActiveTab] = useState<"context" | "rubric">(initialTab);

	// Context Doc local state
	const [docContent, setDocContent] = useState(contextDoc);
	const [copied, setCopied] = useState(false);

	// Criteria local state
	const [rubricForm, setRubricForm] = useState<UserCriteria>(criteria);
	const [newTitle, setNewTitle] = useState("");
	const [newReqSkill, setNewReqSkill] = useState("");
	const [newNiceSkill, setNewNiceSkill] = useState("");
	const [newDealbreaker, setNewDealbreaker] = useState("");
	const [newRemoteRegion, setNewRemoteRegion] = useState("");
	const [newSignalName, setNewSignalName] = useState("");
	const [newSignalKeywords, setNewSignalKeywords] = useState("");
	const [newSignalWeight, setNewSignalWeight] = useState("10");

	// Syncing state & notifications
	const [isSyncing, setIsSyncing] = useState(false);
	const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
	const [syncError, setSyncError] = useState<string | null>(null);
	const [saveToast, setSaveToast] = useState(false);

	// Reset state when modal opens
	useEffect(() => {
		if (isOpen) {
			setActiveTab(initialTab);
			setDocContent(contextDoc);
			setRubricForm({
				...criteria,
				seniorityLevels:
					criteria.seniorityLevels && criteria.seniorityLevels.length > 0
						? criteria.seniorityLevels
						: criteria.seniorityLevel
							? criteria.seniorityLevel
									.split(",")
									.map((s) => s.trim())
									.filter(Boolean)
							: ["Senior", "Staff / Lead"],
				locationPreferences: {
					homeLocation:
						criteria.locationPreferences?.homeLocation ||
						"Montreal, QC, Canada",
					allowHomeOnsiteHybrid:
						criteria.locationPreferences?.allowHomeOnsiteHybrid ?? true,
					remoteOnly: criteria.locationPreferences?.remoteOnly ?? true,
					allowedRemoteRegions: criteria.locationPreferences
						?.allowedRemoteRegions || [
						"Canada",
						"United States",
						"North America",
						"Worldwide",
					],
					allowedLocations: criteria.locationPreferences?.allowedLocations || [
						"Montreal, QC",
						"Canada",
						"North America",
					],
					requiresSponsorship:
						criteria.locationPreferences?.requiresSponsorship ?? false,
				},
				salaryCurrency: criteria.salaryCurrency || "CAD",
			});
			setSyncFeedback(null);
			setSyncError(null);
		}
	}, [isOpen, initialTab, contextDoc, criteria]);

	if (!isOpen) return null;

	// File Upload for Context Doc
	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const text = event.target?.result as string;
			if (text) {
				setDocContent(text);
			}
		};
		reader.readAsText(file);
	};

	const handleCopyDoc = () => {
		navigator.clipboard.writeText(docContent);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleResetToDefault = () => {
		if (
			confirm(
				"Reset context doc to James Barnes default Master Context Doc? Any custom edits will be replaced.",
			)
		) {
			setDocContent(DEFAULT_CONTEXT_DOC);
		}
	};

	// Auto-Sync Rubric from Context Doc via Gemini
	const handleAutoSyncRubric = async () => {
		if (!docContent.trim()) {
			alert(
				"Context document is empty. Please enter your narrative context or resume text first.",
			);
			return;
		}

		setIsSyncing(true);
		setSyncFeedback(null);
		setSyncError(null);
		onSaveContextDoc(docContent);

		try {
			const res = await fetch("/api/sync-rubric-from-context", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ contextDoc: docContent }),
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(
					err.error || "Failed to extract rubric from context doc",
				);
			}

			const data = await res.json();
			if (data.criteria) {
				setRubricForm((prev) => ({
					...prev,
					...data.criteria,
					locationPreferences: {
						...prev.locationPreferences,
						...data.criteria.locationPreferences,
						homeLocation:
							data.criteria.locationPreferences?.homeLocation ||
							prev.locationPreferences.homeLocation,
						allowHomeOnsiteHybrid: true,
						remoteOnly: true,
					},
					// Auto-extraction learns factual criteria from the document; keep the
					// user's explicit ranking preferences intact.
					weighting: prev.weighting,
				}));
				setSyncFeedback(
					data.syncSummary ||
						"Rubric successfully extracted & synchronized with Context Doc!",
				);
				setActiveTab("rubric");
			} else {
				throw new Error("The sync response did not include rubric settings.");
			}
		} catch (err: any) {
			setSyncError(err.message || "Failed to parse context doc");
		} finally {
			setIsSyncing(false);
		}
	};

	const handleExportRubric = () => {
		const blob = new Blob([JSON.stringify(rubricForm, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "linkedin-screener-rubric.json";
		link.click();
		URL.revokeObjectURL(url);
	};

	const handleImportRubric = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;

		const reader = new FileReader();
		reader.onload = () => {
			try {
				const imported = JSON.parse(String(reader.result));
				if (
					!imported ||
					typeof imported !== "object" ||
					Array.isArray(imported)
				) {
					throw new Error("Rubric settings must be a JSON object.");
				}
				setRubricForm((current) => ({
					...current,
					...imported,
					locationPreferences: {
						...current.locationPreferences,
						...(imported.locationPreferences || {}),
					},
				}));
				setSyncFeedback(
					"Rubric settings imported. Review and save to apply them.",
				);
				setSyncError(null);
			} catch (error: any) {
				setSyncError(error.message || "Could not import rubric settings.");
			}
		};
		reader.readAsText(file);
	};

	// Seniority Multi-Select Helpers
	const activeSeniorities =
		rubricForm.seniorityLevels && rubricForm.seniorityLevels.length > 0
			? rubricForm.seniorityLevels
			: rubricForm.seniorityLevel
				? rubricForm.seniorityLevel
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean)
				: ["Senior"];

	const handleToggleSeniority = (level: string) => {
		let updated: string[];
		if (activeSeniorities.includes(level)) {
			if (activeSeniorities.length <= 1) return; // Keep at least 1
			updated = activeSeniorities.filter((l) => l !== level);
		} else {
			updated = [...activeSeniorities, level];
		}
		setRubricForm({
			...rubricForm,
			seniorityLevels: updated,
			seniorityLevel: updated.join(", "),
		});
	};

	// Target Job Titles Helpers
	const handleAddTitle = () => {
		if (
			newTitle.trim() &&
			!rubricForm.targetJobTitles.includes(newTitle.trim())
		) {
			setRubricForm({
				...rubricForm,
				targetJobTitles: [...rubricForm.targetJobTitles, newTitle.trim()],
			});
			setNewTitle("");
		}
	};

	const handleRemoveTitle = (title: string) => {
		setRubricForm({
			...rubricForm,
			targetJobTitles: rubricForm.targetJobTitles.filter((t) => t !== title),
		});
	};

	// Required Tech Helpers
	const handleAddReqSkill = (skillToAdd?: string) => {
		const val = (skillToAdd || newReqSkill).trim();
		if (val && !rubricForm.techStackRequired.includes(val)) {
			setRubricForm({
				...rubricForm,
				techStackRequired: [...rubricForm.techStackRequired, val],
			});
			if (!skillToAdd) setNewReqSkill("");
		}
	};

	const handleRemoveReqSkill = (skill: string) => {
		setRubricForm({
			...rubricForm,
			techStackRequired: rubricForm.techStackRequired.filter(
				(s) => s !== skill,
			),
		});
	};

	// Nice to Have Tech Helpers
	const handleAddNiceSkill = (skillToAdd?: string) => {
		const val = (skillToAdd || newNiceSkill).trim();
		if (val && !rubricForm.techStackNiceToHave.includes(val)) {
			setRubricForm({
				...rubricForm,
				techStackNiceToHave: [...rubricForm.techStackNiceToHave, val],
			});
			if (!skillToAdd) setNewNiceSkill("");
		}
	};

	const handleRemoveNiceSkill = (skill: string) => {
		setRubricForm({
			...rubricForm,
			techStackNiceToHave: rubricForm.techStackNiceToHave.filter(
				(s) => s !== skill,
			),
		});
	};

	// Fully custom, user-defined scorecard rules
	const handleAddCustomSignal = () => {
		const name = newSignalName.trim();
		const keywords = newSignalKeywords
			.split(",")
			.map((k) => k.trim())
			.filter(Boolean);
		const weight = Number(newSignalWeight) || 0;
		if (!name || keywords.length === 0) return;
		const signal: CustomSignal = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			name,
			keywords,
			weight,
		};
		setRubricForm({
			...rubricForm,
			weighting: {
				...rubricForm.weighting,
				customSignals: [...(rubricForm.weighting?.customSignals || []), signal],
			},
		});
		setNewSignalName("");
		setNewSignalKeywords("");
		setNewSignalWeight("10");
	};

	const handleRemoveCustomSignal = (id: string) => {
		setRubricForm({
			...rubricForm,
			weighting: {
				...rubricForm.weighting,
				customSignals: (rubricForm.weighting?.customSignals || []).filter(
					(s) => s.id !== id,
				),
			},
		});
	};

	// Tooltip Lookup Helpers
	const getDealbreakerTooltip = (item: string): string => {
		for (const cat of DEALBREAKER_PRESETS) {
			const found = cat.items.find(
				(p) =>
					p.id.toLowerCase() === item.toLowerCase() ||
					p.label.toLowerCase() === item.toLowerCase() ||
					item.toLowerCase().includes(p.id.toLowerCase()),
			);
			if (found) return found.description;
		}
		return `Disqualification criteria rule: ${item}`;
	};

	const getRemoteRegionTooltip = (region: string): string => {
		const found = REMOTE_REGION_PRESETS.find(
			(r) =>
				r.id.toLowerCase() === region.toLowerCase() ||
				r.label.toLowerCase() === region.toLowerCase() ||
				region.toLowerCase().includes(r.id.toLowerCase()),
		);
		return found ? found.description : `Remote hiring zone: ${region}`;
	};

	// Dealbreaker Helpers
	const handleToggleDealbreaker = (db: string) => {
		const isPresent = rubricForm.dealbreakers.some(
			(d) =>
				d.toLowerCase() === db.toLowerCase() ||
				d.toLowerCase().includes(db.toLowerCase()) ||
				db.toLowerCase().includes(d.toLowerCase()),
		);
		if (isPresent) {
			setRubricForm({
				...rubricForm,
				dealbreakers: rubricForm.dealbreakers.filter(
					(d) =>
						d.toLowerCase() !== db.toLowerCase() &&
						!d.toLowerCase().includes(db.toLowerCase()) &&
						!db.toLowerCase().includes(d.toLowerCase()),
				),
			});
		} else {
			setRubricForm({
				...rubricForm,
				dealbreakers: [...rubricForm.dealbreakers, db],
			});
		}
	};

	const handleAddCustomDealbreaker = () => {
		if (
			newDealbreaker.trim() &&
			!rubricForm.dealbreakers.includes(newDealbreaker.trim())
		) {
			setRubricForm({
				...rubricForm,
				dealbreakers: [...rubricForm.dealbreakers, newDealbreaker.trim()],
			});
			setNewDealbreaker("");
		}
	};

	// Remote Regions Helpers
	const handleToggleRemoteRegion = (region: string) => {
		const current = rubricForm.locationPreferences.allowedRemoteRegions || [];
		const normalizeRegion = (value: string) =>
			value.toLowerCase().replace(/[^a-z0-9]/g, "");
		const normalizedRegion = normalizeRegion(region);
		const isPresent = current.some(
			(r) =>
				normalizeRegion(r) === normalizedRegion ||
				normalizeRegion(r).includes(normalizedRegion) ||
				normalizedRegion.includes(normalizeRegion(r)),
		);
		if (isPresent) {
			setRubricForm({
				...rubricForm,
				locationPreferences: {
					...rubricForm.locationPreferences,
					allowedRemoteRegions: current.filter(
						(r) =>
							normalizeRegion(r) !== normalizedRegion &&
							!normalizeRegion(r).includes(normalizedRegion) &&
							!normalizedRegion.includes(normalizeRegion(r)),
					),
				},
			});
		} else {
			setRubricForm({
				...rubricForm,
				locationPreferences: {
					...rubricForm.locationPreferences,
					allowedRemoteRegions: [...current, region],
				},
			});
		}
	};

	const handleAddCustomRemoteRegion = () => {
		const current = rubricForm.locationPreferences.allowedRemoteRegions || [];
		if (newRemoteRegion.trim() && !current.includes(newRemoteRegion.trim())) {
			setRubricForm({
				...rubricForm,
				locationPreferences: {
					...rubricForm.locationPreferences,
					allowedRemoteRegions: [...current, newRemoteRegion.trim()],
				},
			});
			setNewRemoteRegion("");
		}
	};

	// Industry Helpers
	const handleToggleIndustry = (ind: string) => {
		if (rubricForm.preferredIndustries.includes(ind)) {
			setRubricForm({
				...rubricForm,
				preferredIndustries: rubricForm.preferredIndustries.filter(
					(i) => i !== ind,
				),
			});
		} else {
			setRubricForm({
				...rubricForm,
				preferredIndustries: [...rubricForm.preferredIndustries, ind],
			});
		}
	};

	// Master Save Handler
	const handleMasterSave = () => {
		onSaveContextDoc(docContent);
		onSaveCriteria(rubricForm);
		setSaveToast(true);
		setTimeout(() => {
			setSaveToast(false);
			onClose();
		}, 600);
	};

	const wordCount = docContent.trim()
		? docContent.trim().split(/\s+/).length
		: 0;
	const homeLoc =
		rubricForm.locationPreferences.homeLocation || "Montreal, QC, Canada";

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
			<div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-6 text-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
				{/* Header with Unified Tabs */}
				<div className="px-6 py-4 border-b border-slate-800 bg-slate-950/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0">
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 border border-indigo-500/30 text-white shadow-md shadow-indigo-500/20">
							<Layers className="w-5 h-5" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h2 className="text-base font-bold text-slate-100">
									Candidate Profile & Screening Engine
								</h2>
								<span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
									Active System
								</span>
							</div>
							<p className="text-xs text-slate-400">
								Ground-truth context document and automated qualification rubric
								working in tandem
							</p>
						</div>
					</div>

					{/* Tab Switcher & Close */}
					<div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
						<div className="inline-flex p-1 bg-slate-800/80 rounded-xl border border-slate-700/70 text-xs font-medium">
							<button
								onClick={() => setActiveTab("context")}
								className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
									activeTab === "context"
										? "bg-blue-600 text-white shadow-sm font-semibold"
										: "text-slate-400 hover:text-slate-200"
								}`}>
								<FileText className="w-3.5 h-3.5" />
								<span>1. Narrative Context Doc</span>
							</button>
							<button
								onClick={() => setActiveTab("rubric")}
								className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
									activeTab === "rubric"
										? "bg-blue-600 text-white shadow-sm font-semibold"
										: "text-slate-400 hover:text-slate-200"
								}`}>
								<Sliders className="w-3.5 h-3.5" />
								<span>2. Screening Rubric & Rules</span>
							</button>
						</div>

						<button
							onClick={onClose}
							className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
							<X className="w-5 h-5" />
						</button>
					</div>
				</div>

				{/* Sync Notification Banner */}
				{syncFeedback && (
					<div className="px-6 py-2.5 bg-emerald-950/40 border-b border-emerald-800/50 flex items-center justify-between text-xs text-emerald-300 animate-in fade-in duration-200">
						<div className="flex items-center gap-2">
							<Check className="w-4 h-4 text-emerald-400 shrink-0" />
							<span>{syncFeedback}</span>
						</div>
						<button
							onClick={() => setSyncFeedback(null)}
							className="text-emerald-400 hover:text-emerald-200 underline text-[11px] cursor-pointer">
							Dismiss
						</button>
					</div>
				)}
				{syncError && (
					<div className="px-6 py-2.5 bg-rose-950/40 border-b border-rose-800/50 flex items-center justify-between gap-3 text-xs text-rose-300 animate-in fade-in duration-200">
						<span>Sync failed: {syncError}</span>
						<button
							onClick={() => setSyncError(null)}
							className="shrink-0 text-rose-400 hover:text-rose-200 underline cursor-pointer">
							Dismiss
						</button>
					</div>
				)}

				{/* Modal Body */}
				<div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
					{/* TAB 1: Narrative Context Doc */}
					{activeTab === "context" && (
						<div className="space-y-4">
							{/* Integration Helper Banner with Auto-Sync Trigger */}
							<div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-slate-900/80 border border-blue-800/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
								<div className="space-y-1">
									<div className="flex items-center gap-2 text-blue-300 font-semibold text-xs">
										<Sparkles className="w-4 h-4 text-indigo-400" />
										<span>One-Click System Sync</span>
									</div>
									<p className="text-slate-300 text-[11px] leading-relaxed">
										Paste your resume, past projects, or employment history.
										Gemini will extract exact job titles, skills, salary
										baseline, and dealbreakers directly into your Screening
										Rubric.
									</p>
								</div>

								<button
									id="btn-sync-rubric-from-context"
									onClick={handleAutoSyncRubric}
									disabled={isSyncing}
									className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer ${
										isSyncing
											? "bg-slate-700 text-slate-400 cursor-not-allowed"
											: "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-500/25 active:scale-95"
									}`}>
									<RefreshCw
										className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
									/>
									<span>
										{isSyncing
											? "Extracting & Syncing..."
											: "⚡ Auto-Extract Rubric from Doc"}
									</span>
								</button>
							</div>

							{/* Action Toolbar */}
							<div className="flex flex-wrap items-center justify-between gap-2 pt-1">
								<div className="flex items-center gap-2 text-slate-400">
									<span className="font-semibold text-slate-200">
										Narrative Source Text
									</span>
									<span>•</span>
									<span className="font-mono text-slate-400">
										{wordCount.toLocaleString()} words
									</span>
									<span>•</span>
									<span className="font-mono text-slate-400">
										{docContent.length.toLocaleString()} chars
									</span>
								</div>

								<div className="flex items-center gap-2">
									<label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer transition-colors">
										<Upload className="w-3.5 h-3.5 text-blue-400" />
										<span>Upload Resume / Doc</span>
										<input
											type="file"
											accept=".txt,.md,.json"
											onChange={handleFileUpload}
											className="hidden"
										/>
									</label>

									<button
										onClick={handleCopyDoc}
										className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer">
										{copied ? (
											<Check className="w-3.5 h-3.5 text-emerald-400" />
										) : (
											<Copy className="w-3.5 h-3.5 text-slate-400" />
										)}
										<span>{copied ? "Copied" : "Copy Doc"}</span>
									</button>

									<button
										onClick={handleResetToDefault}
										className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-amber-300/90 bg-amber-950/30 hover:bg-amber-900/40 border border-amber-800/40 transition-colors cursor-pointer"
										title="Restore default James Barnes context template">
										<RotateCcw className="w-3.5 h-3.5 text-amber-400" />
										<span>Reset Default</span>
									</button>
								</div>
							</div>

							{/* Text Area */}
							<div className="relative">
								<textarea
									id="candidate-context-textarea"
									value={docContent}
									onChange={(e) => setDocContent(e.target.value)}
									rows={18}
									className="w-full rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-relaxed"
									placeholder="Paste your comprehensive context doc, resume, job preferences, story bank, or project achievements here..."
								/>
							</div>
						</div>
					)}

					{/* TAB 2: Screening Rubric & Rules */}
					{activeTab === "rubric" && (
						<div className="space-y-6">
							{/* Active Rules Summary Banner */}
							<div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
								<div className="flex items-center gap-2.5 text-slate-300">
									<div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
									<span className="leading-snug">
										<strong className="text-slate-100">Live Rubric: </strong>
										{activeSeniorities.join(" & ") || "Senior"} •{" "}
										{homeLoc.split(",")[0]} (On-site/Hybrid/Remote) & Worldwide
										Remote • Min $
										{rubricForm.minSalary
											? rubricForm.minSalary / 1000 + "k"
											: "100k"}{" "}
										{rubricForm.salaryCurrency || "CAD"} •{" "}
										<span className="text-rose-300 font-bold">
											{rubricForm.dealbreakers.length} active dealbreakers
										</span>
									</span>
								</div>

								<div className="flex flex-wrap items-center gap-2 shrink-0">
									<label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer transition-colors">
										<Upload className="w-3.5 h-3.5 text-blue-400" />
										<span>Import Rubric</span>
										<input
											type="file"
											accept=".json,application/json"
											onChange={handleImportRubric}
											className="hidden"
										/>
									</label>
									<button
										type="button"
										onClick={handleExportRubric}
										className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer transition-colors">
										<Download className="w-3.5 h-3.5 text-emerald-400" />
										<span>Export Rubric</span>
									</button>
									<button
										type="button"
										onClick={handleAutoSyncRubric}
										disabled={isSyncing}
										className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/70 border border-indigo-700/50 transition-colors cursor-pointer shrink-0">
										<RefreshCw
											className={
												isSyncing ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"
											}
										/>
										<span>Re-Sync from Doc</span>
									</button>
								</div>
							</div>

							{/* Section 1: Seniority, Experience, and Compensation */}
							<div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-4">
								<h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
									<Briefcase className="w-4 h-4 text-blue-400" />
									<span>1. Role Profile & Compensation Floor</span>
								</h3>

								<div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
									{/* Multi-Select field for Seniority Level */}
									<div className="space-y-1.5 flex flex-col md:col-span-6">
										<div className="h-5 flex items-center justify-between">
											<label className="font-semibold text-slate-300 flex items-center gap-1.5">
												<span>Target Seniority Levels</span>
												<span className="text-[10px] text-blue-400 font-mono font-bold bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.2 rounded-full">
													{activeSeniorities.length} selected
												</span>
											</label>
											<span className="text-[10px] text-slate-500">
												Multi-select
											</span>
										</div>

										{/* Multi-select interactive pills */}
										<div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-slate-950 border border-slate-800 min-h-[46px] items-center">
											{SENIORITY_OPTIONS.map((opt) => {
												const isSelected = activeSeniorities.includes(opt);
												return (
													<button
														key={opt}
														type="button"
														onClick={() => handleToggleSeniority(opt)}
														className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
															isSelected
																? "bg-blue-600/90 text-white border-blue-500 font-semibold shadow-xs"
																: "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
														}`}>
														{isSelected && (
															<Check className="w-3 h-3 text-white shrink-0" />
														)}
														<span>{opt}</span>
														{isSelected && (
															<input
																type="number"
																min={-50}
																max={50}
																value={
																	rubricForm.weighting?.seniorityWeights?.[
																		opt
																	] ??
																	(opt === "Mid-Level"
																		? 10
																		: opt === "Senior"
																			? 4
																			: opt === "Unspecified / Open"
																				? 8
																				: -4)
																}
																onClick={(e) => e.stopPropagation()}
																onChange={(e) =>
																	setRubricForm({
																		...rubricForm,
																		weighting: {
																			...rubricForm.weighting,
																			seniorityWeights: {
																				...rubricForm.weighting
																					?.seniorityWeights,
																				[opt]: Number(e.target.value) || 0,
																			},
																		},
																	})
																}
																className="w-8 h-5 px-0.5 rounded bg-blue-950/70 border border-blue-300/30 text-white text-center font-mono text-[10px]"
																aria-label={`${opt} score weight`}
															/>
														)}
													</button>
												);
											})}
										</div>
									</div>

									{/* Years of Experience Stepper */}
									<div className="space-y-1.5 flex flex-col md:col-span-3">
										<div className="h-5 flex items-center">
											<label className="font-semibold text-slate-300">
												Experience (Years)
											</label>
										</div>
										<div className="flex items-center gap-2">
											<input
												type="number"
												min={0}
												max={30}
												value={rubricForm.yearsOfExperience}
												onChange={(e) =>
													setRubricForm({
														...rubricForm,
														yearsOfExperience: Math.max(
															0,
															parseInt(e.target.value) || 0,
														),
													})
												}
												className="w-20 h-9 px-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-mono font-bold"
											/>
											<span className="text-slate-400 font-medium text-xs">
												+ Years
											</span>
										</div>
									</div>

									{/* Minimum Base Salary Floor & Currency Selector */}
									<div className="space-y-1.5 flex flex-col md:col-span-3">
										<div className="h-5 flex items-center justify-between">
											<label className="font-semibold text-slate-300 flex items-center gap-1">
												<DollarSign className="w-3.5 h-3.5 text-emerald-400" />{" "}
												Min Base Salary
											</label>

											{/* Currency Toggle */}
											<div className="inline-flex rounded-md border border-slate-700 bg-slate-900 p-0.5 text-[10px]">
												<button
													type="button"
													onClick={() =>
														setRubricForm({
															...rubricForm,
															salaryCurrency: "CAD",
														})
													}
													className={`px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
														(rubricForm.salaryCurrency || "CAD") === "CAD"
															? "bg-emerald-600 text-white"
															: "text-slate-400 hover:text-slate-200"
													}`}>
													CAD
												</button>
												<button
													type="button"
													onClick={() =>
														setRubricForm({
															...rubricForm,
															salaryCurrency: "USD",
														})
													}
													className={`px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
														rubricForm.salaryCurrency === "USD"
															? "bg-emerald-600 text-white"
															: "text-slate-400 hover:text-slate-200"
													}`}>
													USD
												</button>
											</div>
										</div>

										<div className="relative">
											<span className="absolute left-3 top-2.5 text-slate-500 font-mono text-xs">
												$
											</span>
											<input
												type="number"
												step={5000}
												value={rubricForm.minSalary}
												onChange={(e) =>
													setRubricForm({
														...rubricForm,
														minSalary: parseInt(e.target.value) || 0,
													})
												}
												className="w-full h-9 pl-7 pr-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono font-bold"
											/>
										</div>
									</div>
								</div>

								<div className="pt-3 border-t border-slate-800/60 space-y-2">
									<div className="space-y-1">
										<label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
											<span>Scorecard weights</span>
											<InfoTooltip text="These are the base scoring levers used by the deterministic (non-AI) evaluation engine. Set a value to 0 to disable that signal entirely." />
										</label>
										<p className="text-[11px] text-slate-500">
											Values add or remove points from a job score. Negative
											values are penalties; zero disables a signal. Score bands
											below control the labels.
										</p>
									</div>
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
										{SCORE_WEIGHT_FIELDS.map((field) => (
											<label
												key={field.key}
												className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] text-slate-400">
												<span className="flex items-center gap-1 min-w-0">
													<span className="truncate" title={field.label}>
														{field.label}
													</span>
													<InfoTooltip text={field.hint} />
												</span>
												<input
													type="number"
													min={-50}
													max={50}
													value={
														rubricForm.weighting?.scoreWeights?.[field.key] ??
														DEFAULT_SCORE_WEIGHTS[field.key]
													}
													onChange={(e) =>
														setRubricForm({
															...rubricForm,
															weighting: {
																...rubricForm.weighting,
																scoreWeights: {
																	...rubricForm.weighting?.scoreWeights,
																	[field.key]: Number(e.target.value) || 0,
																},
															},
														})
													}
													className="w-11 h-6 px-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-center font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
													aria-label={`${field.label} score weight`}
												/>
											</label>
										))}
									</div>

									{/* Fully custom, user-defined scoring rules */}
									<div className="pt-2 border-t border-slate-800/60 space-y-2">
										<div className="space-y-1">
											<label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
												<span>Custom scoring rules</span>
												<InfoTooltip text="Define your own signals beyond the built-in weights above. Each rule adds/subtracts its weight whenever any of its keywords appear in the job title or description." />
											</label>
											<p className="text-[11px] text-slate-500">
												Not limited to design/frontend criteria — add whatever
												matters for your search (e.g. "Travel required" with
												keywords "up to 25% travel, on-site visits" and a
												negative weight, or "Equity heavy" with a positive
												weight).
											</p>
										</div>

										{rubricForm.weighting?.customSignals &&
											rubricForm.weighting.customSignals.length > 0 && (
												<div className="space-y-1.5">
													{rubricForm.weighting.customSignals.map((signal) => (
														<div
															key={signal.id}
															className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
															<span className="font-semibold text-slate-200 shrink-0">
																{signal.name}
															</span>
															<span className="text-slate-500 truncate flex-1">
																{signal.keywords.join(", ")}
															</span>
															<input
																type="number"
																min={-50}
																max={50}
																value={signal.weight}
																onChange={(e) =>
																	setRubricForm({
																		...rubricForm,
																		weighting: {
																			...rubricForm.weighting,
																			customSignals: (
																				rubricForm.weighting?.customSignals ||
																				[]
																			).map((s) =>
																				s.id === signal.id
																					? {
																							...s,
																							weight:
																								Number(e.target.value) || 0,
																						}
																					: s,
																			),
																		},
																	})
																}
																className="w-11 h-6 px-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-center font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0"
																aria-label={`${signal.name} score weight`}
															/>
															<button
																onClick={() =>
																	handleRemoveCustomSignal(signal.id)
																}
																className="hover:text-rose-400 cursor-pointer shrink-0">
																<X className="w-3.5 h-3.5" />
															</button>
														</div>
													))}
												</div>
											)}

										<div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto_auto] gap-2 pt-1">
											<input
												type="text"
												value={newSignalName}
												onChange={(e) => setNewSignalName(e.target.value)}
												placeholder="Rule name (e.g. Travel required)"
												className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
											/>
											<input
												type="text"
												value={newSignalKeywords}
												onChange={(e) => setNewSignalKeywords(e.target.value)}
												placeholder="Keywords, comma separated (e.g. travel, on-site visits)"
												className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
											/>
											<input
												type="number"
												min={-50}
												max={50}
												value={newSignalWeight}
												onChange={(e) => setNewSignalWeight(e.target.value)}
												className="w-16 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-center font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
												aria-label="New rule score weight"
											/>
											<button
												onClick={handleAddCustomSignal}
												className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer font-medium">
												<Plus className="w-3.5 h-3.5" /> Add Rule
											</button>
										</div>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
										<label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-slate-950 border border-rose-900/50 text-[10px] text-slate-400">
											<span className="flex items-center gap-1">
												<span>Prune below</span>
												<InfoTooltip text="Jobs scoring below this are auto-flagged REMOVE and suggested for pruning from your pipeline." />
											</span>
											<input
												type="number"
												min={0}
												max={99}
												value={
													rubricForm.weighting?.scoreBands?.pruneBelow ?? 55
												}
												onChange={(e) =>
													setRubricForm({
														...rubricForm,
														weighting: {
															...rubricForm.weighting,
															scoreBands: {
																pruneBelow: Number(e.target.value) || 0,
																keepAt:
																	rubricForm.weighting?.scoreBands?.keepAt ??
																	78,
															},
														},
													})
												}
												className="w-12 h-6 px-1 rounded bg-slate-900 border border-rose-800 text-slate-100 text-center font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-rose-500"
												aria-label="Prune jobs below score"
											/>
										</label>
										<label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-slate-950 border border-emerald-900/50 text-[10px] text-slate-400">
											<span className="flex items-center gap-1">
												<span>Keep at or above</span>
												<InfoTooltip text="Jobs scoring at or above this are auto-flagged STRONG_KEEP. Scores between the two bands are labeled CONSIDER." />
											</span>
											<input
												type="number"
												min={1}
												max={100}
												value={rubricForm.weighting?.scoreBands?.keepAt ?? 78}
												onChange={(e) =>
													setRubricForm({
														...rubricForm,
														weighting: {
															...rubricForm.weighting,
															scoreBands: {
																pruneBelow:
																	rubricForm.weighting?.scoreBands
																		?.pruneBelow ?? 55,
																keepAt: Number(e.target.value) || 0,
															},
														},
													})
												}
												className="w-12 h-6 px-1 rounded bg-slate-900 border border-emerald-800 text-slate-100 text-center font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
												aria-label="Keep jobs at or above score"
											/>
										</label>
									</div>
									<p className="text-[11px] text-slate-500">
										Scores {rubricForm.weighting?.scoreBands?.pruneBelow ?? 55}{" "}
										to {(rubricForm.weighting?.scoreBands?.keepAt ?? 78) - 1}{" "}
										are labeled Consider.
									</p>
								</div>

								{/* Target Job Titles (Functional Focus) */}
								<div className="space-y-2 pt-2 border-t border-slate-800/60">
									<label className="font-semibold text-slate-200 flex items-center justify-between">
										<span className="flex items-center gap-1.5">
											<span>Target Job Titles (Functional Focus)</span>
											<InfoTooltip text="The number on each title is its score weight - how many points a job gets when its title matches. Higher weight = stronger priority for that title." />
										</span>
										<span className="text-[11px] text-slate-500">
											Pure role specializations without seniority prefixes
										</span>
									</label>
									<div className="flex flex-wrap gap-2">
										{rubricForm.targetJobTitles.map((title) => (
											<span
												key={title}
												className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/25 flex items-center gap-1.5 font-medium">
												{title}
												<input
													type="number"
													min={-50}
													max={50}
													value={
														rubricForm.weighting?.titleWeights?.[title] ?? 0
													}
													onChange={(e) =>
														setRubricForm({
															...rubricForm,
															weighting: {
																...rubricForm.weighting,
																titleWeights: {
																	...rubricForm.weighting?.titleWeights,
																	[title]: Number(e.target.value) || 0,
																},
															},
														})
													}
													className="w-8 h-5 px-0.5 rounded bg-blue-950/70 border border-blue-500/30 text-blue-100 text-center font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400"
													aria-label={`${title} score weight`}
												/>
												<button
													onClick={() => handleRemoveTitle(title)}
													className="hover:text-rose-400 cursor-pointer">
													<X className="w-3 h-3" />
												</button>
											</span>
										))}
									</div>
									<div className="flex gap-2 pt-1">
										<input
											type="text"
											value={newTitle}
											onChange={(e) => setNewTitle(e.target.value)}
											onKeyDown={(e) =>
												e.key === "Enter" &&
												(e.preventDefault(), handleAddTitle())
											}
											placeholder="Add functional job title (e.g. Frontend Engineer, Product Designer, Full Stack Developer)..."
											className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
										/>
										<button
											onClick={handleAddTitle}
											className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer font-medium">
											<Plus className="w-3.5 h-3.5" /> Add Title
										</button>
									</div>
								</div>
							</div>

							{/* Section 2: Location & Remote Rules (Home vs Everywhere Else) */}
							<div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-4">
								<div className="flex items-center justify-between">
									<h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
										<MapPin className="w-4 h-4 text-blue-400" />
										<span>2. Location & Hybrid/Remote Rules</span>
									</h3>
									<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
										Dual-Zone Architecture
									</span>
								</div>

								{/* Home Location Setup */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-1.5">
										<label className="font-semibold text-slate-200 flex items-center gap-1.5">
											<Home className="w-3.5 h-3.5 text-emerald-400" />
											<span>Home Location (Allows On-Site & Hybrid)</span>
										</label>
										<input
											type="text"
											value={rubricForm.locationPreferences.homeLocation || ""}
											onChange={(e) =>
												setRubricForm({
													...rubricForm,
													locationPreferences: {
														...rubricForm.locationPreferences,
														homeLocation: e.target.value,
													},
												})
											}
											placeholder="e.g. Montreal, QC, Canada"
											className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-medium"
										/>
									</div>

									{/* Dual-Zone Policy Visual Callout */}
									<div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1 text-[11px]">
										<div className="font-bold text-slate-200 flex items-center gap-1.5">
											<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
											<span>Automatic Policy Enforcement:</span>
										</div>
										<ul className="space-y-1 text-slate-400 pl-4 list-disc">
											<li>
												<strong className="text-emerald-300">
													In {homeLoc.split(",")[0] || "Home City"}:
												</strong>{" "}
												On-site, Hybrid, and Remote are{" "}
												<span className="text-emerald-400 font-bold">
													ALL accepted
												</span>
												.
											</li>
											<li>
												<strong className="text-blue-300">
													Outside {homeLoc.split(",")[0] || "Home City"}:
												</strong>{" "}
												Must be{" "}
												<span className="text-blue-400 font-bold">
													100% Remote
												</span>
												. Mandatory in-person attendance in other cities
												triggers a location dealbreaker.
											</li>
										</ul>
									</div>
								</div>

								{/* Allowed Hiring Locations */}
								<div className="space-y-2 pt-2 border-t border-slate-800/60">
									<label className="font-semibold text-slate-200 flex items-center justify-between">
										<span className="flex items-center gap-1.5">
											<Globe className="w-3.5 h-3.5 text-blue-400" />
											<span>Allowed Hiring Locations</span>
											<InfoTooltip text="Applies only to remote roles outside your home location. Add any hiring region/country and set how many points it's worth." />
										</span>
										<span className="text-[11px] text-slate-500">
											Set a score weight on each hiring region
										</span>
									</label>

									<div className="flex flex-wrap gap-2">
										{REMOTE_REGION_PRESETS.map((region) => {
											const normalizeRegion = (value: string) =>
												value.toLowerCase().replace(/[^a-z0-9]/g, "");
											const isSelected = (
												rubricForm.locationPreferences.allowedRemoteRegions ||
												[]
											).some(
												(r) =>
													normalizeRegion(r) === normalizeRegion(region.id) ||
													normalizeRegion(r) ===
														normalizeRegion(region.label) ||
													normalizeRegion(r).includes(
														normalizeRegion(region.label),
													) ||
													normalizeRegion(region.label).includes(
														normalizeRegion(r),
													),
											);
											return (
												<button
													key={region.id}
													type="button"
													title={region.description}
													onClick={() => handleToggleRemoteRegion(region.id)}
													className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
														isSelected
															? "bg-blue-500/20 text-blue-300 border-blue-500/40 font-semibold"
															: "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
													}`}>
													{isSelected && (
														<Check className="w-3 h-3 text-blue-400 shrink-0" />
													)}
													<span>{region.label}</span>
													{isSelected && (
														<input
															type="number"
															min={-50}
															max={50}
															value={
																rubricForm.weighting?.locationWeights?.[
																	region.id
																] ?? 0
															}
															onClick={(e) => e.stopPropagation()}
															onChange={(e) =>
																setRubricForm({
																	...rubricForm,
																	weighting: {
																		...rubricForm.weighting,
																		locationWeights: {
																			...rubricForm.weighting?.locationWeights,
																			[region.id]: Number(e.target.value) || 0,
																		},
																	},
																})
															}
															className="w-8 h-5 px-0.5 rounded bg-blue-950/70 border border-blue-300/30 text-blue-100 text-center font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400"
															aria-label={`${region.label} score weight`}
														/>
													)}
												</button>
											);
										})}
									</div>

									<div className="flex gap-2 pt-1">
										<input
											type="text"
											value={newRemoteRegion}
											onChange={(e) => setNewRemoteRegion(e.target.value)}
											onKeyDown={(e) =>
												e.key === "Enter" &&
												(e.preventDefault(), handleAddCustomRemoteRegion())
											}
											placeholder="Add custom hiring location (e.g. Latin America, EMEA)..."
											className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
										/>
										<button
											onClick={handleAddCustomRemoteRegion}
											className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer font-medium">
											<Plus className="w-3.5 h-3.5" /> Add Location
										</button>
									</div>
								</div>

								<div className="space-y-2 pt-2 border-t border-slate-800/60">
									<label className="font-semibold text-slate-200 flex items-center justify-between">
										<span className="flex items-center gap-1.5">
											<span>Job Type Preferences</span>
											<InfoTooltip text="Weight applied based on the posting's work arrangement (Remote/On-site/Hybrid/Contract), on top of the home-location and remote-region rules above." />
										</span>
										<span className="text-[11px] text-slate-500">
											Set an independent score weight for each work type
										</span>
									</label>
									<div className="flex flex-wrap gap-2">
										{WORK_TYPE_OPTIONS.map((workType) => (
											<span
												key={workType}
												className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 flex items-center gap-1.5 font-medium">
												<span>{workType}</span>
												<input
													type="number"
													min={-50}
													max={50}
													value={
														rubricForm.weighting?.workTypeWeights?.[workType] ??
														0
													}
													onChange={(e) =>
														setRubricForm({
															...rubricForm,
															weighting: {
																...rubricForm.weighting,
																workTypeWeights: {
																	...rubricForm.weighting?.workTypeWeights,
																	[workType]: Number(e.target.value) || 0,
																},
															},
														})
													}
													className="w-8 h-5 px-0.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-100 text-center font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-cyan-400"
													aria-label={`${workType} score weight`}
												/>
											</span>
										))}
									</div>
								</div>

								{/* Work Auth & Sponsorship Checkboxes */}
								<div className="pt-2 flex flex-wrap gap-4 border-t border-slate-800/60">
									<label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
										<input
											type="checkbox"
											checked={
												rubricForm.locationPreferences.requiresSponsorship
											}
											onChange={(e) =>
												setRubricForm({
													...rubricForm,
													locationPreferences: {
														...rubricForm.locationPreferences,
														requiresSponsorship: e.target.checked,
													},
												})
											}
											className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
										/>
										<span className="text-slate-200 font-medium">
											Candidate Requires Visa Sponsorship
										</span>
									</label>
								</div>
							</div>

							{/* Section 3: Clean Dealbreakers Matrix (Concise Chips & Quick Presets) */}
							<div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/30 space-y-4">
								<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
									<div>
										<h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
											<ShieldAlert className="w-4 h-4 text-rose-400" />
											<span>3. Strict Dealbreakers (Instant Discards)</span>
										</h3>
										<p className="text-[11px] text-rose-300/80 pt-0.5">
											Bite-sized trigger rules. Hover any item to see full
											criteria explanation.
										</p>
									</div>

									<span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-rose-950/80 text-rose-400 border border-rose-800/60 shrink-0 self-start sm:self-center">
										{rubricForm.dealbreakers.length} Active Rules
									</span>
								</div>

								{/* Active Dealbreakers as Concise Chips */}
								<div className="space-y-1.5">
									<div className="text-[11px] font-semibold text-slate-300">
										Active Disqualification Rules:
									</div>
									{rubricForm.dealbreakers.length > 0 ? (
										<div className="flex flex-wrap gap-2">
											{rubricForm.dealbreakers.map((db) => {
												const tooltip = getDealbreakerTooltip(db);
												return (
													<span
														key={db}
														title={tooltip}
														className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-200 border border-rose-500/30 flex items-center gap-1.5 font-medium text-xs shadow-xs hover:border-rose-400/60 transition-colors">
														<AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
														<span>{db}</span>
														<button
															type="button"
															onClick={() => handleToggleDealbreaker(db)}
															className="hover:text-white cursor-pointer ml-1 p-0.5 rounded hover:bg-rose-900/50"
															title="Remove dealbreaker">
															<X className="w-3 h-3" />
														</button>
													</span>
												);
											})}
										</div>
									) : (
										<div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-400 text-xs italic">
											No dealbreakers currently active. Click presets below to
											activate instant disqualification triggers.
										</div>
									)}
								</div>

								{/* Quick Toggle Preset Dealbreaker Matrix */}
								<div className="space-y-2.5 pt-3 border-t border-rose-900/30">
									<div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
										<Sparkles className="w-3.5 h-3.5 text-indigo-400" />
										<span>Quick-Toggle Common Dealbreaker Presets:</span>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										{DEALBREAKER_PRESETS.map((group) => (
											<div
												key={group.category}
												className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5">
												<div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
													{group.category}
												</div>
												<div className="flex flex-wrap gap-1.5">
													{group.items.map((item) => {
														const isChecked = rubricForm.dealbreakers.some(
															(d) =>
																d.toLowerCase() === item.id.toLowerCase() ||
																d.toLowerCase() === item.label.toLowerCase() ||
																d.toLowerCase().includes(item.id.toLowerCase()),
														);
														return (
															<button
																key={item.id}
																type="button"
																title={item.description}
																onClick={() => handleToggleDealbreaker(item.id)}
																className={`px-2 py-1 rounded text-[11px] font-medium border transition-all cursor-pointer flex items-center gap-1 text-left ${
																	isChecked
																		? "bg-rose-600 text-white border-rose-500 font-semibold shadow-xs"
																		: "bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
																}`}>
																{isChecked ? (
																	<Check className="w-3 h-3 text-white shrink-0" />
																) : (
																	<Plus className="w-3 h-3 text-slate-500 shrink-0" />
																)}
																<span>{item.label}</span>
															</button>
														);
													})}
												</div>
											</div>
										))}
									</div>
								</div>

								{/* Add Custom Concise Dealbreaker */}
								<div className="flex gap-2 pt-2 border-t border-rose-900/30">
									<input
										type="text"
										value={newDealbreaker}
										onChange={(e) => setNewDealbreaker(e.target.value)}
										onKeyDown={(e) =>
											e.key === "Enter" &&
											(e.preventDefault(), handleAddCustomDealbreaker())
										}
										placeholder="Add custom concise dealbreaker (e.g. Unpaid take-home trial > 4 hours)..."
										className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 text-xs"
									/>
									<button
										onClick={handleAddCustomDealbreaker}
										className="px-3 py-1.5 rounded-lg bg-rose-900/50 hover:bg-rose-900/80 text-rose-200 border border-rose-700/50 transition-colors flex items-center gap-1 cursor-pointer font-medium">
										<Plus className="w-3.5 h-3.5" /> Add Rule
									</button>
								</div>
							</div>

							{/* Section 4: Skills Matrix (Required & Nice to Have) */}
							<div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-4">
								<h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
									<Code2 className="w-4 h-4 text-emerald-400" />
									<span>4. Tech Stack & Skill Matrix</span>
								</h3>

								{/* Required Core Stack */}
								<div className="space-y-2">
									<label className="font-semibold text-slate-200 flex items-center justify-between">
										<span className="text-emerald-400 font-bold flex items-center gap-1.5">
											<span>Required Core Tech Stack (High Weight)</span>
											<InfoTooltip text="The number on each skill is its score weight. These skills also drive the 'Matched skills' shown on each analyzed job." />
										</span>
										<span className="text-[11px] text-slate-500">
											Must be prominently featured
										</span>
									</label>
									<div className="flex flex-wrap gap-2">
										{rubricForm.techStackRequired.map((skill) => (
											<span
												key={skill}
												className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 flex items-center gap-1.5 font-medium">
												<span>{skill}</span>
												<input
													type="number"
													min={-20}
													max={20}
													value={
														rubricForm.weighting?.skillWeights?.[skill] ??
														rubricForm.weighting?.scoreWeights?.requiredSkill ??
														DEFAULT_SCORE_WEIGHTS.requiredSkill
													}
													onChange={(e) =>
														setRubricForm({
															...rubricForm,
															weighting: {
																...rubricForm.weighting,
																skillWeights: {
																	...rubricForm.weighting?.skillWeights,
																	[skill]: Number(e.target.value) || 0,
																},
															},
														})
													}
													className="w-8 h-5 px-0.5 rounded bg-emerald-950/70 border border-emerald-500/30 text-emerald-100 text-center font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-400"
													aria-label={`${skill} score weight`}
												/>
												<button
													onClick={() => handleRemoveReqSkill(skill)}
													className="hover:text-rose-400 cursor-pointer">
													<X className="w-3 h-3" />
												</button>
											</span>
										))}
									</div>
									<div className="flex gap-2 pt-1">
										<input
											type="text"
											value={newReqSkill}
											onChange={(e) => setNewReqSkill(e.target.value)}
											onKeyDown={(e) =>
												e.key === "Enter" &&
												(e.preventDefault(), handleAddReqSkill())
											}
											placeholder="Add required skill (e.g. TypeScript, React, Tailwind)..."
											className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
										/>
										<button
											onClick={() => handleAddReqSkill()}
											className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer font-medium">
											<Plus className="w-3.5 h-3.5" /> Add Required
										</button>
									</div>
								</div>

								{/* Nice-to-Have Stack */}
								<div className="space-y-2 pt-3 border-t border-slate-800/60">
									<label className="font-semibold text-slate-200 flex items-center justify-between">
										<span className="text-cyan-400 font-bold flex items-center gap-1.5">
											<span>Nice-to-Have / Bonus Skills</span>
											<InfoTooltip text="Smaller bonus weight than required skills. Useful for skills that are a plus but not a dealbreaker if missing." />
										</span>
										<span className="text-[11px] text-slate-500">
											Adds score bonus
										</span>
									</label>
									<div className="flex flex-wrap gap-2">
										{rubricForm.techStackNiceToHave.map((skill) => (
											<span
												key={skill}
												className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 flex items-center gap-1.5 font-medium">
												<span>{skill}</span>
												<input
													type="number"
													min={-20}
													max={20}
													value={
														rubricForm.weighting?.skillWeights?.[skill] ??
														rubricForm.weighting?.scoreWeights?.niceSkill ??
														DEFAULT_SCORE_WEIGHTS.niceSkill
													}
													onChange={(e) =>
														setRubricForm({
															...rubricForm,
															weighting: {
																...rubricForm.weighting,
																skillWeights: {
																	...rubricForm.weighting?.skillWeights,
																	[skill]: Number(e.target.value) || 0,
																},
															},
														})
													}
													className="w-8 h-5 px-0.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-100 text-center font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-cyan-400"
													aria-label={`${skill} score weight`}
												/>
												<button
													onClick={() => handleRemoveNiceSkill(skill)}
													className="hover:text-rose-400 cursor-pointer">
													<X className="w-3 h-3" />
												</button>
											</span>
										))}
									</div>
									<div className="flex gap-2 pt-1">
										<input
											type="text"
											value={newNiceSkill}
											onChange={(e) => setNewNiceSkill(e.target.value)}
											onKeyDown={(e) =>
												e.key === "Enter" &&
												(e.preventDefault(), handleAddNiceSkill())
											}
											placeholder="Add bonus skill (e.g. GSAP, TanStack Query, Astro)..."
											className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs"
										/>
										<button
											onClick={() => handleAddNiceSkill()}
											className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer font-medium">
											<Plus className="w-3.5 h-3.5" /> Add Bonus
										</button>
									</div>
								</div>

								{/* Quick Skill Suggestion Cloud */}
								<div className="pt-2 space-y-1.5 border-t border-slate-800/60">
									<div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
										Quick Add Suggestions:
									</div>
									<div className="flex flex-wrap gap-1.5">
										{SKILL_SUGGESTIONS.map((skill) => {
											const isReq =
												rubricForm.techStackRequired.includes(skill);
											const isNice =
												rubricForm.techStackNiceToHave.includes(skill);
											if (isReq || isNice) return null;
											return (
												<button
													key={skill}
													type="button"
													onClick={() => handleAddReqSkill(skill)}
													className="px-2 py-0.5 rounded text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer flex items-center gap-1">
													<Plus className="w-2.5 h-2.5" />
													<span>{skill}</span>
												</button>
											);
										})}
									</div>
								</div>
							</div>

							{/* Section 5: Target Industries & Strategic Instructions */}
							<div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-4">
								<h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
									<Building className="w-4 h-4 text-indigo-400" />
									<span>5. Preferred Industries & AI Guidance</span>
								</h3>

								{/* Preferred Industries */}
								<div className="space-y-2">
									<label className="font-semibold text-slate-200 flex items-center justify-between">
										<span>Target Industries</span>
										<span className="text-[11px] text-slate-500">
											Click to toggle preferred sectors
										</span>
									</label>
									<div className="flex flex-wrap gap-2">
										{INDUSTRY_PRESETS.map((ind) => {
											const isSelected =
												rubricForm.preferredIndustries.includes(ind);
											return (
												<button
													key={ind}
													type="button"
													onClick={() => handleToggleIndustry(ind)}
													className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
														isSelected
															? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-semibold"
															: "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
													}`}>
													{isSelected && (
														<Check className="w-3 h-3 text-indigo-400" />
													)}
													<span>{ind}</span>
												</button>
											);
										})}
									</div>
								</div>

								{/* Custom Evaluation Strategic Prompt */}
								<div className="space-y-1.5 pt-2 border-t border-slate-800/60">
									<label className="font-semibold text-slate-200 flex items-center justify-between">
										<span className="flex items-center gap-1.5">
											<Sparkles className="w-3.5 h-3.5 text-indigo-400" />{" "}
											Strategic Evaluation Guidance
											<InfoTooltip text="Only used by the AI-powered evaluation (Gemini), not the offline/deterministic scorer. Describe anything the numeric weights can't capture." />
										</span>
										<span className="text-[11px] text-slate-500">
											Custom rules guiding Gemini match decisions
										</span>
									</label>
									<textarea
										value={rubricForm.customEvaluationPrompt}
										onChange={(e) =>
											setRubricForm({
												...rubricForm,
												customEvaluationPrompt: e.target.value,
											})
										}
										rows={3}
										className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs leading-relaxed"
										placeholder="Focus on product engineering roles with modern React/TypeScript architectures. Flag heavy legacy codebases or non-technical management cultures..."
									/>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="px-6 py-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-4 shrink-0">
					<div className="text-[11px] text-slate-500 hidden sm:block">
						{activeTab === "context"
							? "Context doc is the ground-truth for all AI generation and answer prompts."
							: "Rubric rules are actively enforced during bulk qualification & pruning."}
					</div>

					<div className="flex items-center gap-3 w-full sm:w-auto justify-end">
						<button
							onClick={onClose}
							className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
							Cancel
						</button>
						<button
							id="btn-save-candidate-profile"
							onClick={handleMasterSave}
							className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 active:scale-95 transition-all cursor-pointer">
							<Check className="w-3.5 h-3.5" />
							<span>
								{saveToast ? "Saved & Synchronized!" : "Save & Synchronize All"}
							</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
