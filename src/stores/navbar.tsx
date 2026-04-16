"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

// ─── Configurable Navbar properties ───────────────────────────────────────────

export interface NavbarConfig {
  /** Use dark (text-primary) text instead of white when not scrolled */
  darkText: boolean;
  /** Show bottom border shadow even when not scrolled */
  shadow: boolean;
  /** Force solid white background even when not scrolled */
  solidBg: boolean;
  /** Completely hide the navbar */
  hidden: boolean;
  /** Make the navbar transparent (no bg at all) — overrides solidBg */
  transparent: boolean;
}

const DEFAULT_CONFIG: NavbarConfig = {
  darkText: false,
  shadow: false,
  solidBg: false,
  hidden: false,
  transparent: false,
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface NavbarContextValue {
  config: NavbarConfig;
  setConfig: (patch: Partial<NavbarConfig>) => void;
  resetConfig: () => void;
}

const NavbarContext = createContext<NavbarContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NavbarProvider({ children }: { children: ReactNode }) {
  const [config, _setConfig] = useState<NavbarConfig>(DEFAULT_CONFIG);

  const setConfig = useCallback((patch: Partial<NavbarConfig>) => {
    _setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetConfig = useCallback(() => {
    _setConfig(DEFAULT_CONFIG);
  }, []);

  return (
    <NavbarContext.Provider value={{ config, setConfig, resetConfig }}>
      {children}
    </NavbarContext.Provider>
  );
}

// ─── Hook: read config (used inside Navbar) ───────────────────────────────────

export function useNavbarConfig(): NavbarConfig {
  const ctx = useContext(NavbarContext);
  if (!ctx) throw new Error("useNavbarConfig must be used within <NavbarProvider>");
  return ctx.config;
}

// ─── Hook: set config from any child page ─────────────────────────────────────
/**
 * Call from any page/component to override navbar appearance.
 * Automatically resets to defaults when the component unmounts.
 *
 * @example
 * // In a page component:
 * useNavbar({ darkText: true, shadow: true });
 */
export function useNavbar(overrides: Partial<NavbarConfig>) {
  const ctx = useContext(NavbarContext);
  if (!ctx) throw new Error("useNavbar must be used within <NavbarProvider>");

  const { setConfig, resetConfig } = ctx;

  useEffect(() => {
    setConfig(overrides);
    // Reset when the page unmounts (navigating away)
    return () => resetConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(overrides)]);
}
