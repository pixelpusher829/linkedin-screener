import React, { useState } from "react";
import {
	X,
	Link,
	FileText,
	Bookmark,
	Plus,
	Loader2,
	CheckCircle2,
	AlertCircle,
	Copy,
	Check,
	ExternalLink,
} from "lucide-react";
import { JobPosting, WorkplaceType } from "../types";

interface ImportJobsModalProps {
	isOpen: boolean;
	onClose: () => void;
	onAddJobs: (jobs: JobPosting[]) => void;
}

export const ImportJobsModal: React.FC<ImportJobsModalProps> = ({
	isOpen,
	onClose,
	onAddJobs,
}) => {
	const [activeTab, setActiveTab] = useState<
		"urls" | "paste" | "bookmarklet" | "manual"
	>("urls");

	// Tab 1: URLs
	const [urlsInput, setUrlsInput] = useState("");
	const [isScraping, setIsScraping] = useState(false);
	const [scrapeError, setScrapeError] = useState<string | null>(null);

	// Tab 2: Raw Text / HTML
	const [trackerText, setTrackerText] = useState("");
	const [isParsingText, setIsParsingText] = useState(false);
	const [parseError, setParseError] = useState<string | null>(null);

	// Tab 3: Bookmarklet copied state
	const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);

	// Tab 4: Manual Form
	const [manualForm, setManualForm] = useState({
		title: "",
		company: "",
		location: "United States (Remote)",
		workplaceType: "Remote" as WorkplaceType,
		salaryRaw: "",
		url: "",
	});

	if (!isOpen) return null;

	// Helper to extract clean URLs from any input text (newline, comma, markdown, or JSON)
	const extractUrlsFromText = (text: string): string[] => {
		// 1. Check if user pasted JSON
		try {
			const parsed = JSON.parse(text);
			if (Array.isArray(parsed)) {
				const found = parsed
					.map((item) => item.url)
					.filter(
						(u) =>
							typeof u === "string" &&
							(u.startsWith("http://") || u.startsWith("https://")),
					);
				if (found.length > 0) return [...new Set(found)];
			}
		} catch (e) {}

		// 2. Regex match all HTTP/HTTPS links
		const matches = text.match(/https?:\/\/[^\s"',<>)\]}]+/g) || [];
		const cleanUrls = matches
			.map((u) => u.replace(/[.,;:]+$/, "").trim())
			.filter((u) => u.startsWith("http://") || u.startsWith("https://"));

		return [...new Set(cleanUrls)];
	};

	// Handler for URLs
	const handleScrapeUrls = async () => {
		const urls = extractUrlsFromText(urlsInput);

		if (urls.length === 0) {
			setScrapeError("Please enter at least one valid HTTP/HTTPS job link.");
			return;
		}

		setIsScraping(true);
		setScrapeError(null);

		try {
			const res = await fetch("/api/scrape-urls", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ urls }),
			});

			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}));
				throw new Error(errorData.error || `Server returned ${res.status}`);
			}

			const data = await res.json();
			if (data.warning) setScrapeError(data.warning);
			const newJobs: JobPosting[] = (data.results || []).map(
				(item: any, idx: number) => ({
					id: `job-url-${Date.now()}-${idx}`,
					url: item.url || urls[idx] || "https://www.linkedin.com/jobs",
					title: item.title || "Job Opportunity",
					company: item.company || "Hiring Company",
					location: item.location || "Remote",
					headerRaw: item.headerRaw || item.headerText,
					workplaceType: ["Remote", "Hybrid", "On-site"].includes(
						item.workplaceType,
					)
						? (item.workplaceType as WorkplaceType)
						: (item.headerRaw || item.headerText || "")
									.toLowerCase()
									.includes("remote")
							? "Remote"
							: (item.headerRaw || item.headerText || "")
										.toLowerCase()
										.includes("hybrid")
								? "Hybrid"
								: "Unknown",
					salaryRaw: item.salaryRaw,
					descriptionRaw: item.descriptionRaw || item.title,
					source: "direct_link",
					status: "to_qualify",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				}),
			);

			if (newJobs.length > 0) {
				onAddJobs(newJobs);
				setUrlsInput("");
				onClose();
			} else {
				setScrapeError("No jobs could be extracted from the provided links.");
			}
		} catch (err: any) {
			setScrapeError(err.message || "Failed to scrape job URLs.");
		} finally {
			setIsScraping(false);
		}
	};

	// Handler for Raw Text / HTML / JSON Parse
	const handleParseTrackerText = async () => {
		const trimmed = trackerText.trim();
		if (!trimmed) {
			setParseError(
				"Please paste text, HTML, or extracted JSON from your LinkedIn Saved Jobs page.",
			);
			return;
		}

		// 1. Instant client-side JSON parse if user pasted JSON array from the extractor
		if (
			trimmed.startsWith("[") ||
			(trimmed.startsWith("{") && trimmed.includes('"title"'))
		) {
			try {
				const parsed = JSON.parse(trimmed);
				const arrayData = Array.isArray(parsed)
					? parsed
					: parsed.jobs || [parsed];
				const directJobs: JobPosting[] = arrayData.map(
					(j: any, idx: number) => ({
						id: `job-json-${Date.now()}-${idx}`,
						url: j.url || "https://www.linkedin.com/jobs",
						title: j.title || "Software Opportunity",
						company: j.company || "Company",
						location: j.location || "Remote",
						headerRaw: j.headerRaw || j.headerText,
						workplaceType:
							(j.workplaceType as WorkplaceType) ||
							(j.location?.toLowerCase().includes("remote")
								? "Remote"
								: j.location?.toLowerCase().includes("hybrid")
									? "Hybrid"
									: "Unknown"),
						salaryRaw: j.salaryRaw,
						descriptionRaw:
							j.descriptionRaw ||
							j.descriptionSummary ||
							`${j.title} at ${j.company}. Location: ${j.location}`,
						source: "linkedin_tracker",
						status: "to_qualify",
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					}),
				);

				if (directJobs.length > 0) {
					onAddJobs(directJobs);
					setTrackerText("");
					onClose();
					return;
				}
			} catch (e) {
				// Continue to server parse
			}
		}

		setIsParsingText(true);
		setParseError(null);

		try {
			const res = await fetch("/api/parse-tracker-text", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: trimmed }),
			});

			if (!res.ok) throw new Error("Failed to parse content");

			const data = await res.json();
			const extractedJobs: JobPosting[] = (data.jobs || []).map(
				(j: any, idx: number) => ({
					id: `job-tracker-${Date.now()}-${idx}`,
					url: j.url || "https://www.linkedin.com/jobs",
					title: j.title || "Software Opportunity",
					company: j.company || "Company",
					location: j.location || "Remote",
					headerRaw: j.headerRaw || j.headerText,
					workplaceType: (j.workplaceType as WorkplaceType) || "Remote",
					salaryRaw: j.salaryRaw,
					descriptionRaw:
						j.descriptionSummary ||
						`${j.title} at ${j.company}. Location: ${j.location}`,
					source: "linkedin_tracker",
					status: "to_qualify",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				}),
			);

			if (extractedJobs.length > 0) {
				onAddJobs(extractedJobs);
				setTrackerText("");
				onClose();
			} else {
				setParseError(
					"Could not detect any job postings from the pasted content. Try pasting direct links or running the 1-Click Extractor.",
				);
			}
		} catch (err: any) {
			setParseError(err.message || "Failed to parse pasted tracker text.");
		} finally {
			setIsParsingText(false);
		}
	};

	// Handler for Manual Add
	const handleManualAdd = () => {
		if (!manualForm.title.trim() || !manualForm.company.trim()) {
			alert("Job Title and Company Name are required.");
			return;
		}

		const newJob: JobPosting = {
			id: `job-manual-${Date.now()}`,
			url: manualForm.url.trim() || "https://www.linkedin.com/jobs",
			title: manualForm.title.trim(),
			company: manualForm.company.trim(),
			location: manualForm.location.trim() || "Remote",
			workplaceType: manualForm.workplaceType,
			salaryRaw: manualForm.salaryRaw.trim() || undefined,
			descriptionRaw: `${manualForm.title} at ${manualForm.company}. Location: ${manualForm.location}`,
			source: "paste",
			status: "to_qualify",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		onAddJobs([newJob]);
		onClose();
	};

	const bookmarkletCode = `javascript:(function(){
  const extracted = [];
  const seen = new Set();
  function extractId(s){
    if(!s) return null;
    const m = s.match(/urn:li:jobPosting:(\\d+)/) || s.match(/currentJobId=(\\d+)/) || s.match(/\\/jobs\\/view\\/(?:[^\\/]+-)?(\\d+)/) || s.match(/(\\d{8,14})/);
    return m ? m[1] : null;
  }
  function clean(t){ return (t||'').replace(/\\s+/g,' ').trim(); }

  const cards = Array.from(document.querySelectorAll('.entity-result, .job-card-container, .jobs-search-results-list__list-item, .reusable-search__result-container, li[data-occludable-job-id], div[data-view-name="job-card"], div[data-chameleon-result-urn], .job-card-list__entity-lockup'));
  
  cards.forEach(c => {
    const link = c.querySelector('a[href*="/jobs/view/"], a[href*="currentJobId="], a.job-card-list__title, a.job-card-container__link, a.app-aware-link, a');
    const rawHref = link ? (link.getAttribute('href') || link.href) : '';
    const urn = c.getAttribute('data-chameleon-result-urn') || c.getAttribute('data-entity-urn') || c.getAttribute('data-job-id') || c.getAttribute('data-occludable-job-id') || '';
    const jobId = extractId(urn) || extractId(rawHref);
    if(!jobId || seen.has(jobId)) return;
    seen.add(jobId);

    const titleEl = c.querySelector('.entity-result__title-text a span[aria-hidden="true"], .job-card-list__title, .artdeco-entity-lockup__title a, .entity-result__title-text a, h3 a, h3, h4');
    let title = titleEl ? clean(titleEl.innerText || titleEl.textContent) : (link ? clean(link.innerText || link.textContent) : '');
    title = title.split('\\n')[0].replace(/Status is.*$/i,'').replace(/Viewed.*$/i,'').replace(/Applied.*$/i,'').trim();

    const compEl = c.querySelector('.entity-result__primary-subtitle, .job-card-container__company-name, [data-anonymize="job-company"], .artdeco-entity-lockup__subtitle, .job-card-container__primary-description');
    const company = compEl ? clean(compEl.innerText || compEl.textContent) : 'LinkedIn Employer';

    const locEl = c.querySelector('.entity-result__secondary-subtitle, .job-card-container__metadata-item, .artdeco-entity-lockup__caption, .job-card-container__metadata-wrapper');
    const location = locEl ? clean(locEl.innerText || locEl.textContent) : 'Remote';

    const isRemote = (location + ' ' + title).toLowerCase().includes('remote');
    const isHybrid = (location + ' ' + title).toLowerCase().includes('hybrid');

    extracted.push({
      url: 'https://www.linkedin.com/jobs/view/' + jobId + '/',
      title: title || 'LinkedIn Software Role',
      company: company,
      location: location,
      workplaceType: isRemote ? 'Remote' : (isHybrid ? 'Hybrid' : 'On-site'),
      descriptionRaw: (title || 'Role') + ' at ' + company + '. Location: ' + location
    });
  });

  if(extracted.length === 0){
    document.querySelectorAll('a[href*="/jobs/view/"], a[href*="currentJobId="]').forEach(a => {
      const href = a.getAttribute('href') || a.href;
      const id = extractId(href);
      if(id && !seen.has(id)){
        seen.add(id);
        const title = clean(a.innerText || a.textContent) || 'LinkedIn Job Posting';
        extracted.push({
          url: 'https://www.linkedin.com/jobs/view/' + id + '/',
          title: title.split('\\n')[0].trim(),
          company: 'LinkedIn Company',
          location: 'Remote / Unspecified',
          workplaceType: title.toLowerCase().includes('remote') ? 'Remote' : 'Hybrid',
          descriptionRaw: title + ' extracted from LinkedIn.'
        });
      }
    });
  }

  if(extracted.length === 0){
    alert('⚠️ No LinkedIn job links found on this page.\\n\\nPlease navigate to https://www.linkedin.com/my-items/saved-jobs/ or a Job Search tab first!');
    return;
  }

  const jsonStr = JSON.stringify(extracted, null, 2);
  const urlsStr = extracted.map(j => j.url).join('\\n');

  let copied = false;
  if(typeof copy === 'function'){ try{ copy(jsonStr); copied = true; }catch(e){} }
  if(!copied && navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(jsonStr).then(()=>{ copied = true; }).catch(()=>{});
  }
  if(!copied){
    try{
      const ta = document.createElement('textarea');
      ta.value = jsonStr;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copied = true;
    }catch(e){}
  }

  const old = document.getElementById('li-screener-modal');
  if(old) old.remove();

  const m = document.createElement('div');
  m.id = 'li-screener-modal';
  m.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999999;width:370px;background:#0f172a;color:#f8fafc;border:2px solid #3b82f6;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);font-family:system-ui,-apple-system,sans-serif;padding:20px;box-sizing:border-box;line-height:1.4;';
  m.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><div style="display:flex;align-items:center;gap:8px;"><span style="font-size:18px;">⚡</span><strong style="font-size:14px;color:#60a5fa;">LinkedIn Job Extractor</strong></div><button id="li-close-btn" style="background:transparent;border:none;color:#94a3b8;font-size:16px;cursor:pointer;">✕</button></div><p style="font-size:12px;color:#e2e8f0;margin:0 0 12px 0;">Extracted <b style="color:#34d399;font-size:14px;">' + extracted.length + ' jobs</b>! Copied to clipboard.</p><div style="display:flex;flex-direction:column;gap:8px;"><button id="li-copy-json" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:9px 12px;font-size:12px;font-weight:bold;cursor:pointer;">📋 Copy JSON for Screener</button><button id="li-copy-urls" style="background:#334155;color:#f8fafc;border:1px solid #475569;border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer;">🔗 Copy ' + extracted.length + ' URLs Only</button></div><div style="font-size:11px;color:#94a3b8;margin-top:10px;text-align:center;">Return to Screener and paste in <b>LinkedIn Sync</b> or <b>Import</b>!</div>';
  document.body.appendChild(m);

  document.getElementById('li-close-btn').onclick = () => m.remove();
  document.getElementById('li-copy-json').onclick = (e) => {
    navigator.clipboard.writeText(jsonStr);
    e.target.innerHTML = '✅ Copied to Clipboard!';
    e.target.style.background = '#059669';
    setTimeout(()=>{ e.target.innerHTML = '📋 Copy JSON for Screener'; e.target.style.background = '#2563eb'; }, 2000);
  };
  document.getElementById('li-copy-urls').onclick = (e) => {
    navigator.clipboard.writeText(urlsStr);
    e.target.innerHTML = '✅ URLs Copied!';
    e.target.style.background = '#059669';
    setTimeout(()=>{ e.target.innerHTML = '🔗 Copy ' + extracted.length + ' URLs Only'; e.target.style.background = '#334155'; }, 2000);
  };
})();`;

	const copyBookmarklet = () => {
		navigator.clipboard.writeText(bookmarkletCode);
		setCopiedBookmarklet(true);
		setTimeout(() => setCopiedBookmarklet(false), 2500);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
			<div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-8 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
					<div className="flex items-center gap-2.5">
						<div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
							<Link className="w-5 h-5" />
						</div>
						<div>
							<h2 className="text-lg font-bold text-slate-100">
								Import Jobs for AI Qualification
							</h2>
							<p className="text-xs text-slate-400">
								Pull in jobs from LinkedIn saved tracker, links, or pasted text
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Tab Navigation */}
				<div className="flex border-b border-slate-800 px-6 bg-slate-950/40 text-xs">
					<button
						onClick={() => setActiveTab("urls")}
						className={`py-3 px-4 font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
							activeTab === "urls"
								? "border-blue-500 text-blue-400"
								: "border-transparent text-slate-400 hover:text-slate-200"
						}`}>
						<Link className="w-3.5 h-3.5" />
						<span>Job URLs / Links</span>
					</button>

					<button
						onClick={() => setActiveTab("paste")}
						className={`py-3 px-4 font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
							activeTab === "paste"
								? "border-blue-500 text-blue-400"
								: "border-transparent text-slate-400 hover:text-slate-200"
						}`}>
						<FileText className="w-3.5 h-3.5" />
						<span>Paste Tracker Text / HTML</span>
					</button>

					<button
						onClick={() => setActiveTab("bookmarklet")}
						className={`py-3 px-4 font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
							activeTab === "bookmarklet"
								? "border-blue-500 text-blue-400"
								: "border-transparent text-slate-400 hover:text-slate-200"
						}`}>
						<Bookmark className="w-3.5 h-3.5" />
						<span>1-Click LinkedIn Tool</span>
					</button>

					<button
						onClick={() => setActiveTab("manual")}
						className={`py-3 px-4 font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
							activeTab === "manual"
								? "border-blue-500 text-blue-400"
								: "border-transparent text-slate-400 hover:text-slate-200"
						}`}>
						<Plus className="w-3.5 h-3.5" />
						<span>Manual Add</span>
					</button>
				</div>

				{/* Content Body */}
				<div className="p-6">
					{/* TAB 1: Job URLs */}
					{activeTab === "urls" && (
						<div className="space-y-4">
							<div>
								<label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
									Paste LinkedIn or Career Page URLs (one per line)
								</label>
								<p className="text-xs text-slate-400 mb-2">
									The scraper extracts title, company, location, salary, and
									requirements automatically.
								</p>
								<textarea
									rows={6}
									value={urlsInput}
									onChange={(e) => setUrlsInput(e.target.value)}
									placeholder={`https://www.linkedin.com/jobs/view/4129841021
https://www.linkedin.com/jobs/view/4130192834
https://boards.greenhouse.io/company/jobs/123456`}
									className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500 leading-relaxed"
								/>
							</div>

							{scrapeError && (
								<div className="flex items-center gap-2 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
									<AlertCircle className="w-4 h-4 shrink-0" />
									<span>{scrapeError}</span>
								</div>
							)}

							<div className="flex justify-end pt-2">
								<button
									type="button"
									onClick={handleScrapeUrls}
									disabled={isScraping}
									className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50">
									{isScraping ? (
										<>
											<Loader2 className="w-4 h-4 animate-spin" />
											<span>Fetching & Extracting Details...</span>
										</>
									) : (
										<>
											<CheckCircle2 className="w-4 h-4" />
											<span>Scrape & Ingest Links</span>
										</>
									)}
								</button>
							</div>
						</div>
					)}

					{/* TAB 2: Paste Tracker Text / HTML */}
					{activeTab === "paste" && (
						<div className="space-y-4">
							<div>
								<label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
									Paste LinkedIn Saved Jobs Text or HTML
								</label>
								<p className="text-xs text-slate-400 mb-2">
									Select and copy your list from{" "}
									<a
										href="https://www.linkedin.com/my-items/saved-jobs/"
										target="_blank"
										rel="noreferrer"
										className="text-blue-400 hover:underline inline-flex items-center gap-1">
										LinkedIn Saved Jobs <ExternalLink className="w-3 h-3" />
									</a>{" "}
									and paste it here. Gemini will parse all roles into individual
									records.
								</p>
								<textarea
									rows={7}
									value={trackerText}
									onChange={(e) => setTrackerText(e.target.value)}
									placeholder="Paste your copied text or HTML from LinkedIn Saved Jobs list..."
									className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500 leading-relaxed"
								/>
							</div>

							{parseError && (
								<div className="flex items-center gap-2 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
									<AlertCircle className="w-4 h-4 shrink-0" />
									<span>{parseError}</span>
								</div>
							)}

							<div className="flex justify-end pt-2">
								<button
									type="button"
									onClick={handleParseTrackerText}
									disabled={isParsingText}
									className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50">
									{isParsingText ? (
										<>
											<Loader2 className="w-4 h-4 animate-spin" />
											<span>Parsing with Gemini AI...</span>
										</>
									) : (
										<>
											<CheckCircle2 className="w-4 h-4" />
											<span>Parse & Ingest Jobs</span>
										</>
									)}
								</button>
							</div>
						</div>
					)}

					{/* TAB 3: 1-Click Bookmarklet Tool */}
					{activeTab === "bookmarklet" && (
						<div className="space-y-4">
							<div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-900/40 text-xs text-slate-300 space-y-3">
								<div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
									<Bookmark className="w-4 h-4" />
									<span>
										How to 1-Click Copy all jobs from your LinkedIn Saved
										Tracker:
									</span>
								</div>
								<ol className="list-decimal pl-5 space-y-2 text-slate-300 leading-relaxed">
									<li>
										Open{" "}
										<a
											href="https://www.linkedin.com/my-items/saved-jobs/"
											target="_blank"
											rel="noreferrer"
											className="text-blue-400 hover:underline font-medium inline-flex items-center gap-1">
											linkedin.com/my-items/saved-jobs{" "}
											<ExternalLink className="w-3 h-3" />
										</a>{" "}
										in another tab.
									</li>
									<li>
										Copy the JavaScript code below and paste it into your
										browser's Developer Console (F12 or Ctrl+Shift+J) or save it
										as a browser Bookmark.
									</li>
									<li>
										Press Enter. It will immediately find all job links on your
										screen and copy them to your clipboard!
									</li>
									<li>
										Return to this app, click the{" "}
										<strong>Job URLs / Links</strong> tab, and paste!
									</li>
								</ol>
							</div>

							<div className="relative">
								<pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto">
									{bookmarkletCode}
								</pre>
								<button
									type="button"
									onClick={copyBookmarklet}
									className="absolute top-2 right-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer">
									{copiedBookmarklet ? (
										<>
											<Check className="w-3.5 h-3.5 text-emerald-400" />
											<span className="text-emerald-400">
												Copied to Clipboard!
											</span>
										</>
									) : (
										<>
											<Copy className="w-3.5 h-3.5" />
											<span>Copy Snippet</span>
										</>
									)}
								</button>
							</div>
						</div>
					)}

					{/* TAB 4: Manual Form */}
					{activeTab === "manual" && (
						<div className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								<div>
									<label className="block text-xs font-semibold text-slate-300 mb-1">
										Job Title *
									</label>
									<input
										type="text"
										value={manualForm.title}
										onChange={(e) =>
											setManualForm({ ...manualForm, title: e.target.value })
										}
										placeholder="e.g. Senior Frontend Engineer"
										className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
									/>
								</div>

								<div>
									<label className="block text-xs font-semibold text-slate-300 mb-1">
										Company Name *
									</label>
									<input
										type="text"
										value={manualForm.company}
										onChange={(e) =>
											setManualForm({ ...manualForm, company: e.target.value })
										}
										placeholder="e.g. Stripe, OpenAI"
										className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
								<div>
									<label className="block text-xs font-semibold text-slate-300 mb-1">
										Location
									</label>
									<input
										type="text"
										value={manualForm.location}
										onChange={(e) =>
											setManualForm({ ...manualForm, location: e.target.value })
										}
										placeholder="e.g. Remote, San Francisco"
										className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
									/>
								</div>

								<div>
									<label className="block text-xs font-semibold text-slate-300 mb-1">
										Workplace Type
									</label>
									<select
										value={manualForm.workplaceType}
										onChange={(e) =>
											setManualForm({
												...manualForm,
												workplaceType: e.target.value as WorkplaceType,
											})
										}
										className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500">
										<option value="Remote">Remote</option>
										<option value="Hybrid">Hybrid</option>
										<option value="On-site">On-site</option>
										<option value="Unknown">Unknown</option>
									</select>
								</div>

								<div>
									<label className="block text-xs font-semibold text-slate-300 mb-1">
										Salary (Optional)
									</label>
									<input
										type="text"
										value={manualForm.salaryRaw}
										onChange={(e) =>
											setManualForm({
												...manualForm,
												salaryRaw: e.target.value,
											})
										}
										placeholder="e.g. $160,000 - $185,000"
										className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
									/>
								</div>
							</div>

							<div>
								<label className="block text-xs font-semibold text-slate-300 mb-1">
									Job URL / Link
								</label>
								<input
									type="text"
									value={manualForm.url}
									onChange={(e) =>
										setManualForm({ ...manualForm, url: e.target.value })
									}
									placeholder="https://www.linkedin.com/jobs/view/..."
									className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
								/>
							</div>

							<div className="flex justify-end pt-2">
								<button
									type="button"
									onClick={handleManualAdd}
									className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition-all cursor-pointer">
									<Plus className="w-4 h-4" />
									<span>Add Job to Screener</span>
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
