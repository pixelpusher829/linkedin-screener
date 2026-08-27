import express from "express";
import path from "path";
import { PORT } from "./server/config";
import { applicantAnswerRouter } from "./server/routes/applicant-answer.routes";
import { authRouter } from "./server/routes/auth.routes";
import { healthRouter } from "./server/routes/health.routes";
import { qualifyRouter } from "./server/routes/qualify.routes";
import { rubricRouter } from "./server/routes/rubric.routes";
import { scrapeRouter } from "./server/routes/scrape.routes";

export { createSignedSession } from "./server/services/auth.service";
export { evaluateJobHeuristically } from "./server/services/qualification.service";

const app = express();
export { app };

app.use(express.json({ limit: "2mb" }));

// Vercel invokes the handler without the /api prefix.
if (process.env.VERCEL) {
	app.use((req, _res, next) => {
		if (!req.url.startsWith("/api")) req.url = `/api${req.url}`;
		next();
	});
}

const requestCounts = new Map<string, { count: number; resetAt: number }>();
app.use("/api", (req, res, next) => {
	const now = Date.now();
	const key = req.ip || "unknown";
	const current = requestCounts.get(key);
	if (!current || current.resetAt <= now) {
		requestCounts.set(key, { count: 1, resetAt: now + 60_000 });
		return next();
	}
	if (current.count >= 60)
		return res
			.status(429)
			.json({ error: "Too many requests. Try again shortly." });
	current.count += 1;
	next();
});

app.use("/api", authRouter);
app.use("/api", scrapeRouter);
app.use("/api", qualifyRouter);
app.use("/api", rubricRouter);
app.use("/api", applicantAnswerRouter);
app.use("/api", healthRouter);

export async function startServer() {
	if (process.env.NODE_ENV !== "production") {
		const { createServer: createViteServer } = await import("vite");
		const vite = await createViteServer({
			server: {
				middlewareMode: true,
				watch: {
					ignored: [
						"**/app_state.json",
						"**/app_state*.json",
						"**/dist/**",
						"**/.git/**",
						"**/node_modules/**",
						"**/*.log",
					],
				},
			},
			appType: "spa",
		});
		app.use(vite.middlewares);
	} else {
		const distPath = path.join(process.cwd(), "dist");
		app.use(express.static(distPath));
		app.get("*", (req, res) => {
			res.sendFile(path.join(distPath, "index.html"));
		});
	}

	app.listen(PORT, "0.0.0.0", () => {
		console.log(`\n  ➜  Local:   http://localhost:${PORT}/`);
		console.log(`  ➜  Network: http://127.0.0.1:${PORT}/\n`);
	});
}

const isDirectRun = ["server.ts", "server.cjs"].includes(
	path.basename(process.argv[1] || ""),
);

if (isDirectRun) {
	startServer();
}

export default app;
