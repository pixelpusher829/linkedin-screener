import { GoogleGenAI } from "@google/genai";

// Lazy/Safe Gemini AI client
export function getGeminiClient(): GoogleGenAI {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error("GEMINI_API_KEY environment variable is missing.");
	}
	return new GoogleGenAI({
		apiKey,
		httpOptions: {
			headers: {
				"User-Agent": "aistudio-build",
			},
		},
	});
}
