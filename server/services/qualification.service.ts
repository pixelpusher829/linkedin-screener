// Helper: Clean raw concatenated LinkedIn strings
export function cleanLinkedInJobMeta(
	rawTitle: string,
	rawCompany: string,
	rawLocation: string,
	rawWorkplaceType: string,
) {
	let title = rawTitle || "Software Opportunity";
	let company = rawCompany || "Hiring Company";
	let location = rawLocation || "Remote / Unspecified";
	let workplaceType = rawWorkplaceType || "Unknown";

	// If title has metadata like "Senior Frontend Engineer Rush Street Interactive · Canada (Remote)Reposted 1w ago"
	if (
		title.includes("·") ||
		title.includes("Posted") ||
		title.includes("Reposted") ||
		title.includes("Promoted")
	) {
		const dotParts = title.split("·");
		if (dotParts.length >= 2) {
			const leftPart = dotParts[0].trim();
			const rightPart = dotParts.slice(1).join("·").trim();

			// Clean right part: remove "Posted ... ago", "Reposted ... ago", "Promoted", etc.
			const locMatch = rightPart
				.replace(/(?:Re)?posted\s+[^·\n]+/gi, "")
				.replace(/Promoted/gi, "")
				.trim();
			if (locMatch) {
				location = locMatch;
				if (locMatch.toLowerCase().includes("remote")) workplaceType = "Remote";
				else if (locMatch.toLowerCase().includes("hybrid"))
					workplaceType = "Hybrid";
				else if (
					locMatch.toLowerCase().includes("on-site") ||
					locMatch.toLowerCase().includes("onsite")
				)
					workplaceType = "On-site";
			}

			if (
				company === "LinkedIn Company" ||
				company === "Hiring Company" ||
				!company
			) {
				const titleRegex =
					/^(.*?(?:Engineer|Developer|Architect|Designer|Manager|Lead|Specialist|Consultant|Programmer|VP|Director))\s*(.*?)$/i;
				const match = leftPart.match(titleRegex);
				if (match && match[1] && match[2] && match[2].length > 1) {
					title = match[1].trim();
					company = match[2].trim();
				} else {
					title = leftPart;
				}
			} else {
				title = leftPart;
			}
		} else {
			title = title
				.replace(/(?:Re)?posted\s+[^·\n]+/gi, "")
				.replace(/Promoted/gi, "")
				.trim();
		}
	}

	return { title, company, location, workplaceType };
}

// Deterministic, Comprehensive Local Heuristic Qualification Engine
export function getScoreBands(criteria: any) {
	const scoreBands = criteria.weighting?.scoreBands || {};
	const pruneBelow = Math.max(
		0,
		Math.min(99, Number(scoreBands.pruneBelow ?? 55)),
	);
	const keepAt = Math.max(
		pruneBelow + 1,
		Math.min(
			100,
			Number(
				scoreBands.keepAt ??
					criteria.weighting?.scoreWeights?.strongKeepThreshold ??
					78,
			),
		),
	);
	return { pruneBelow, keepAt };
}

