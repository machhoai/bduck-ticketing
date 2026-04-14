"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { createSessionAndSyncUser } from "@/actions/auth";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Loader2, AlertCircle, Sparkles, Star, Ticket, Gamepad2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "login" | "register";

// ─── Google Icon SVG ─────────────────────────────────────────────────────────
function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}

// ─── Hero Panel (Left Side) ───────────────────────────────────────────────────
function HeroPanel({ t }: { t: ReturnType<typeof useTranslations> }) {
    return (
        <div
            className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 overflow-hidden"
            style={{
                background: "linear-gradient(135deg, #1A1A2E 0%, #16213E 40%, #0F3460 100%)",
            }}
        >
            {/* Background decorative blobs */}
            <div
                className="absolute top-[-80px] right-[-80px] w-[400px] h-[400px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(255,209,0,0.18) 0%, transparent 65%)" }}
            />
            <div
                className="absolute bottom-[80px] left-[-60px] w-[300px] h-[300px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(255,121,0,0.14) 0%, transparent 65%)" }}
            />
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none opacity-30"
                style={{ background: "radial-gradient(circle, rgba(255,209,0,0.08) 0%, transparent 70%)" }}
            />

            {/* Brand logo top */}
            <div className="relative z-10 flex items-center gap-3">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[#1A1A2E] text-sm"
                    style={{ background: "linear-gradient(135deg, #FFD100, #FF7900)" }}
                >
                    BD
                </div>
                <div>
                    <p className="text-white font-bold text-base leading-tight">B.Duck Cityfuns</p>
                    <p className="text-white/40 text-xs">Vietnam</p>
                </div>
            </div>

            {/* Central content */}
            <div className="relative z-10 flex-1 flex flex-col justify-center">
                {/* Floating badge */}
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-6 w-fit">
                    <Sparkles className="w-3.5 h-3.5 text-[#FFD100]" />
                    <span className="text-white/80 text-xs font-medium">B.Duck Cityfuns Vietnam</span>
                </div>

                <h1
                    className="text-white font-black leading-[1.05] mb-3"
                    style={{ fontSize: "clamp(2.2rem, 3.5vw, 3rem)", fontFamily: "var(--font-montserrat)" }}
                >
                    {t("heroTitle")}{" "}
                    <span
                        className="block"
                        style={{
                            background: "linear-gradient(135deg, #FFD100, #FF7900)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                        }}
                    >
                        {t("heroSubtitle")}
                    </span>
                </h1>
                <p className="text-white/55 text-sm leading-relaxed max-w-sm mb-10">
                    {t("heroTagline")}
                </p>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { icon: Ticket, value: "50K+", label: t("statTickets") },
                        { icon: Gamepad2, value: "10+", label: t("statGames") },
                        { icon: Star, value: "4.9★", label: t("statRating") },
                    ].map(({ icon: Icon, value, label }) => (
                        <div
                            key={label}
                            className="rounded-2xl p-4 flex flex-col gap-1"
                            style={{
                                background: "rgba(255,255,255,0.07)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                backdropFilter: "blur(8px)",
                            }}
                        >
                            <Icon className="w-4 h-4 text-[#FFD100] mb-1" />
                            <p className="text-white font-black text-lg leading-none">{value}</p>
                            <p className="text-white/45 text-xs leading-tight">{label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom testimonial */}
            <div
                className="relative z-10 rounded-2xl p-4 flex items-start gap-3"
                style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    backdropFilter: "blur(8px)",
                }}
            >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FFD100] to-[#FF7900] flex items-center justify-center text-[#1A1A2E] font-bold text-sm flex-shrink-0">
                    M
                </div>
                <div>
                    <p className="text-white/80 text-xs leading-relaxed italic">
                        &ldquo;Mua vé cực nhanh, nhận QR ngay, vào cổng chỉ mất 5 giây. Con bé thích mê!&rdquo;
                    </p>
                    <p className="text-white/40 text-xs mt-1">Minh Châu · Khách hàng thân thiết</p>
                </div>
            </div>
        </div>
    );
}

