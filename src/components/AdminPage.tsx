import React, { useEffect, useState } from "react";
import { LogIn, LogOut, ShieldCheck } from "lucide-react";

interface AuthState {
	authenticated: boolean;
	email: string | null;
}

export const AdminPage: React.FC = () => {
	const [auth, setAuth] = useState<AuthState | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const authError = params.get("error");
		if (authError) {
			setError(
				authError === "unauthorized"
					? "That Google account is not authorized for this admin area."
					: "Google authentication could not be completed.",
			);
			window.history.replaceState({}, "", "/admin");
		}
		fetch("/api/admin-session")
			.then((response) => response.json())
			.then(setAuth)
			.catch(() => setError("Could not reach the authentication service."));
	}, []);

	const handleLogout = async () => {
		await fetch("/api/admin-logout", { method: "POST" });
		setAuth({ authenticated: false, email: null });
	};

	return (
		<main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10">
			<section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
				<div className="flex items-center gap-3 mb-6">
					<div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
						<ShieldCheck className="w-5 h-5 text-blue-400" />
					</div>
					<div>
						<h1 className="text-lg font-bold">Admin Access</h1>
						<p className="text-xs text-slate-400">
							Private Gemini-powered tools
						</p>
					</div>
				</div>

				{error && (
					<div className="mb-4 rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
						{error}
					</div>
				)}

				{auth?.authenticated ? (
					<div className="space-y-4">
						<div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
							Signed in as {auth.email}
						</div>
						<a
							href="/"
							className="block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-center text-xs font-semibold text-white hover:bg-blue-500">
							Open Screener
						</a>
						<button
							type="button"
							onClick={handleLogout}
							className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700">
							<LogOut className="h-3.5 w-3.5" />
							Sign Out
						</button>
					</div>
				) : (
					<div className="space-y-4">
						<p className="text-sm leading-relaxed text-slate-300">
							Sign in with the Google account configured as the administrator.
							Your Gemini API key stays on the server and is never sent to the
							browser.
						</p>
						<a
							href="/api/admin-login"
							className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500">
							<LogIn className="h-3.5 w-3.5" />
							Continue with Google
						</a>
					</div>
				)}
			</section>
		</main>
	);
};
