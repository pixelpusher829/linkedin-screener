import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { isAdminSession } from "../services/auth.service";

export const rubricRouter = express.Router();

// Endpoint: Sync / Extract Screening Rubric from Context Document
rubricRouter.post("/sync-rubric-from-context", async (req, res) => {
	try {
		const { contextDoc } = req.body;
		if (!contextDoc || !contextDoc.trim()) {
			return res
				.status(400)
				.json({ error: "Context document text is required" });
		}

		let ai: GoogleGenAI | null = null;
		const effectiveApiKey = process.env.GEMINI_API_KEY;
		// AI extraction costs the admin's Gemini quota, so only run it for an
		// authenticated admin session; everyone else gets the heuristic parser below.
		if (effectiveApiKey && isAdminSession(req)) {
			try {
				ai = new GoogleGenAI({
					apiKey: effectiveApiKey as string,
					httpOptions: { headers: { "User-Agent": "aistudio-build" } },
				});
			} catch (e) {}
		}

		if (ai) {
			try {
				const prompt = `You are an elite Executive Career Strategist and Technical Recruiter.
Analyze the following Candidate Context Document (which includes complete work history, skills, philosophy, salary targets, work authorization, location, and achievements).
Extract a complete, highly structured, tailored Screening Rubric JSON matching the candidate's exact background and market criteria.

APPLICANT CONTEXT DOC:
"""
${contextDoc.slice(0, 18000)}
"""

REQUIREMENTS FOR EXTRACTION:
1. "fullName": Candidate's full name (e.g. "James Barnes").
2. "targetJobTitles": Array of 4-6 realistic, high-impact job titles including seniority where applicable (e.g., ["Senior Frontend Developer", "Senior Design Engineer", "Senior Frontend Architect", "Lead Frontend Developer", "Senior UI/UX Engineer"]).
3. "seniorityLevel": One of ["Senior", "Lead / Staff", "Mid-Level", "Senior / Staff", "Engineering Manager"].
4. "yearsOfExperience": Integer total professional years of experience.
5. "techStackRequired": Array of 5-8 primary core technologies the candidate specializes in (e.g. ["React", "TypeScript", "Next.js", "Tailwind CSS", "Design Systems", "Svelte"]).
6. "techStackNiceToHave": Array of secondary technologies (e.g. ["GSAP", "Astro", "Node.js", "Zustand", "TanStack Query", "WCAG Accessibility"]).
7. "locationPreferences":
   - "homeLocation": City and region of the candidate's primary residence (e.g. "Montreal, QC, Canada").
   - "allowHomeOnsiteHybrid": boolean (true: on-site/hybrid is fine in home city).
   - "remoteOnly": boolean (true: all other locations outside home city must be 100% remote).
   - "allowedRemoteRegions": Array of remote hiring jurisdictions (e.g. ["Canada (Remote)", "US (Remote for Canadian Residents)", "North America (Remote)", "Worldwide Remote"]).
   - "requiresSponsorship": boolean (false if Canadian citizen not needing domestic sponsorship).
8. "minSalary": Number representing the absolute minimum base salary floor (e.g. 100000).
9. "salaryCurrency": "CAD" or "USD".
10. "dealbreakers": Array of 5-8 SHORT, CONCISE, PUNCHY disqualification phrases (MAX 4-6 WORDS EACH!).
11. "preferredIndustries": Array of preferred industry verticals.
12. "customEvaluationPrompt": A crisp 2-sentence strategic evaluation guidance prompt.
13. "syncSummary": A 2-sentence summary of what was extracted from the doc.`;

				const candidateModels = [
					"gemini-2.5-flash",
					"gemini-2.0-flash",
					"gemini-1.5-flash",
					"gemini-2.5-pro",
				];
				for (const modelName of candidateModels) {
					try {
						const response = await ai.models.generateContent({
							model: modelName,
							contents: prompt,
							config: {
								responseMimeType: "application/json",
								responseSchema: {
									type: Type.OBJECT,
									properties: {
										fullName: { type: Type.STRING },
										targetJobTitles: {
											type: Type.ARRAY,
											items: { type: Type.STRING },
										},
										seniorityLevel: { type: Type.STRING },
										yearsOfExperience: { type: Type.INTEGER },
										techStackRequired: {
											type: Type.ARRAY,
											items: { type: Type.STRING },
										},
										techStackNiceToHave: {
											type: Type.ARRAY,
											items: { type: Type.STRING },
										},
										locationPreferences: {
											type: Type.OBJECT,
											properties: {
												homeLocation: { type: Type.STRING },
												allowHomeOnsiteHybrid: { type: Type.BOOLEAN },
												remoteOnly: { type: Type.BOOLEAN },
												allowedRemoteRegions: {
													type: Type.ARRAY,
													items: { type: Type.STRING },
												},
												requiresSponsorship: { type: Type.BOOLEAN },
											},
											required: [
												"homeLocation",
												"remoteOnly",
												"requiresSponsorship",
											],
										},
										minSalary: { type: Type.INTEGER },
										salaryCurrency: { type: Type.STRING, enum: ["CAD", "USD"] },
										dealbreakers: {
											type: Type.ARRAY,
											items: { type: Type.STRING },
										},
										preferredIndustries: {
											type: Type.ARRAY,
											items: { type: Type.STRING },
										},
										customEvaluationPrompt: { type: Type.STRING },
										syncSummary: { type: Type.STRING },
									},
									required: [
										"fullName",
										"targetJobTitles",
										"seniorityLevel",
										"yearsOfExperience",
										"techStackRequired",
										"techStackNiceToHave",
										"locationPreferences",
										"minSalary",
										"dealbreakers",
										"preferredIndustries",
										"customEvaluationPrompt",
										"syncSummary",
									],
								},
							},
						});

						const parsed = JSON.parse(response.text || "{}");
						const { syncSummary, ...criteria } = parsed;
						return res.json({ criteria, syncSummary });
					} catch (e) {}
				}
			} catch (aiErr: any) {
				console.warn(
					"AI sync-rubric-from-context failed, using heuristic extraction:",
					aiErr.message,
				);
			}
		}

		// Heuristic Context Doc Parser (no AI key configured / AI extraction failed).
		// Best-effort regex extraction directly from the pasted doc — never fabricates
		// a persona, so every user gets their own values back (or none, if not found).
		const doc = String(contextDoc);
		const matchField = (label: string) => {
			const re = new RegExp(`\\*{0,2}${label}\\*{0,2}\\s*:?\\s*([^\\n]+)`, "i");
			const m = doc.match(re);
			return m ? m[1].replace(/[*_`]/g, "").trim() : undefined;
		};
		const splitList = (value?: string) =>
			value
				? value
						.split(/[,;]/)
						.map((s) => s.trim())
						.filter(Boolean)
				: [];
		const extractBulletSection = (heading: string) => {
			const re = new RegExp(
				`#{1,4}\\s*${heading}[^\\n]*\\n((?:\\s*[-*]\\s*.+\\n?)+)`,
				"i",
			);
			const m = doc.match(re);
			if (!m) return [] as string[];
			return m[1]
				.split("\n")
				.map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
				.filter(Boolean);
		};

		const nameMatch = matchField("Name");
		const locationMatch = matchField("Location");
		const yearsMatch = doc.match(/(\d+)\+?\s*years?/i);
		const salaryMatch = doc.match(/\$\s?(\d{2,3}(?:,\d{3})|\d{5,6})/);
		const targetRolesMatch = matchField("Target Roles?");
		const skillsMatch = matchField("Core Skills|Skills");
		const dealbreakerBullets = extractBulletSection("Dealbreakers?");
		const preferredWorkBullets = extractBulletSection(
			"Preferred Work|Preferred Industries?",
		);

		const criteria: Record<string, any> = {};
		if (nameMatch) criteria.fullName = nameMatch;
		if (targetRolesMatch)
			criteria.targetJobTitles = splitList(targetRolesMatch);
		if (yearsMatch) criteria.yearsOfExperience = Number(yearsMatch[1]);
		if (skillsMatch) criteria.techStackRequired = splitList(skillsMatch);
		if (locationMatch) {
			criteria.locationPreferences = { homeLocation: locationMatch };
		}
		if (salaryMatch) {
			criteria.minSalary = Number(salaryMatch[1].replace(/,/g, ""));
		}
		if (dealbreakerBullets.length > 0) {
			criteria.dealbreakers = dealbreakerBullets;
		}
		if (preferredWorkBullets.length > 0) {
			criteria.preferredIndustries = preferredWorkBullets;
		}

		const extractedFields = Object.keys(criteria);
		const syncSummary =
			extractedFields.length > 0
				? `Heuristic extraction (no AI key configured) found: ${extractedFields.join(", ")}. Review and fill in any remaining fields manually.`
				: "No AI key configured and no recognizable fields found in the document. Please fill in the rubric fields manually.";
		res.json({ criteria, syncSummary });
	} catch (error: any) {
		console.error("Error in /api/sync-rubric-from-context:", error);
		res.status(500).json({
			error: error.message || "Failed to sync rubric from context doc",
		});
	}
});
