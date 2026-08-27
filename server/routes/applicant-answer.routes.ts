import express from "express";
import { GoogleGenAI } from "@google/genai";
import { isAdminSession } from "../services/auth.service";
import { fetchJobDescriptionForAnswer } from "../services/scraping.service";

export const applicantAnswerRouter = express.Router();

// Endpoint 5: Generate Applicant Answer based on Context Doc
applicantAnswerRouter.post("/generate-applicant-answer", async (req, res) => {
	try {
		const { question, contextDoc, targetJob, tone } = req.body as {
			question: string;
			contextDoc: string;
			targetJob?: any;
			tone?: "standard" | "concise" | "storytelling" | "direct";
		};

		if (!question || !question.trim()) {
			return res
				.status(400)
				.json({ error: "Application question is required." });
		}

		let ai: GoogleGenAI | null = null;
		const effectiveApiKey = process.env.GEMINI_API_KEY;
		// AI-generated answers cost the admin's Gemini quota, so only run it for an
		// authenticated admin session; everyone else gets the heuristic template below.
		if (effectiveApiKey && isAdminSession(req)) {
			try {
				ai = new GoogleGenAI({
					apiKey: effectiveApiKey as string,
					httpOptions: { headers: { "User-Agent": "aistudio-build" } },
				});
			} catch (e) {}
		}

		let toneInstruction =
			"Standard tone: Engaging, authentic, professional, and well-structured in 2-3 focused paragraphs.";
		if (tone === "concise") {
			toneInstruction =
				"Concise tone: Extremely crisp, direct, and under 120 words or 3 short impactful bullets.";
		} else if (tone === "storytelling") {
			toneInstruction =
				"In-depth STAR method (Situation, Task, Action, Result): Provide a vivid, structured story demonstrating real-world problem solving, measurable impact, and craftsmanship.";
		} else if (tone === "direct") {
			toneInstruction =
				"Direct & factual: Straight to the point, clear answers to logistics, salary, location, tech stack, or background.";
		}

		let answerTargetJob = targetJob;
		if (ai && targetJob?.url) {
			const refreshedDescription = await fetchJobDescriptionForAnswer(
				targetJob.url,
			);
			if (refreshedDescription) {
				answerTargetJob = {
					...targetJob,
					descriptionRaw: refreshedDescription,
				};
			}
		}

		if (ai) {
			try {
				const prompt = `You are writing as the job applicant (James Barnes), directly responding to a job application question or screening prompt.
You MUST write authentically in the FIRST PERSON ("I", "my experience", "at TEC...", "with Crux Digital...").

APPLICATION QUESTION / PROMPT:
"""
${question.trim()}
"""


${
	answerTargetJob
		? `TARGET ROLE & COMPANY CONTEXT:
- Role Title: ${answerTargetJob.title}
- Company: ${answerTargetJob.company}
- Job Description Excerpt: ${(answerTargetJob.descriptionRaw || "").slice(0, 1500)}
`
		: `TARGET ROLE CONTEXT: General application or screening question`
}

APPLICANT CONTEXT DOC (Ground truth for work history, skills, philosophy, achievements, and answers):
"""
${(contextDoc || "").slice(0, 18000)}
"""

TONE / FORMAT DIRECTIVE:
${toneInstruction}

STRICT GUIDELINES:
1. Ground every claim strictly in the Applicant Context Doc. Use the real companies (Technology Evaluation Centers / TEC, Crux Digital, Johannesburg Art School), real projects (Lumina Estates, Delicimo, Prospera), real frameworks (Svelte, SvelteKit, React, TypeScript, Next.js, Tailwind, GSAP), and real case studies (Design System overhaul, Legacy CRM modernization into React + shadcn/ui, AI automated image pipeline).
2. Never invent fake companies or unverifiable degrees.
3. If asked about salary, refer to the target range: $100,000 – $120,000 CAD base.
4. If asked about location / work authorization, state clearly: Canadian citizen/resident based in Montreal, QC, open to remote North American roles that hire Canadian residents without requiring US citizenship/clearance.
5. If asked about why leaving: Explain the temporary layoff due to corporate financial difficulties at previous company, pivoting towards greater craftsmanship and technical growth.
6. Return a clean, ready-to-paste answer formatted with markdown paragraphs or bullet points where appropriate. Do NOT include meta-commentary like "Here is your answer:".`;

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
						});
						if (response.text) {
							return res.json({ answer: response.text });
						}
					} catch (e) {}
				}
			} catch (aiErr: any) {
				console.warn(
					"AI generate-applicant-answer failed, using heuristic template:",
					aiErr.message,
				);
			}
		}

		// Context-grounded first-person response template
		const qLower = question.toLowerCase();
		let generatedAnswer = "";

		if (
			qLower.includes("why") ||
			qLower.includes("interest") ||
			qLower.includes("excited")
		) {
			generatedAnswer = `Throughout my 8+ years as a Senior Frontend Developer and Design Engineer, I have focused on bridging high-fidelity UI/UX design with robust, enterprise-scale engineering. What particularly excites me about ${targetJob?.company || "your team"} and the ${targetJob?.title || "role"} is the dedication to product craftsmanship and building snappy, user-centric web applications.

At Technology Evaluation Centers (TEC), I led our multi-brand frontend architecture and design system overhaul—migrating fragmented codebases into modern TypeScript, React, and Tailwind CSS while reducing client load times by 40%. I thrive in environments where engineering standards, component modularity, and micro-interactions directly elevate the end-user experience.

I am eager to bring my background in design systems, performance optimization, and autonomous delivery to accelerate ${targetJob?.company || "your product"}'s roadmap.`;
		} else if (
			qLower.includes("salary") ||
			qLower.includes("compensation") ||
			qLower.includes("rate")
		) {
			generatedAnswer = `My target base compensation for this role is $100,000 – $120,000 CAD (or equivalent USD), commensurate with the seniority, scope of responsibilities, and total benefits package. I am open to discussing the complete compensation structure based on mutual fit.`;
		} else if (
			qLower.includes("location") ||
			qLower.includes("remote") ||
			qLower.includes("relocate") ||
			qLower.includes("citizen") ||
			qLower.includes("visa")
		) {
			generatedAnswer = `I am based in Montreal, QC, Canada, and work seamlessly in fully remote North American engineering teams across Eastern and Pacific time zones. I am a Canadian citizen and authorized to work domestically in Canada as well as for US companies via Canadian entities, Employer of Record (EOR), or international contractor arrangements without requiring domestic US visa sponsorship.`;
		} else {
			generatedAnswer = `In my recent role as Senior Frontend Developer at Technology Evaluation Centers (TEC), I spearheaded key architecture modernization initiatives—including overhauling our legacy enterprise tools into modular React + TypeScript applications and building accessible, tokenized design systems.

Key highlights from my experience that directly apply:
• **Design System & Component Architecture**: Established multi-brand component libraries with strict accessibility (WCAG 2.1 AA) and automated visual regression testing.
• **Performance & Core Web Vitals**: Refactored critical user flows, eliminating runtime bottlenecks and optimizing bundle payloads to achieve sub-second LCP.
• **Autonomous Execution & Ownership**: Collaborated closely with Product and Design to ship high-impact features end-to-end in rapid, remote-first agile cycles.

I would love to bring this combination of technical rigor and product design sensibility to the ${targetJob?.title || "team"} at ${targetJob?.company || "your company"}.`;
		}

		res.json({ answer: generatedAnswer });
	} catch (error: any) {
		console.error("Error in /api/generate-applicant-answer:", error);
		res
			.status(500)
			.json({ error: error.message || "Failed to generate applicant answer" });
	}
});