export function evaluateJobHeuristically(
	job: any,
	criteria: any,
	contextDoc?: string,
) {
	const descriptionText = job.descriptionRaw || job.descriptionSummary || "";
	const fullText =
		`${job.title} ${job.company} ${job.location} ${job.workplaceType} ${job.headerRaw || ""} ${job.salaryRaw || ""} ${descriptionText}`.toLowerCase();
	const titleLower = (job.title || "").toLowerCase();
	const locLower = (job.location || "").toLowerCase();
	const workplaceLower = (job.workplaceType || "").toLowerCase();
	const homeLoc = (
		criteria.locationPreferences?.homeLocation || "Montreal, QC"
	).toLowerCase();
	const homeCity = homeLoc.split(",")[0].trim().toLowerCase();

	// Start conservatively: a job must earn its way into the shortlist. This avoids
	// generic software-engineering roles becoming matches through keyword overlap.
	const weighting = criteria.weighting || {};
	const scoreBands = getScoreBands(criteria);

	const weights = {
		base: 30,
		remote: 0,
		canada: 0,
		usRemote: 0,
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
		...(weighting.scoreWeights || {}),
	};
	let score = weights.base;
	const scoreBreakdown: { label: string; points: number }[] = [];
	const addScore = (label: string, points: number) => {
		score += points;
		if (points !== 0) scoreBreakdown.push({ label, points });
	};
	const keyPros: string[] = [];
	const keyCons: string[] = [];
	const dealbreakerTriggers: string[] = [];
	const matchedSkills: string[] = [];
	const missingSkills: string[] = [];
	// Only treat a hardcoded red-flag phrase as an actual dealbreaker (and cap the
	// score) if the user has opted into that category themselves; otherwise it's
	// just informational so it doesn't silently override their scorecard weights.
	const configuredDealbreakers = (criteria.dealbreakers || []).map(
		(d: string) => d.toLowerCase(),
	);
	const hasDealbreaker = (...keywords: string[]) =>
		configuredDealbreakers.some((d: string) =>
			keywords.some((k) => d.includes(k)),
		);

	// 1. Role alignment — reward a job title matching one of the user's own
	// target job titles. Title weights are fully user-configurable (see the
	// "Target Job Titles" rubric section); there is no hardcoded title bucketing.
	const targetTitles: string[] = criteria.targetJobTitles || [];
	let titleMatched = false;
	for (const t of targetTitles) {
		const tWords = t
			.toLowerCase()
			.split(/\s+/)
			.filter((w: string) => w.length > 2);
		const matchingWords = tWords.filter((w: string) => titleLower.includes(w));
		if (
			matchingWords.length >= 2 ||
			(tWords.length === 1 && matchingWords.length === 1)
		) {
			titleMatched = true;
			addScore(`Title: ${t}`, weighting.titleWeights?.[t] ?? 10);
			keyPros.push(`High role title alignment with "${t}"`);
			break;
		}
	}
	if (!titleMatched && targetTitles.length > 0) {
		keyCons.push("Job title doesn't match any of your target job titles");
	}

	const isSeniorTitle =
		titleLower.includes("senior") || titleLower.includes("sr.");
	const isLeadOrStaffTitle =
		titleLower.includes("lead") ||
		titleLower.includes("staff") ||
		titleLower.includes("principal") ||
		titleLower.includes("architect");
	const isMidTitle =
		titleLower.includes("mid-level") ||
		titleLower.includes("mid level") ||
		titleLower.includes("intermediate") ||
		titleLower.includes("level 2") ||
		titleLower.includes(" ii");
	const isJuniorTitle =
		titleLower.includes("junior") ||
		titleLower.includes("intern") ||
		titleLower.includes("entry level") ||
		titleLower.includes("jr.");

	let experienceFit:
		| "Matches"
		| "Slight Stretch"
		| "Overqualified"
		| "Underqualified" = "Matches";
	if (isMidTitle) {
		addScore("Seniority: mid-level", weights.midLevel);
		keyPros.push("Mid-level scope matches the preferred seniority band");
	} else if (isSeniorTitle) {
		addScore("Seniority: senior", weights.senior);
		keyPros.push("Seniority level matches target profile");
		experienceFit = "Matches";
	} else if (isJuniorTitle) {
		addScore("Seniority: junior", weights.junior);
		keyCons.push("Junior / entry-level role below target seniority");
		experienceFit = "Overqualified";
		if (
			criteria.dealbreakers?.some(
				(d: string) =>
					d.toLowerCase().includes("junior") ||
					d.toLowerCase().includes("intern"),
			)
		) {
			dealbreakerTriggers.push(
				"Junior / Internship position below seniority target",
			);
		}
	} else if (isLeadOrStaffTitle) {
		addScore("Seniority: lead/staff", weights.leadStaff);
		keyCons.push(
			"Lead/staff scope may be more architecture or management-heavy than the preferred band",
		);
		experienceFit = "Slight Stretch";
	} else {
		addScore("Seniority: unspecified", weights.unspecifiedSeniority);
		keyPros.push(
			"Unspecified seniority is a preferred opportunity to assess scope directly",
		);
	}

	// 2. Location & Remote Assessment (CRITICAL)
	let locationFit:
		| "Matches Remote/Location"
		| "Location Mismatch"
		| "Unspecified" = "Unspecified";
	const isHomeLocation =
		locLower.includes(homeCity) || (homeLoc && locLower.includes(homeLoc));
	const isRemote =
		workplaceLower.includes("remote") ||
		locLower.includes("remote") ||
		(job.headerRaw || "").toLowerCase().includes("remote");
	const isHybrid =
		!isRemote &&
		(workplaceLower.includes("hybrid") ||
			locLower.includes("hybrid") ||
			(job.headerRaw || "").toLowerCase().includes("hybrid"));
	const isOnSite =
		!isRemote &&
		!isHybrid &&
		(workplaceLower.includes("on-site") ||
			workplaceLower.includes("onsite") ||
			workplaceLower.includes("in-person") ||
			fullText.includes(" on-site") ||
			fullText.includes(" onsite") ||
			fullText.includes(" in-person"));

	const locationWeights = weighting.locationWeights || {};
	const workTypeWeights = weighting.workTypeWeights || {};
	const matchedLocation = Object.keys(locationWeights).find((location) =>
		locLower.includes(location.toLowerCase()),
	);
	const isContract =
		fullText.includes("contract") ||
		fullText.includes("1099") ||
		fullText.includes("corp-to-corp");

	if (isHomeLocation) {
		addScore("Location: home area", weights.homeLocation);
		keyPros.push(
			`Located in home metropolitan area (${criteria.locationPreferences?.homeLocation || "Montreal, QC"})`,
		);
		locationFit = "Matches Remote/Location";
	} else if (isRemote) {
		addScore("Work type: remote", workTypeWeights.Remote ?? weights.remote);
		keyPros.push("100% Remote flexibility matching remote preference");
		locationFit = "Matches Remote/Location";

		if (
			locLower.includes("canada") ||
			locLower.includes("on (remote)") ||
			locLower.includes("qc (remote)") ||
			locLower.includes("bc (remote)") ||
			locLower.includes("ottawa") ||
			locLower.includes("toronto") ||
			locLower.includes("waterloo")
		) {
			addScore(
				"Location: Canada",
				locationWeights[matchedLocation || "Canada"] ??
					locationWeights["Canada Remote"] ??
					weights.canada,
			);
			keyPros.push("Direct Canadian domestic hiring jurisdiction");
		} else if (
			locLower.includes("united states") ||
			locLower.includes("usa") ||
			locLower.includes("us (remote)")
		) {
			addScore(
				"Location: United States",
				locationWeights[matchedLocation || "United States"] ??
					locationWeights["US Remote (EOR/Contract)"] ??
					weights.usRemote,
			);
			keyPros.push(
				"US-based remote role (accessible via Canadian contractor/EOR or international remote)",
			);
		}
	} else if (isHybrid || isOnSite) {
		locationFit = "Location Mismatch";
		dealbreakerTriggers.push(
			`Mandatory in-person / hybrid attendance outside home metro (${job.location})`,
		);
		keyCons.push(
			`Requires on-site/hybrid attendance in ${job.location}, violating 100% remote requirement outside home city.`,
		);
		addScore(
			"Location: non-local in-person dealbreaker",
			weights.nonLocalOnsite,
		);
	}

	if (
		matchedLocation &&
		isRemote &&
		!locLower.includes("canada") &&
		!locLower.includes("united states") &&
		!locLower.includes("usa") &&
		!locLower.includes("us (remote)")
	) {
		addScore(
			`Location: ${matchedLocation}`,
			locationWeights[matchedLocation] ?? 0,
		);
	}
	if (isRemote && isHomeLocation)
		addScore("Work type: remote", workTypeWeights.Remote ?? weights.remote);
	if (isHybrid) addScore("Work type: hybrid", workTypeWeights.Hybrid ?? 0);
	if (isOnSite) addScore("Work type: onsite", workTypeWeights["On-site"] ?? 0);
	if (isContract)
		addScore("Work type: contract", workTypeWeights.Contract ?? 0);

	// Design-system, UX, and "heavy backend/platform" keyword signals are not built in
	// here since they only apply to a design/frontend-specific search — add them as
	// Custom Scoring Rules in the rubric UI instead so they stay editable per user.

	// 3. Tech Stack Matching
	const requiredTech: string[] = criteria.techStackRequired || [
		"React",
		"TypeScript",
		"Next.js",
		"Tailwind CSS",
	];
	let requiredSkillPoints = 0;
	for (const tech of requiredTech) {
		const techTerms = tech.toLowerCase().split(/\s*\/\s*/);
		if (techTerms.some((term: string) => fullText.includes(term))) {
			matchedSkills.push(tech);
			requiredSkillPoints +=
				weighting.skillWeights?.[tech] ?? weights.requiredSkill;
		} else {
			missingSkills.push(tech);
		}
	}
	addScore("Required skills", Math.min(18, requiredSkillPoints));
	if (matchedSkills.length >= 2) {
		keyPros.push(
			`Strong core stack overlap (${matchedSkills.slice(0, 4).join(", ")})`,
		);
	}
	if (missingSkills.length > 0) {
		addScore(
			"Missing required skills",
			Math.max(-18, missingSkills.length * weights.missingRequiredSkill),
		);
		keyCons.push(
			`Posting doesn't mention required skills: ${missingSkills.slice(0, 4).join(", ")}`,
		);
	}

	const niceTech: string[] = criteria.techStackNiceToHave || [
		"Svelte",
		"GSAP",
		"Design Systems",
		"TanStack Query",
	];
	let niceSkillPoints = 0;
	for (const tech of niceTech) {
		if (fullText.includes(tech.toLowerCase())) {
			matchedSkills.push(tech);
			niceSkillPoints += weighting.skillWeights?.[tech] ?? weights.niceSkill;
		}
	}

	addScore("Bonus skills", Math.min(6, niceSkillPoints));

	// 4. Dealbreaker Scans
	const strictDegreeRequirement =
		/(?:bachelor'?s|master'?s|b\.s\.|bsc|m\.s\.|msc|degree)\s+(?:degree\s+)?(?:in\s+)?(?:computer science|computer engineering|software engineering|related field)?[^.]{0,100}(?:required|must have|minimum requirement)/i.test(
			fullText,
		) &&
		!/(?:equivalent (?:practical )?experience|or equivalent experience|degree or equivalent)/i.test(
			fullText,
		);
	if (strictDegreeRequirement) {
		addScore("Strict education requirement", weights.strictEducation);
		keyCons.push(
			"Explicit CS/engineering degree requirement with no equivalent-experience path",
		);
		if (
			criteria.dealbreakers?.some(
				(d: string) =>
					d.toLowerCase().includes("strict") &&
					d.toLowerCase().includes("degree"),
			)
		) {
			dealbreakerTriggers.push("Strict CS Degree Requirement");
		}
	}
	if (
		fullText.includes("security clearance") ||
		fullText.includes("ts/sci") ||
		fullText.includes("us citizen only") ||
		fullText.includes("u.s. citizenship required") ||
		fullText.includes("dod clearance")
	) {
		keyCons.push("Requires active US security clearance or US citizenship");
		if (hasDealbreaker("us citizen", "clearance", "sponsorship")) {
			dealbreakerTriggers.push(
				"US Security Clearance / US Citizenship mandatory",
			);
			addScore("US clearance/citizenship restriction", -50);
		}
	}

	if (
		fullText.includes("must reside in the united states") ||
		fullText.includes("us residents only") ||
		fullText.includes("w2 only without c2c")
	) {
		keyCons.push(
			"Requires US domestic residency with no Canadian hiring mechanism",
		);
		if (hasDealbreaker("us w-2", "us citizen", "c2c", "1099")) {
			dealbreakerTriggers.push(
				"Strict US Resident/W2 restriction (Excludes Canadian residents)",
			);
			addScore("US residency restriction", -40);
		}
	}

	if (
		fullText.includes("wordpress") ||
		fullText.includes("php") ||
		fullText.includes("jquery") ||
		fullText.includes("drupal")
	) {
		if (!fullText.includes("react") && !fullText.includes("typescript")) {
			keyCons.push("Role revolves around legacy CMS/frameworks");
			if (hasDealbreaker("legacy stack", "legacy tech")) {
				dealbreakerTriggers.push("Legacy Tech Stack (PHP/WordPress/jQuery)");
				addScore("Legacy technology stack", -30);
			}
		}
	}

	if (
		fullText.includes("staffing agency") ||
		fullText.includes("third-party recruiter") ||
		fullText.includes("recruitment agency")
	) {
		keyCons.push(
			"Third-party agency posting rather than direct product engineering team",
		);
		if (hasDealbreaker("staffing agency")) {
			dealbreakerTriggers.push("Third-Party Staffing / Recruitment Agency");
			addScore("Staffing agency posting", -20);
		}
	}

	// 4b. Fully user-defined scoring rules (name + keywords + weight), so anyone can
	// add or remove their own criteria without touching code.
	const customSignals = weighting.customSignals || [];
	for (const signal of customSignals) {
		const keywords = (signal.keywords || [])
			.map((k: string) => k.trim().toLowerCase())
			.filter(Boolean);
		if (keywords.length === 0) continue;
		const matched = keywords.some((k: string) => fullText.includes(k));
		if (matched) {
			addScore(signal.name || "Custom rule", Number(signal.weight) || 0);
			if ((Number(signal.weight) || 0) < 0) {
				keyCons.push(`Matched custom rule: ${signal.name}`);
			} else if ((Number(signal.weight) || 0) > 0) {
				keyPros.push(`Matched custom rule: ${signal.name}`);
			}
		}
	}

	// 5. Salary Fit
	let salaryFit:
		| "Above Target"
		| "Within Target"
		| "Below Target"
		| "Not Disclosed" = "Not Disclosed";
	if (job.salaryRaw) {
		const salaryDigits = (
			job.salaryRaw.replace(/,/g, "").match(/\d{5,7}/g) || []
		).map(Number);
		if (salaryDigits.length > 0) {
			const maxSal = Math.max(...salaryDigits);
			const minSal = Math.min(...salaryDigits);
			const targetMin = criteria.minSalary || 100000;
			if (maxSal >= targetMin * 1.2) {
				salaryFit = "Above Target";
				addScore("Salary above floor", weights.salaryAbove);
				keyPros.push(
					`Compensation exceeds base target ($${maxSal.toLocaleString()} ${criteria.salaryCurrency || "CAD"})`,
				);
			} else if (maxSal >= targetMin || minSal >= targetMin * 0.9) {
				salaryFit = "Within Target";
				addScore("Salary near floor", weights.salaryWithin);
				keyPros.push(
					`Compensation aligns with base salary target ($${targetMin.toLocaleString()}+)`,
				);
			} else if (maxSal < targetMin * 0.85) {
				salaryFit = "Below Target";
				addScore("Salary below floor", weights.salaryBelow);
				keyCons.push(
					`Compensation (${job.salaryRaw}) is below minimum target of $${targetMin.toLocaleString()}`,
				);
				if (hasDealbreaker("below salary floor", "salary floor")) {
					dealbreakerTriggers.push(
						`Base salary below minimum floor ($${targetMin.toLocaleString()})`,
					);
				}
			}
		}
	}

	if (dealbreakerTriggers.length > 0) {
		const dealbreakerCap = Math.max(0, Math.min(45, scoreBands.pruneBelow - 1));
		if (score > dealbreakerCap)
			scoreBreakdown.push({
				label: "Dealbreaker score cap",
				points: dealbreakerCap - score,
			});
		score = Math.min(score, dealbreakerCap);
	}
	score = Math.max(15, Math.min(98, Math.round(score)));

	let verdict: "STRONG_KEEP" | "CONSIDER" | "REMOVE" = "CONSIDER";
	if (dealbreakerTriggers.length > 0 || score < scoreBands.pruneBelow) {
		verdict = "REMOVE";
	} else if (score >= scoreBands.keepAt) {
		verdict = "STRONG_KEEP";
	} else {
		verdict = "CONSIDER";
	}

	const confidence =
		matchedSkills.length > 0 || descriptionText.length > 200
			? "HIGH"
			: "MEDIUM";

	let oneSentenceSummary = "";
	if (verdict === "STRONG_KEEP") {
		oneSentenceSummary = `High-conviction match for ${job.title} at ${job.company} featuring strong technical stack overlap (${matchedSkills.slice(0, 3).join(", ") || "Frontend Engineering"}) and verified remote/location compatibility.`;
	} else if (verdict === "CONSIDER") {
		oneSentenceSummary = `Viable contender for ${job.title} at ${job.company}; exhibits good foundation with minor stack or scope considerations to verify.`;
	} else {
		const mainIssue =
			dealbreakerTriggers[0] ||
			keyCons[0] ||
			"Low criteria alignment with candidate profile";
		oneSentenceSummary = `Recommended for removal: Disqualified due to ${mainIssue.toLowerCase()}.`;
	}

	const yearsExp = criteria.yearsOfExperience || 5;
	const topRequiredSkills = (criteria.techStackRequired || []).slice(0, 3);
	const primaryTitle = criteria.targetJobTitles?.[0] || "this role";
	const stackSummary =
		topRequiredSkills.length > 0
			? topRequiredSkills.join(", ")
			: "the required technology stack";
	const tailoredPitch = `• ${yearsExp}+ years of production experience relevant to ${primaryTitle}, with hands-on depth in ${stackSummary}.\n• Track record aligned with this candidate's stated preferred industries and working style, per their context document.\n• Proven ability to deliver against the seniority level, scope, and remote/location preferences configured in this rubric.`;

	const actionRecommendation =
		verdict === "STRONG_KEEP"
			? `Apply immediately with a tailored resume highlighting ${stackSummary}.`
			: verdict === "CONSIDER"
				? "Review job description requirements and team scope before submitting application."
				: "Prune/discard from active screener to keep pipeline focused on high-fit opportunities.";

	return {
		score,
		scoreBreakdown,
		verdict,
		confidence,
		oneSentenceSummary,
		keyPros:
			keyPros.length > 0 ? keyPros : ["Relevant software engineering domain"],
		keyCons:
			keyCons.length > 0
				? keyCons
				: ["No material risks detected from the available posting details"],
		dealbreakerTriggers,
		matchedSkills,
		missingSkills,
		salaryFit,
		experienceFit,
		locationFit,
		tailoredPitch,
		resumeHighlights:
			matchedSkills.length > 0
				? matchedSkills
						.slice(0, 5)
						.map((skill) => `${yearsExp}+ years working with ${skill}`)
				: [`${yearsExp}+ years of relevant experience for ${primaryTitle}`],
		actionRecommendation,
	};
}
