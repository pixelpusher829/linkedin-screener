import assert from "node:assert/strict";
import { normalizeApplicantAnswer } from "../server/routes/applicant-answer.routes";

const normalized = normalizeApplicantAnswer(
	"**Answer**\n\n- I built a design system — it improved delivery.\n- It is accessible.",
);

assert.equal(
	normalized,
	"Answer I built a design system, it improved delivery. It is accessible.",
);
assert.equal(normalized.includes("\n"), false);
assert.equal(normalized.includes("—"), false);
assert.equal(normalized.includes("**"), false);

console.log("Applicant answer format tests passed");
