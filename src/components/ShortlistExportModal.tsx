import React, { useState } from "react";
import { X, Download, Copy, Check, FileSpreadsheet, FileCode, FileText } from "lucide-react";
import { JobPosting } from "../types";

interface ShortlistExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: JobPosting[];
}

export const ShortlistExportModal: React.FC<ShortlistExportModalProps> = ({
  isOpen,
  onClose,
  jobs,
}) => {
  const [format, setFormat] = useState<"csv" | "json" | "markdown">("csv");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const qualifiedJobs = jobs.filter((j) => j.analysis?.verdict !== "REMOVE" && !j.isSelectedForDeletion);

  const generateCSV = () => {
    const headers = ["Title", "Company", "Location", "Workplace Type", "Salary", "Match Score", "Verdict", "URL", "Summary"];
    const rows = qualifiedJobs.map((j) => [
      `"${(j.title || "").replace(/"/g, '""')}"`,
      `"${(j.company || "").replace(/"/g, '""')}"`,
      `"${(j.location || "").replace(/"/g, '""')}"`,
      `"${j.workplaceType || ""}"`,
      `"${(j.salaryRaw || "").replace(/"/g, '""')}"`,
      j.analysis?.score || 0,
      `"${j.analysis?.verdict || ""}"`,
      `"${(j.url || "").replace(/"/g, '""')}"`,
      `"${(j.analysis?.oneSentenceSummary || "").replace(/"/g, '""')}"`,
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  };

  const generateJSON = () => {
    return JSON.stringify(qualifiedJobs, null, 2);
  };

  const generateMarkdown = () => {
    let md = `# LinkedIn Qualified Shortlist (${qualifiedJobs.length} Roles)\n\n`;
    md += `| Score | Title | Company | Location | Salary | Link |\n`;
    md += `|---|---|---|---|---|---|\n`;
    qualifiedJobs.forEach((j) => {
      md += `| **${j.analysis?.score || 0}%** | ${j.title} | ${j.company} | ${j.location} (${j.workplaceType}) | ${j.salaryRaw || "N/A"} | [Apply Link](${j.url}) |\n`;
    });
    return md;
  };

  const getContent = () => {
    if (format === "csv") return generateCSV();
    if (format === "json") return generateJSON();
    return generateMarkdown();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const content = getContent();
    const mimeTypes = {
      csv: "text/csv;charset=utf-8;",
      json: "application/json;charset=utf-8;",
      markdown: "text/markdown;charset=utf-8;",
    };
    const extensions = { csv: "csv", json: "json", markdown: "md" };

    const blob = new Blob([content], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `job-shortlist-${new Date().toISOString().slice(0, 10)}.${extensions[format]}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-8 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Export Shortlist</h2>
              <p className="text-xs text-slate-400">
                Export your {qualifiedJobs.length} qualified opportunities for Notion, Sheets, or tracking
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Format selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setFormat("csv")}
              className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                format === "csv"
                  ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" /> CSV (Excel / Sheets)
            </button>

            <button
              onClick={() => setFormat("markdown")}
              className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                format === "markdown"
                  ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-4 h-4" /> Markdown (Notion)
            </button>

            <button
              onClick={() => setFormat("json")}
              className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                format === "json"
                  ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileCode className="w-4 h-4" /> JSON
            </button>
          </div>

          <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 max-h-56 overflow-y-auto leading-relaxed whitespace-pre-wrap">
            {getContent()}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Data</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download File</span>
          </button>
        </div>
      </div>
    </div>
  );
};
