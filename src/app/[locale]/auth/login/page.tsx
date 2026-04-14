"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
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
import { Eye, EyeOff, Loader2, AlertCircle, ArrowRight, UserPlus } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "login" | "register";

// ─── Google Icon SVG ─────────────────────────────────────────────────────────
function GoogleIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}

// ─── Floating Particles ──────────────────────────────────────────────────────
function FloatingParticles() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
                <div
                    key={i}
                    className="auth-particle"
                    style={{
                        left: `${8 + Math.random() * 84}%`,
                        top: `${5 + Math.random() * 90}%`,
                        width: `${3 + Math.random() * 5}px`,
                        height: `${3 + Math.random() * 5}px`,
                        animationDelay: `${Math.random() * 6}s`,
                        animationDuration: `${4 + Math.random() * 4}s`,
                        opacity: 0.3 + Math.random() * 0.5,
                    }}
                />
            ))}
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
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

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
            if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
                setError(t(getErrorKey(code) as Parameters<typeof t>[0]));
            }
        } finally {
            setIsLoading(false);
        }
    }, [finalizeAuth, t]);

    return (
        <div className="auth-page">
            {/* ── Inline Scoped Styles ── */}
            <style>{`
                .auth-page {
                    --auth-navy: #0A0E1A;
                    --auth-navy-light: #131829;
                    --auth-gold: #FFD100;
                    --auth-orange: #FF7900;
                    --auth-cream: #FFF9EB;
                    --auth-surface: rgba(255,255,255,0.04);
                    --auth-border: rgba(255,255,255,0.08);
                    --auth-text: #E8E6E1;
                    --auth-text-muted: rgba(255,255,255,0.45);
                    --auth-radius: 20px;
                    --auth-input-radius: 14px;

                    position: fixed;
                    inset: 0;
                    z-index: 50;
                    display: flex;
                    background: var(--auth-navy);
                    overflow: hidden;
                    font-family: var(--font-montserrat), 'Montserrat', system-ui, sans-serif;
                }

                /* ── HERO PANEL (Left) ── */
                .auth-hero {
                    display: none;
                    position: relative;
                    width: 52%;
                    overflow: hidden;
                }
                @media (min-width: 1024px) {
                    .auth-hero { display: flex; }
                }

                .auth-hero-image {
                    position: absolute;
                    inset: 0;
                    z-index: 0;
                }
                .auth-hero-image img {
                    object-fit: cover;
                    object-position: center 35%;
                }

                /* Cinematic vignette overlay */
                .auth-hero-vignette {
                    position: absolute;
                    inset: 0;
                    z-index: 1;
                    background:
                        linear-gradient(180deg,
                            rgba(10,14,26,0.55) 0%,
                            rgba(10,14,26,0.1) 30%,
                            rgba(10,14,26,0.05) 50%,
                            rgba(10,14,26,0.3) 80%,
                            rgba(10,14,26,0.85) 100%
                        ),
                        linear-gradient(90deg,
                            transparent 60%,
                            rgba(10,14,26,0.9) 100%
                        );
                }

                /* Warm bokeh glow */
                .auth-hero-bokeh {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(80px);
                    z-index: 2;
                    pointer-events: none;
                    animation: auth-bokeh-drift 12s ease-in-out infinite alternate;
                }
                .auth-hero-bokeh--gold {
                    width: 300px; height: 300px;
                    top: 15%; left: 10%;
                    background: rgba(255,209,0,0.15);
                }
                .auth-hero-bokeh--orange {
                    width: 250px; height: 250px;
                    bottom: 20%; right: 15%;
                    background: rgba(255,121,0,0.12);
                    animation-delay: -4s;
                    animation-duration: 14s;
                }

                /* Hero bottom content */
                .auth-hero-content {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 5;
                    padding: 48px;
                }
                .auth-hero-logo {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-bottom: 20px;
                }
                .auth-hero-logo-mark {
                    width: 44px;
                    height: 44px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 900;
                    font-size: 13px;
                    color: var(--auth-navy);
                    background: linear-gradient(135deg, var(--auth-gold), var(--auth-orange));
                    box-shadow: 0 4px 20px rgba(255,209,0,0.35);
                }
                .auth-hero-logo-text {
                    color: white;
                    font-weight: 800;
                    font-size: 18px;
                    line-height: 1.15;
                }
                .auth-hero-logo-sub {
                    color: rgba(255,255,255,0.4);
                    font-size: 11px;
                    font-weight: 500;
                    letter-spacing: 0.5px;
                }
                .auth-hero-headline {
                    font-size: clamp(1.6rem, 2.5vw, 2.4rem);
                    font-weight: 900;
                    line-height: 1.1;
                    color: white;
                    margin-bottom: 10px;
                    max-width: 420px;
                }
                .auth-hero-headline span {
                    background: linear-gradient(135deg, var(--auth-gold), var(--auth-orange));
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .auth-hero-tagline {
                    color: rgba(255,255,255,0.5);
                    font-size: 13px;
                    line-height: 1.6;
                    max-width: 360px;
                }

                /* Stat pills */
                .auth-hero-stats {
                    display: flex;
                    gap: 10px;
                    margin-top: 24px;
                }
                .auth-stat-pill {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border-radius: 999px;
                    background: rgba(255,255,255,0.08);
                    border: 1px solid rgba(255,255,255,0.1);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                }
                .auth-stat-pill strong {
                    color: var(--auth-gold);
                    font-weight: 800;
                    font-size: 14px;
                }
                .auth-stat-pill span {
                    color: rgba(255,255,255,0.55);
                    font-size: 11px;
                    font-weight: 500;
                }

                /* ── FORM PANEL (Right) ── */
                .auth-form-panel {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    padding: 32px 24px;
                    overflow-y: auto;
                    background:
                        radial-gradient(ellipse at 30% 20%, rgba(255,209,0,0.03) 0%, transparent 50%),
                        radial-gradient(ellipse at 70% 80%, rgba(255,121,0,0.02) 0%, transparent 50%),
                        var(--auth-navy);
                }

                /* Mobile background image */
                .auth-form-panel::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: url('/images/hero-duck.png') center 30% / cover no-repeat;
                    opacity: 0.06;
                    pointer-events: none;
                }
                @media (min-width: 1024px) {
                    .auth-form-panel::before { display: none; }
                }

                /* Form container */
                .auth-form-container {
                    width: 100%;
                    max-width: 420px;
                    position: relative;
                    z-index: 2;
                }

                /* Mobile brand header */
                .auth-mobile-brand {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    margin-bottom: 32px;
                }
                @media (min-width: 1024px) {
                    .auth-mobile-brand { display: none; }
                }
                .auth-mobile-logo {
                    height: 42px;
                    width: auto;
                }

                /* Card */
                .auth-card {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid var(--auth-border);
                    border-radius: var(--auth-radius);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    overflow: hidden;
                }

                /* Greeting */
                .auth-greeting {
                    padding: 32px 32px 0;
                }
                .auth-greeting h1 {
                    font-size: 24px;
                    font-weight: 800;
                    color: white;
                    margin: 0 0 6px;
                    line-height: 1.2;
                }
                .auth-greeting p {
                    color: var(--auth-text-muted);
                    font-size: 13px;
                    margin: 0;
                    line-height: 1.5;
                }

                /* Tab strip */
                .auth-tabs {
                    display: flex;
                    margin: 20px 32px 0;
                    background: rgba(255,255,255,0.04);
                    border-radius: 12px;
                    padding: 4px;
                    gap: 4px;
                }
                .auth-tab-btn {
                    flex: 1;
                    padding: 10px 0;
                    border-radius: 10px;
                    font-size: 13px;
                    font-weight: 600;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    background: transparent;
                    color: var(--auth-text-muted);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }
                .auth-tab-btn:hover {
                    color: rgba(255,255,255,0.7);
                }
                .auth-tab-btn--active {
                    background: linear-gradient(135deg, var(--auth-gold), var(--auth-orange));
                    color: var(--auth-navy);
                    box-shadow: 0 4px 16px rgba(255,209,0,0.25);
                }
                .auth-tab-btn--active:hover {
                    color: var(--auth-navy);
                }

                /* Form body */
                .auth-form-body {
                    padding: 24px 32px 32px;
                }

                /* Error */
                .auth-error {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    padding: 12px 16px;
                    border-radius: 14px;
                    background: rgba(239,68,68,0.08);
                    border: 1px solid rgba(239,68,68,0.15);
                    margin-bottom: 20px;
                    animation: auth-shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
                }
                .auth-error svg {
                    flex-shrink: 0;
                    margin-top: 1px;
                    color: #f87171;
                }
                .auth-error p {
                    color: #fca5a5;
                    font-size: 13px;
                    margin: 0;
                    line-height: 1.45;
                }

                /* Google button */
                .auth-google-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    padding: 13px 20px;
                    border-radius: var(--auth-input-radius);
                    background: rgba(255,255,255,0.06);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: var(--auth-text);
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.25s ease;
                    margin-bottom: 20px;
                    font-family: inherit;
                }
                .auth-google-btn:hover:not(:disabled) {
                    background: rgba(255,255,255,0.1);
                    border-color: rgba(255,255,255,0.18);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                }
                .auth-google-btn:active:not(:disabled) {
                    transform: translateY(0) scale(0.98);
                }
                .auth-google-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                /* Divider */
                .auth-divider {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 20px;
                }
                .auth-divider-line {
                    flex: 1;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
                }
                .auth-divider span {
                    color: var(--auth-text-muted);
                    font-size: 11px;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    white-space: nowrap;
                }

                /* Input group */
                .auth-field {
                    margin-bottom: 16px;
                }
                .auth-label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    color: rgba(255,255,255,0.4);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 6px;
                }
                .auth-label-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 6px;
                }
                .auth-forgot {
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--auth-gold);
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                    font-family: inherit;
                    opacity: 0.8;
                    transition: opacity 0.2s;
                }
                .auth-forgot:hover { opacity: 1; }

                .auth-input-wrap {
                    position: relative;
                }
                .auth-input {
                    width: 100%;
                    padding: 13px 16px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: var(--auth-input-radius);
                    color: white;
                    font-size: 14px;
                    font-family: inherit;
                    transition: all 0.3s ease;
                    outline: none;
                }
                .auth-input::placeholder {
                    color: rgba(255,255,255,0.2);
                }
                .auth-input:focus {
                    border-color: var(--auth-gold);
                    background: rgba(255,209,0,0.04);
                    box-shadow: 0 0 0 3px rgba(255,209,0,0.08), 0 0 20px rgba(255,209,0,0.05);
                }
                .auth-input:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .auth-input--has-toggle {
                    padding-right: 48px;
                }

                .auth-toggle-pw {
                    position: absolute;
                    right: 4px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    padding: 8px;
                    cursor: pointer;
                    color: rgba(255,255,255,0.3);
                    transition: color 0.2s;
                }
                .auth-toggle-pw:hover {
                    color: rgba(255,255,255,0.6);
                }

                /* Submit button */
                .auth-submit {
                    width: 100%;
                    padding: 14px 24px;
                    border: none;
                    border-radius: var(--auth-input-radius);
                    font-size: 14px;
                    font-weight: 700;
                    font-family: inherit;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    color: var(--auth-navy);
                    background: linear-gradient(135deg, var(--auth-gold), var(--auth-orange));
                    box-shadow: 0 4px 24px rgba(255,209,0,0.3);
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    margin-top: 24px;
                    position: relative;
                    overflow: hidden;
                }
                .auth-submit::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%);
                    transform: translateX(-100%);
                    transition: transform 0.5s ease;
                }
                .auth-submit:hover:not(:disabled)::before {
                    transform: translateX(100%);
                }
                .auth-submit:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 32px rgba(255,209,0,0.4);
                }
                .auth-submit:active:not(:disabled) {
                    transform: translateY(0) scale(0.97);
                }
                .auth-submit:disabled {
                    opacity: 0.45;
                    cursor: not-allowed;
                }

                /* Switch text */
                .auth-switch {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 13px;
                    color: var(--auth-text-muted);
                }
                .auth-switch button {
                    background: none;
                    border: none;
                    color: var(--auth-gold);
                    font-weight: 700;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 13px;
                    padding: 0;
                    transition: opacity 0.2s;
                }
                .auth-switch button:hover {
                    opacity: 0.8;
                    text-decoration: underline;
                }

                /* Terms */
                .auth-terms {
                    text-align: center;
                    font-size: 11px;
                    color: var(--auth-text-muted);
                    margin-top: 16px;
                    line-height: 1.6;
                }
                .auth-terms a {
                    color: var(--auth-gold);
                    text-decoration: none;
                    font-weight: 600;
                }
                .auth-terms a:hover {
                    text-decoration: underline;
                }

                /* Footer */
                .auth-footer {
                    text-align: center;
                    margin-top: 28px;
                    font-size: 11px;
                    color: rgba(255,255,255,0.2);
                    letter-spacing: 0.3px;
                }

                /* ── PARTICLES ── */
                .auth-particle {
                    position: absolute;
                    border-radius: 50%;
                    background: var(--auth-gold);
                    animation: auth-particle-float 6s ease-in-out infinite;
                }

                /* ── ENTRANCE ANIMATION ── */
                .auth-enter {
                    opacity: 0;
                    transform: translateY(24px);
                    animation: auth-enter-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .auth-enter--d1 { animation-delay: 0.1s; }
                .auth-enter--d2 { animation-delay: 0.2s; }
                .auth-enter--d3 { animation-delay: 0.3s; }
                .auth-enter--d4 { animation-delay: 0.35s; }

                /* ── KEYFRAMES ── */
                @keyframes auth-particle-float {
                    0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
                    50% { transform: translateY(-20px) scale(1.3); opacity: 0.7; }
                }
                @keyframes auth-bokeh-drift {
                    0% { transform: translate(0, 0) scale(1); }
                    100% { transform: translate(30px, -20px) scale(1.1); }
                }
                @keyframes auth-enter-up {
                    from { opacity: 0; transform: translateY(24px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes auth-shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-6px); }
                    40% { transform: translateX(6px); }
                    60% { transform: translateX(-4px); }
                    80% { transform: translateX(4px); }
                }
            `}</style>

            {/* ══════════ LEFT: HERO PANEL ══════════ */}
            <div className="auth-hero">
                {/* Full-bleed mascot backdrop */}
                <div className="auth-hero-image">
                    <Image
                        src="/images/hero-duck.png"
                        alt="B.Duck Cityfuns Adventure"
                        fill
                        priority
                        sizes="52vw"
                        quality={85}
                    />
                </div>

                {/* Cinematic overlay */}
                <div className="auth-hero-vignette" />

                {/* Warm bokeh lights */}
                <div className="auth-hero-bokeh auth-hero-bokeh--gold" />
                <div className="auth-hero-bokeh auth-hero-bokeh--orange" />

                {/* Floating particles */}
                <FloatingParticles />

                {/* Bottom content */}
                <div className="auth-hero-content">
                    <div className="auth-hero-logo">
                        <div className="auth-hero-logo-mark">BD</div>
                        <div>
                            <div className="auth-hero-logo-text">B.Duck Cityfuns</div>
                            <div className="auth-hero-logo-sub">Vietnam</div>
                        </div>
                    </div>
                    <h2 className="auth-hero-headline">
                        {t("heroTitle")}{" "}
                        <span>{t("heroSubtitle")}</span>
                    </h2>
                    <p className="auth-hero-tagline">{t("heroTagline")}</p>
                    <div className="auth-hero-stats">
                        <div className="auth-stat-pill">
                            <strong>50K+</strong>
                            <span>{t("statTickets")}</span>
                        </div>
                        <div className="auth-stat-pill">
                            <strong>10+</strong>
                            <span>{t("statGames")}</span>
                        </div>
                        <div className="auth-stat-pill">
                            <strong>4.9★</strong>
                            <span>{t("statRating")}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════ RIGHT: FORM PANEL ══════════ */}
            <div className="auth-form-panel">
                <FloatingParticles />

                <div className="auth-form-container">
                    {/* Mobile brand */}
                    <div className={`auth-mobile-brand ${mounted ? "auth-enter auth-enter--d1" : ""}`}>
                        <Image
                            src="/images/logo-bduck-cityfuns.png"
                            alt="B.Duck Cityfuns"
                            width={160}
                            height={42}
                            className="auth-mobile-logo"
                        />
                    </div>

                    {/* Auth card */}
                    <div className={`auth-card ${mounted ? "auth-enter auth-enter--d2" : ""}`}>
                        {/* Greeting */}
                        <div className="auth-greeting">
                            <h1>
                                {tab === "login" ? t("loginTab") : t("registerTab")} 👋
                            </h1>
                            <p>
                                {tab === "login"
                                    ? t("heroTagline")
                                    : t("heroTagline")}
                            </p>
                        </div>

                        {/* Tab strip */}
                        <div className="auth-tabs">
                            <button
                                id="auth-tab-login"
                                type="button"
                                onClick={() => { setTab("login"); setError(null); }}
                                className={`auth-tab-btn ${tab === "login" ? "auth-tab-btn--active" : ""}`}
                            >
                                <ArrowRight size={14} />
                                {t("loginTab")}
                            </button>
                            <button
                                id="auth-tab-register"
                                type="button"
                                onClick={() => { setTab("register"); setError(null); }}
                                className={`auth-tab-btn ${tab === "register" ? "auth-tab-btn--active" : ""}`}
                            >
                                <UserPlus size={14} />
                                {t("registerTab")}
                            </button>
                        </div>

                        {/* Form body */}
                        <div className="auth-form-body">
                            {/* Error banner */}
                            {error && (
                                <div className="auth-error">
                                    <AlertCircle size={16} />
                                    <p>{error}</p>
                                </div>
                            )}

                            {/* Google button */}
                            <button
                                id="auth-google-btn"
                                type="button"
                                onClick={handleGoogle}
                                disabled={isLoading}
                                className="auth-google-btn"
                            >
                                <GoogleIcon />
                                {t("continueWithGoogle")}
                            </button>

                            {/* Divider */}
                            <div className="auth-divider">
                                <div className="auth-divider-line" />
                                <span>{t("orDivider")}</span>
                                <div className="auth-divider-line" />
                            </div>

                            {/* ── LOGIN FORM ── */}
                            {tab === "login" && (
                                <form onSubmit={handleEmailLogin} noValidate>
                                    <div className="auth-field">
                                        <label htmlFor="login-email" className="auth-label">
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
                                            className="auth-input"
                                        />
                                    </div>

                                    <div className="auth-field">
                                        <div className="auth-label-row">
                                            <label htmlFor="login-password" className="auth-label" style={{ marginBottom: 0 }}>
                                                {t("passwordLabel")}
                                            </label>
                                            <button type="button" className="auth-forgot" tabIndex={-1}>
                                                {t("forgotPassword")}
                                            </button>
                                        </div>
                                        <div className="auth-input-wrap">
                                            <input
                                                id="login-password"
                                                type={showPassword ? "text" : "password"}
                                                autoComplete="current-password"
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder={t("passwordPlaceholder")}
                                                disabled={isLoading}
                                                className="auth-input auth-input--has-toggle"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((v) => !v)}
                                                className="auth-toggle-pw"
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        id="login-submit-btn"
                                        type="submit"
                                        disabled={isLoading || !email || !password}
                                        className="auth-submit"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                {t("loggingIn")}
                                            </>
                                        ) : (
                                            <>
                                                {t("loginButton")}
                                                <ArrowRight size={16} />
                                            </>
                                        )}
                                    </button>

                                    <p className="auth-switch">
                                        {t("switchToRegister")}{" "}
                                        <button
                                            type="button"
                                            onClick={() => { setTab("register"); setError(null); }}
                                        >
                                            {t("registerTab")}
                                        </button>
                                    </p>
                                </form>
                            )}

                            {/* ── REGISTER FORM ── */}
                            {tab === "register" && (
                                <form onSubmit={handleEmailRegister} noValidate>
                                    <div className="auth-field">
                                        <label htmlFor="reg-name" className="auth-label">
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
                                            className="auth-input"
                                        />
                                    </div>

                                    <div className="auth-field">
                                        <label htmlFor="reg-email" className="auth-label">
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
                                            className="auth-input"
                                        />
                                    </div>

                                    <div className="auth-field">
                                        <label htmlFor="reg-password" className="auth-label">
                                            {t("passwordLabel")}
                                        </label>
                                        <div className="auth-input-wrap">
                                            <input
                                                id="reg-password"
                                                type={showPassword ? "text" : "password"}
                                                autoComplete="new-password"
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder={t("passwordPlaceholder")}
                                                disabled={isLoading}
                                                className="auth-input auth-input--has-toggle"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((v) => !v)}
                                                className="auth-toggle-pw"
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="auth-field">
                                        <label htmlFor="reg-confirm-password" className="auth-label">
                                            {t("confirmPasswordLabel")}
                                        </label>
                                        <div className="auth-input-wrap">
                                            <input
                                                id="reg-confirm-password"
                                                type={showConfirmPassword ? "text" : "password"}
                                                autoComplete="new-password"
                                                required
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder={t("confirmPasswordPlaceholder")}
                                                disabled={isLoading}
                                                className="auth-input auth-input--has-toggle"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword((v) => !v)}
                                                className="auth-toggle-pw"
                                                tabIndex={-1}
                                            >
                                                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        id="register-submit-btn"
                                        type="submit"
                                        disabled={isLoading || !email || !password || !displayName}
                                        className="auth-submit"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                {t("registering")}
                                            </>
                                        ) : (
                                            <>
                                                {t("registerButton")}
                                                <UserPlus size={16} />
                                            </>
                                        )}
                                    </button>

                                    {/* Terms */}
                                    <p className="auth-terms">
                                        {t("termsNote")}{" "}
                                        <a href="/terms">{t("termsLink")}</a>
                                        {" "}{t("andWord")}{" "}
                                        <a href="/privacy">{t("privacyLink")}</a>.
                                    </p>

                                    <p className="auth-switch">
                                        {t("switchToLogin")}{" "}
                                        <button
                                            type="button"
                                            onClick={() => { setTab("login"); setError(null); }}
                                        >
                                            {t("loginTab")}
                                        </button>
                                    </p>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <p className={`auth-footer ${mounted ? "auth-enter auth-enter--d4" : ""}`}>
                        © 2026 B.Duck Cityfuns Vietnam
                    </p>
                </div>
            </div>
        </div>
    );
}