// ─── Error Message Helper ─────────────────────────────────────────────────────
function getErrorKey(code?: string): string {
    const map: Record<string, string> = {
        "auth/invalid-credential": "errorInvalidCredential",
        "auth/wrong-password": "errorInvalidCredential",
        "auth/user-not-found": "errorUserNotFound",
        "auth/email-already-in-use": "errorEmailInUse",
        "auth/weak-password": "errorWeakPassword",
        "auth/too-many-requests": "errorTooManyRequests",
        "auth/user-disabled": "errorUserDisabled",
    };
    return map[code ?? ""] ?? "errorGeneric";
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations("auth");

    const [tab, setTab] = useState<Tab>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Smart Redirect ────────────────────────────────────────────────────────
    const doRedirect = useCallback(
        (role: string) => {
            const next = searchParams.get("next");
            if (next) {
                router.push(next);
            } else if (role === "admin") {
                router.push("/admin");
            } else {
                router.push("/");
            }
            router.refresh();
        },
        [router, searchParams]
    );

    // ── After any Firebase auth success: create session + sync profile ────────
    const finalizeAuth = useCallback(
        async (user: import("firebase/auth").User) => {
            const idToken = await user.getIdToken();
            const { role } = await createSessionAndSyncUser(idToken);
            doRedirect(role);
        },
        [doRedirect]
    );

    // ── Email Login ───────────────────────────────────────────────────────────
    const handleEmailLogin = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            setError(null);
            setIsLoading(true);
            try {
                const credential = await signInWithEmailAndPassword(auth, email, password);
                await finalizeAuth(credential.user);
            } catch (err: unknown) {
                const code = (err as { code?: string })?.code;
                setError(t(getErrorKey(code) as Parameters<typeof t>[0]));
            } finally {
                setIsLoading(false);
            }
        },
        [email, password, finalizeAuth, t]
    );

    // ── Email Register ────────────────────────────────────────────────────────
    const handleEmailRegister = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            setError(null);
            if (password !== confirmPassword) {
                setError(t("errorPasswordMismatch"));
                return;
            }
            setIsLoading(true);
            try {
                const credential = await createUserWithEmailAndPassword(auth, email, password);
                // Set displayName on Firebase Auth profile
                if (displayName.trim()) {
                    await updateProfile(credential.user, { displayName: displayName.trim() });
                }
                await finalizeAuth(credential.user);
            } catch (err: unknown) {
                const code = (err as { code?: string })?.code;
                setError(t(getErrorKey(code) as Parameters<typeof t>[0]));
            } finally {
                setIsLoading(false);
            }
        },
        [email, password, confirmPassword, displayName, finalizeAuth, t]
    );

    // ── Google Sign-In ────────────────────────────────────────────────────────
    const handleGoogle = useCallback(async () => {
        setError(null);
        setIsLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: "select_account" });
            const credential = await signInWithPopup(auth, provider);
            await finalizeAuth(credential.user);
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            // popup-closed-by-user is not an error
            if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
                setError(t(getErrorKey(code) as Parameters<typeof t>[0]));
            }
        } finally {
            setIsLoading(false);
        }
    }, [finalizeAuth, t]);

    // ── Input base class ──────────────────────────────────────────────────────
    const inputCls =
        "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#1A1A2E] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FFD100]/60 focus:border-[#FFD100] transition-all disabled:opacity-50";

    return (
        <div className="min-h-screen flex">
            {/* ── LEFT: Hero Panel (desktop only) ── */}
            <HeroPanel t={t} />

            {/* ── RIGHT: Auth Form ── */}
            <div className="w-full lg:w-[45%] min-h-screen flex items-center justify-center bg-[#FAFAF8] px-6 py-12">
                <div className="w-full max-w-[400px]">
                    {/* Mobile-only brand header */}
                    <div className="flex items-center gap-3 mb-8 lg:hidden">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[#1A1A2E] text-sm"
                            style={{ background: "linear-gradient(135deg, #FFD100, #FF7900)" }}
                        >
                            BD
                        </div>
                        <div>
                            <p className="font-bold text-[#1A1A2E] text-base leading-tight">B.Duck Cityfuns</p>
                            <p className="text-gray-400 text-xs">Vietnam</p>
                        </div>
                    </div>

                    {/* Card */}
                    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                        {/* Tab switcher */}
                        <div className="flex border-b border-gray-100">
                            {(["login", "register"] as Tab[]).map((t_tab) => (
                                <button
                                    key={t_tab}
                                    id={`auth-tab-${t_tab}`}
                                    onClick={() => { setTab(t_tab); setError(null); }}
                                    className={`flex-1 py-4 text-sm font-semibold transition-all relative ${
                                        tab === t_tab
                                            ? "text-[#1A1A2E]"
                                            : "text-gray-400 hover:text-gray-600"
                                    }`}
                                >
                                    {t_tab === "login" ? t("loginTab") : t("registerTab")}
                                    {tab === t_tab && (
                                        <span
                                            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full"
                                            style={{ background: "linear-gradient(90deg, #FFD100, #FF7900)" }}
                                        />
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="px-7 py-7 space-y-5">
                            {/* Error banner */}
                            {error && (
                                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 animate-fade-up">
                                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-red-600">{error}</p>
                                </div>
                            )}

                            {/* Google button */}
                            <button
                                id="auth-google-btn"
                                type="button"
                                onClick={handleGoogle}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-3 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-[#1A1A2E] hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
                            >
                                <GoogleIcon />
                                {t("continueWithGoogle")}
                            </button>

                            {/* Divider */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-gray-100" />
                                <span className="text-xs text-gray-400">{t("orDivider")}</span>
                                <div className="flex-1 h-px bg-gray-100" />
                            </div>

                            {/* ── LOGIN FORM ── */}
                            {tab === "login" && (
                                <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
                                    <div className="space-y-1.5">
                                        <label htmlFor="login-email" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {t("emailLabel")}
                                        </label>
                                        <input
                                            id="login-email"
                                            type="email"
                                            autoComplete="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder={t("emailPlaceholder")}
                                            disabled={isLoading}
                                            className={inputCls}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="login-password" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                {t("passwordLabel")}
                                            </label>
                                            <button
                                                type="button"
                                                className="text-xs text-[#FF7900] hover:underline"
                                                tabIndex={-1}
                                            >
                                                {t("forgotPassword")}
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <input
                                                id="login-password"
                                                type={showPassword ? "text" : "password"}
                                                autoComplete="current-password"
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder={t("passwordPlaceholder")}
                                                disabled={isLoading}
                                                className={`${inputCls} pr-12`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((v) => !v)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        id="login-submit-btn"
                                        type="submit"
                                        disabled={isLoading || !email || !password}
                                        className="w-full py-3.5 font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-[#1A1A2E]"
                                        style={{
                                            background: "linear-gradient(135deg, #FFD100, #FF7900)",
                                            boxShadow: "0 4px 20px rgba(255,209,0,0.35)",
                                        }}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {t("loggingIn")}
                                            </>
                                        ) : (
                                            t("loginButton")
                                        )}
                                    </button>

                                    <p className="text-center text-xs text-gray-400">
                                        {t("switchToRegister")}{" "}
                                        <button
                                            type="button"
                                            onClick={() => { setTab("register"); setError(null); }}
                                            className="text-[#FF7900] font-semibold hover:underline"
                                        >
                                            {t("registerTab")}
                                        </button>
                                    </p>
                                </form>
                            )}

                            {/* ── REGISTER FORM ── */}
                            {tab === "register" && (
                                <form onSubmit={handleEmailRegister} className="space-y-4" noValidate>
                                    <div className="space-y-1.5">
                                        <label htmlFor="reg-name" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {t("displayNameLabel")}
                                        </label>
                                        <input
                                            id="reg-name"
                                            type="text"
                                            autoComplete="name"
                                            required
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            placeholder={t("displayNamePlaceholder")}
                                            disabled={isLoading}
                                            className={inputCls}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label htmlFor="reg-email" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {t("emailLabel")}
                                        </label>
                                        <input
                                            id="reg-email"
                                            type="email"
                                            autoComplete="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder={t("emailPlaceholder")}
                                            disabled={isLoading}
                                            className={inputCls}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label htmlFor="reg-password" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {t("passwordLabel")}
                                        </label>
                                        <div className="relative">
                                            <input
                                                id="reg-password"
                                                type={showPassword ? "text" : "password"}
                                                autoComplete="new-password"
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder={t("passwordPlaceholder")}
                                                disabled={isLoading}
                                                className={`${inputCls} pr-12`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((v) => !v)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label htmlFor="reg-confirm-password" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {t("confirmPasswordLabel")}
                                        </label>
                                        <div className="relative">
                                            <input
                                                id="reg-confirm-password"
                                                type={showConfirmPassword ? "text" : "password"}
                                                autoComplete="new-password"
                                                required
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder={t("confirmPasswordPlaceholder")}
                                                disabled={isLoading}
                                                className={`${inputCls} pr-12`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword((v) => !v)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                                tabIndex={-1}
                                            >
                                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        id="register-submit-btn"
                                        type="submit"
                                        disabled={isLoading || !email || !password || !displayName}
                                        className="w-full py-3.5 font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-[#1A1A2E]"
                                        style={{
                                            background: "linear-gradient(135deg, #FFD100, #FF7900)",
                                            boxShadow: "0 4px 20px rgba(255,209,0,0.35)",
                                        }}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {t("registering")}
                                            </>
                                        ) : (
                                            t("registerButton")
                                        )}
                                    </button>

                                    {/* Terms */}
                                    <p className="text-center text-[11px] text-gray-400 leading-relaxed">
                                        {t("termsNote")}{" "}
                                        <a href="/terms" className="text-[#FF7900] hover:underline">{t("termsLink")}</a>
                                        {" "}{t("andWord")}{" "}
                                        <a href="/privacy" className="text-[#FF7900] hover:underline">{t("privacyLink")}</a>.
                                    </p>

                                    <p className="text-center text-xs text-gray-400">
                                        {t("switchToLogin")}{" "}
                                        <button
                                            type="button"
                                            onClick={() => { setTab("login"); setError(null); }}
                                            className="text-[#FF7900] font-semibold hover:underline"
                                        >
                                            {t("loginTab")}
                                        </button>
                                    </p>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-xs text-gray-400 mt-5">
                        © 2026 B.Duck Cityfuns Vietnam
                    </p>
                </div>
            </div>
        </div>
    );
}
