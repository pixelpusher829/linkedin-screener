import express from "express";

export const healthRouter = express.Router();

healthRouter.get("/health", (req, res) => {
	res.json({ status: "ok", timestamp: new Date().toISOString() });
});
