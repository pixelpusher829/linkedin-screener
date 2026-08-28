import React, { useState } from "react";
import {
	X,
	RefreshCw,
	ArrowDownToLine,
	ArrowUpFromLine,
	ExternalLink,
	Copy,
	Check,
	ShieldCheck,
	AlertCircle,
	HelpCircle,
	Play,
	Trash2,
	BookmarkX,
	Code2,
} from "lucide-react";
import { JobPosting } from "../../types";

interface LinkedInSyncModalProps {
	isOpen: boolean;
	onClose: () => void;
	jobs: JobPosting[];
	onImportExtractedJson: (jsonString: string) => void;
}

export const LinkedInSyncModal: React.FC<LinkedInSyncModalProps> = ({
	isOpen,
	onClose,
	jobs,
	onImportExtractedJson,
}) => {
	const [activeTab, setActiveTab] = useState<"pull" | "push" | "faq">("pull");
	const [copiedPullScript, setCopiedPullScript] = useState(false);
	const [copiedPushScript, setCopiedPushScript] = useState(false);
	const [pastedJson, setPastedJson] = useState("");
	const [importStatus, setImportStatus] = useState<string | null>(null);

	if (!isOpen) return null;

	const prunedJobs = jobs.filter(
		(j) => j.analysis?.verdict === "REMOVE" || j.isSelectedForDeletion,
	);

	// Script 1: Universal PULL all saved jobs from LinkedIn
	const pullBookmarkletScript = `(() => {
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
	const location = locEl ? clean(locEl.innerText || locEl.textContent) : '';
	const headerText = clean(c.innerText || c.textContent);
	const workplaceBadge = Array.from(c.querySelectorAll('*')).find(el => /^(remote|hybrid)$/i.test(clean(el.innerText || el.textContent)));
	const workplaceLabel = workplaceBadge ? clean(workplaceBadge.innerText || workplaceBadge.textContent) : '';
	const workplaceText = (headerText + ' ' + workplaceLabel).toLowerCase();

	const isRemote = workplaceText.includes('remote');
	const isHybrid = !isRemote && workplaceText.includes('hybrid');
	const normalizedLocation = location || 'Unspecified';

    extracted.push({
      url: 'https://www.linkedin.com/jobs/view/' + jobId + '/',
      title: title || 'LinkedIn Software Role',
      company: company,
	location: isRemote && !/remote/i.test(normalizedLocation) ? normalizedLocation + ' (Remote)' : normalizedLocation,
	headerRaw: headerText,
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
          workplaceType: title.toLowerCase().includes('remote') ? 'Remote' : 'Unknown',
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

	// Script 2: PUSH unsave/remove pruned jobs from LinkedIn
	const prunedUrlsOrIds = prunedJobs.map((j) => {
		const match = j.url.match(/(\d{8,14})/);
		return match ? match[1] : j.title;
	});

	const pushBookmarkletScript = `(() => {
  const targetIds = ${JSON.stringify(prunedUrlsOrIds)};
  let removedCount = 0;
  
  console.log('Searching for ' + targetIds.length + ' pruned jobs to unsave...');
  
  const cardSelectors = ['.entity-result', '.job-card-container', '.jobs-search-results-list__list-item', '.reusable-search__result-container', 'li'];
  const cards = document.querySelectorAll(cardSelectors.join(', '));
  
  cards.forEach(card => {
    const text = card.innerHTML;
    const isMatch = targetIds.some(id => id && text.includes(id));
    if (isMatch) {
      card.style.border = '2px solid #ef4444';
      card.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      card.style.borderRadius = '8px';
      
      const saveBtn = card.querySelector('button[aria-label*="Save"], button[aria-label*="Unsave"], button[aria-label*="saved"], .artdeco-dropdown__trigger');
      if (saveBtn) {
        saveBtn.click();
        removedCount++;
      }
    }
  });

  alert('🎯 Targeted ' + removedCount + ' low-fit listings on LinkedIn matching your discard list and clicked unsave/highlighted them in red!');
})();`;

	const handleCopyPull = () => {
		navigator.clipboard.writeText(pullBookmarkletScript);
		setCopiedPullScript(true);
		setTimeout(() => setCopiedPullScript(false), 2500);
	};

	const handleCopyPush = () => {
		navigator.clipboard.writeText(pushBookmarkletScript);
		setCopiedPushScript(true);
		setTimeout(() => setCopiedPushScript(false), 2500);
	};

	const handleProcessPasted = () => {
		const trimmed = pastedJson.trim();
		if (!trimmed) return;
		try {
			onImportExtractedJson(trimmed);
			setImportStatus("Successfully imported jobs!");
			setTimeout(() => {
				setImportStatus(null);
				setPastedJson("");
				onClose();
			}, 1000);
		} catch (e: any) {
			setImportStatus(
				"Error parsing data. Make sure it is valid JSON or URLs.",
			);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
			<div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-8 text-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
							<RefreshCw className="w-5 h-5" />
						</div>
						<div>
							<h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
								<span>LinkedIn 2-Way Sync Assistant</span>
								<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
									Pull & Push
								</span>
							</h2>
							<p className="text-xs text-slate-400">
								Sync saved jobs from LinkedIn into this screener, and push back
								bulk unsaves for pruned jobs
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Tab Navigation */}
				<div className="px-6 py-2 bg-slate-950 border-b border-slate-800 flex items-center gap-2 text-xs">
					<button
						onClick={() => setActiveTab("pull")}
						className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
							activeTab === "pull"
								? "bg-blue-600 text-white shadow-sm"
								: "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
						}`}>
						<ArrowDownToLine className="w-3.5 h-3.5" />
						<span>1. Pull Saved Jobs (LinkedIn → App)</span>
					</button>

					<button
						onClick={() => setActiveTab("push")}
						className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
							activeTab === "push"
								? "bg-rose-600 text-white shadow-sm"
								: "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
						}`}>
						<ArrowUpFromLine className="w-3.5 h-3.5" />
						<span>2. Push Pruning / Unsave ({prunedJobs.length} Jobs)</span>
					</button>

					<button
						onClick={() => setActiveTab("faq")}
						className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
							activeTab === "faq"
								? "bg-slate-800 text-slate-200"
								: "text-slate-500 hover:text-slate-300"
						}`}>
						<HelpCircle className="w-3.5 h-3.5" />
						<span>How Sync Works</span>
					</button>
				</div>

				{/* Tab Content Body */}
				<div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs leading-relaxed bg-slate-950/40">
					{/* TAB 1: PULL JOBS */}
					{activeTab === "pull" && (
						<div className="space-y-4 animate-in fade-in duration-150">
							<div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-900/30 text-blue-200 space-y-1">
								<div className="font-bold text-blue-300 flex items-center gap-1.5">
									<ArrowDownToLine className="w-4 h-4 text-blue-400" /> Pull
									Your Entire Saved Jobs List from LinkedIn
								</div>
								<p className="text-slate-300">
									Because LinkedIn restricts 3rd-party OAuth from reading
									private consumer saved jobs, you can use this 1-click
									extractor directly on your logged-in LinkedIn tab!
								</p>
							</div>

							{/* Step by step */}
							<div className="space-y-3">
								<div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
									<span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
										1
									</span>
									<div className="flex-1 space-y-1">
										<div className="font-semibold text-slate-200">
											Open your LinkedIn Saved Jobs page
										</div>
										<p className="text-slate-400">
											Navigate to your saved items list in your browser:
										</p>
										<a
											href="https://www.linkedin.com/my-items/saved-jobs/"
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-1 text-blue-400 hover:underline font-semibold">
											<span>linkedin.com/my-items/saved-jobs</span>
											<ExternalLink className="w-3 h-3" />
										</a>
									</div>
								</div>

								<div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
									<span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
										2
									</span>
									<div className="flex-1 space-y-2">
										<div className="font-semibold text-slate-200">
											Copy & run the 1-Click Extractor Snippet in your browser
											console
										</div>
										<p className="text-slate-400">
											Press{" "}
											<kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700 text-[10px]">
												F12
											</kbd>{" "}
											(or Right Click → Inspect → Console), paste this snippet,
											and press Enter:
										</p>
										<div className="flex items-center gap-2">
											<button
												onClick={handleCopyPull}
												className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer">
												{copiedPullScript ? (
													<>
														<Check className="w-3.5 h-3.5 text-emerald-300" />
														<span>Extractor Code Copied!</span>
													</>
												) : (
													<>
														<Copy className="w-3.5 h-3.5" />
														<span>Copy 1-Click Pull Script</span>
													</>
												)}
											</button>
										</div>
									</div>
								</div>

								<div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
									<span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
										3
									</span>
									<div className="flex-1 space-y-2">
										<div className="font-semibold text-slate-200">
											Paste the extracted JSON below to sync into your tracker:
										</div>
										<textarea
											value={pastedJson}
											onChange={(e) => setPastedJson(e.target.value)}
											placeholder='Paste extracted JSON here (e.g. [{"title": "Senior Engineer", "url": "https://linkedin.com/jobs/view/..."}])...'
											className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono text-[11px] h-24 focus:outline-none focus:border-blue-500 resize-none"
										/>
										<div className="flex items-center justify-between">
											<button
												onClick={handleProcessPasted}
												disabled={!pastedJson.trim()}
												className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
												<ArrowDownToLine className="w-4 h-4" />
												<span>Sync Ingested Jobs Now</span>
											</button>

											{importStatus && (
												<span className="text-emerald-400 font-semibold">
													{importStatus}
												</span>
											)}
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* TAB 2: PUSH PRUNED JOBS (UNSAVE) */}
					{activeTab === "push" && (
						<div className="space-y-4 animate-in fade-in duration-150">
							<div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-200 space-y-1">
								<div className="font-bold text-rose-300 flex items-center gap-1.5">
									<BookmarkX className="w-4 h-4 text-rose-400" /> Push Unsave /
									Remove Pruned Jobs Back to LinkedIn
								</div>
								<p className="text-slate-300">
									You currently have{" "}
									<strong className="text-rose-300">
										{prunedJobs.length} jobs
									</strong>{" "}
									marked for pruning. Clean up your LinkedIn saved list in bulk
									with 1 click!
								</p>
							</div>

							{prunedJobs.length === 0 ? (
								<div className="p-6 text-center border border-slate-800 rounded-xl text-slate-400">
									<Check className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
									<p className="font-medium text-slate-300">
										No jobs are currently marked for pruning.
									</p>
									<p className="text-[11px] text-slate-500 mt-1">
										Run Bulk Qualify or check "Mark for Pruning" on low-fit jobs
										first.
									</p>
								</div>
							) : (
								<div className="space-y-3">
									{/* Step 1 */}
									<div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
										<div className="font-semibold text-slate-200 flex items-center justify-between">
											<span>
												Method A: Automated 1-Click LinkedIn Unsaver Script
											</span>
											<span className="text-[11px] text-slate-400">
												{prunedJobs.length} IDs loaded
											</span>
										</div>
										<p className="text-slate-400">
											Copy this helper script and paste it into your browser
											console while on{" "}
											<a
												href="https://www.linkedin.com/my-items/saved-jobs/"
												target="_blank"
												rel="noreferrer"
												className="text-blue-400 hover:underline">
												linkedin.com/my-items/saved-jobs/
											</a>
											. It will locate and unsave all {prunedJobs.length} pruned
											listings automatically:
										</p>
										<button
											onClick={handleCopyPush}
											className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/25 transition-all cursor-pointer">
											{copiedPushScript ? (
												<>
													<Check className="w-4 h-4 text-white" />
													<span>Push Unsaver Script Copied!</span>
												</>
											) : (
												<>
													<Copy className="w-4 h-4" />
													<span>
														Copy 1-Click Unsave Script ({prunedJobs.length}{" "}
														Targets)
													</span>
												</>
											)}
										</button>
									</div>

									{/* Method B: Direct Links */}
									<div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
										<div className="font-semibold text-slate-200">
											Method B: Individual Direct Unsave Links
										</div>
										<p className="text-slate-400">
											Or quickly click through to view & unsave each discarded
											role on LinkedIn:
										</p>
										<div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
											{prunedJobs.map((j) => (
												<div
													key={j.id}
													className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
													<div className="truncate flex-1 pr-2">
														<span className="font-bold text-slate-300">
															{j.company}
														</span>
														: <span className="text-slate-400">{j.title}</span>
													</div>
													{j.url && (
														<a
															href={j.url}
															target="_blank"
															rel="noreferrer"
															className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 flex items-center gap-1 shrink-0">
															<span>Open & Unsave</span>
															<ExternalLink className="w-3 h-3" />
														</a>
													)}
												</div>
											))}
										</div>
									</div>
								</div>
							)}
						</div>
					)}

					{/* TAB 3: HOW IT WORKS / FAQ */}
					{activeTab === "faq" && (
						<div className="space-y-3.5 animate-in fade-in duration-150 text-slate-300">
							<div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
								<h4 className="font-bold text-slate-100 flex items-center gap-1.5">
									<ShieldCheck className="w-4 h-4 text-emerald-400" />
									Why doesn't LinkedIn offer a direct background OAuth sync?
								</h4>
								<p className="text-slate-400">
									LinkedIn's official public developer APIs strictly restrict
									consumer data endpoints like private "Saved Jobs" and personal
									search history. They only provide enterprise APIs (Recruiter &
									Talent Solutions) which require enterprise licensing and do
									not give write access to personal saved bookmarks.
								</p>
							</div>

							<div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
								<h4 className="font-bold text-slate-100 flex items-center gap-1.5">
									<Code2 className="w-4 h-4 text-blue-400" />
									How our 2-Way Sync Engine bridges the gap:
								</h4>
								<ul className="list-disc pl-4 space-y-1.5 text-slate-400">
									<li>
										<strong className="text-slate-200">1-Click Pull:</strong>{" "}
										Copies your full list of saved jobs directly from your
										active LinkedIn tab into your qualifier in seconds.
									</li>
									<li>
										<strong className="text-slate-200">
											Intelligent Qualification:
										</strong>{" "}
										Evaluates every role against James Barnes criteria, your
										custom dealbreakers, and candidate context doc.
									</li>
									<li>
										<strong className="text-slate-200">
											1-Click Push Pruning:
										</strong>{" "}
										Takes all low-fit / dealbreaker jobs identified by the AI
										and automatically un-saves/removes them from your LinkedIn
										bookmarks.
									</li>
								</ul>
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs text-slate-400">
					<span>
						Safe, direct browser-level sync with zero credentials exposed
					</span>
					<button
						onClick={onClose}
						className="px-3.5 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer font-medium">
						Done
					</button>
				</div>
			</div>
		</div>
	);
};
