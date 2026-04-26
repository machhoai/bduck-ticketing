"use server";

import "server-only";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventRegisterInput {
    apiBaseUrl: string;
    eventId: string;
    customer: {
        phone: string;      // 10 digits, starts with 03/05/07/08/09
        fullName: string;
        dob?: string;       // YYYY-MM-DD — API requires it, use "2000-01-01" as placeholder
        email?: string;
    };
    source?: string;        // default "bduck_ticketing"
}

export interface EventRegisterResult {
    success: boolean;
    isNewUser?: boolean;
    spinsRemaining?: number;
    message?: string;
    error?: string;
}

// ─── Register Customer ────────────────────────────────────────────────────────

/**
 * Calls the JoyWorld ERP API to register a customer for an event.
 * Grants gacha spins if new customer, or returns remaining spins.
 *
 * - Retries once on network error.
 * - Returns error object instead of throwing — caller decides how to handle.
 */
export async function registerEventCustomer(
    input: EventRegisterInput
): Promise<EventRegisterResult> {
    const url = `${input.apiBaseUrl.replace(/\/$/, "")}/api/v1/events/register`;

    const payload = {
        eventId: input.eventId,
        customer: {
            phone: input.customer.phone,
            fullName: input.customer.fullName,
            dob: input.customer.dob || "2000-01-01", // placeholder if not provided
            email: input.customer.email,
        },
        source: input.source || "bduck_ticketing",
    };

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(10_000), // 10s timeout
            });

            const data = await res.json();

            if (!res.ok) {
                console.error(`[event-gacha] API error (${res.status}):`, data);
                return {
                    success: false,
                    error: data.error || `API trả về lỗi ${res.status}`,
                };
            }

            return {
                success: true,
                isNewUser: data.isNewUser,
                spinsRemaining: data.spinsRemaining,
                message: data.message,
            };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[event-gacha] Network error (attempt ${attempt + 1}/2):`, msg);

            // Retry once on network error
            if (attempt === 0) continue;

            return {
                success: false,
                error: `Không thể kết nối API: ${msg}`,
            };
        }
    }

    // Unreachable, but TypeScript needs it
    return { success: false, error: "Unexpected error" };
}

// ─── Gacha Roll Types ─────────────────────────────────────────────────────────

export interface GachaRollResult {
    success: boolean;
    status: "WON_VOUCHER" | "LUCK_NEXT_TIME" | "NO_SPINS_LEFT" | "ERROR";
    voucherCode?: string;
    campaignName?: string;
    rewardType?: string;
    rewardValue?: number;
    message?: string;
    error?: string;
}

// ─── Register + Gacha Roll ────────────────────────────────────────────────────

/**
 * Full flow: register customer → execute gacha roll → return voucher code.
 *
 * Since executeGacha is a Server Action in the ERP app, but both apps share
 * the same Firebase project, we call the REST API endpoint for the gacha roll.
 *
 * Flow:
 *  1. POST /api/v1/events/register → ensure customer exists + gets spins
 *  2. POST /api/v1/events/gacha   → execute the spin → get voucherCode
 *
 * If API returns LUCK_NEXT_TIME (rare per user's config), we return a placeholder.
 */
export async function registerAndClaimVoucher(
    input: EventRegisterInput
): Promise<GachaRollResult> {
    // Step 1: Register customer
    const regResult = await registerEventCustomer(input);
    if (!regResult.success) {
        return {
            success: false,
            status: "ERROR",
            error: regResult.error || "Registration failed",
        };
    }

    // Step 2: Execute gacha roll via REST API
    const gachaUrl = `${input.apiBaseUrl.replace(/\/$/, "")}/api/v1/events/gacha`;
    const gachaPayload = {
        eventId: input.eventId,
        customer: {
            phone: input.customer.phone,
            name: input.customer.fullName,
            dob: input.customer.dob || "2000-01-01",
            email: input.customer.email,
        },
    };

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(gachaUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(gachaPayload),
                signal: AbortSignal.timeout(15_000), // 15s — gacha may be slower
            });

            const data = await res.json();

            if (!res.ok) {
                console.error(`[event-gacha] Gacha API error (${res.status}):`, data);
                return {
                    success: false,
                    status: "ERROR",
                    error: data.error || `Gacha API trả về lỗi ${res.status}`,
                };
            }

            // Successful gacha roll
            if (data.status === "WON_VOUCHER" && data.prizeData) {
                return {
                    success: true,
                    status: "WON_VOUCHER",
                    voucherCode: data.prizeData.voucherCode,
                    campaignName: data.prizeData.campaignName,
                    rewardType: data.prizeData.rewardType,
                    rewardValue: data.prizeData.rewardValue,
                    message: data.message,
                };
            }

            // LUCK_NEXT_TIME or NO_SPINS_LEFT — return placeholder
            return {
                success: false,
                status: data.status || "LUCK_NEXT_TIME",
                message: data.message,
                error: "Không nhận được voucher. Vui lòng đến quầy để được hỗ trợ.",
            };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[event-gacha] Gacha network error (attempt ${attempt + 1}/2):`, msg);
            if (attempt === 0) continue;

            return {
                success: false,
                status: "ERROR",
                error: `Không thể kết nối API gacha: ${msg}`,
            };
        }
    }

    return { success: false, status: "ERROR", error: "Unexpected error" };
}
