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

// ─── Register + REST Gacha ────────────────────────────────────────────────────

/**
 * Full flow: register customer via REST → run gacha via REST.
 *
 * Both REST endpoints live on the ERP server (employee.joyworld.vn).
 * The ticketing app uses a DIFFERENT Firebase project from ERP,
 * so direct Firestore access won't work — we must call the ERP's
 * REST API wrapper around executeGacha.
 */
export async function registerAndClaimVoucher(
    input: EventRegisterInput
): Promise<GachaRollResult> {
    // Step 1: Register customer via REST API (creates participation + grants spins)
    const regResult = await registerEventCustomer(input);
    if (!regResult.success) {
        console.error("[event-gacha] Registration failed:", regResult.error);
        // Don't abort — try gacha anyway (customer might already exist)
    }

    // Step 2: Execute gacha roll via REST API on ERP server
    const url = `${input.apiBaseUrl.replace(/\/$/, "")}/api/v1/events/gacha`;

    const payload = {
        eventId: input.eventId,
        customer: {
            phone: input.customer.phone,
            fullName: input.customer.fullName,
            dob: input.customer.dob || "2000-01-01",
            email: input.customer.email,
        },
        source: input.source || "bduck_ticketing",
    };

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            console.log(`[event-gacha] Calling gacha REST API: ${url} (attempt ${attempt + 1})`);

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(15_000), // 15s timeout (gacha transaction can be slow)
            });

            const data = await res.json();
            console.log(`[event-gacha] Gacha API response:`, JSON.stringify(data));

            if (!res.ok) {
                return {
                    success: false,
                    status: "ERROR",
                    error: data.error || `HTTP ${res.status}`,
                };
            }

            // Map ERP's GachaResult to our GachaRollResult
            return {
                success: data.success ?? false,
                status: data.status || "ERROR",
                voucherCode: data.prizeData?.voucherCode || undefined,
                campaignName: data.prizeData?.campaignName || undefined,
                rewardType: data.prizeData?.rewardType || undefined,
                rewardValue: data.prizeData?.rewardValue || undefined,
                message: data.message || undefined,
                error: data.error || data.message || undefined,
            };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[event-gacha] REST gacha attempt ${attempt + 1} failed:`, msg);

            if (attempt === 0) continue; // retry once

            return {
                success: false,
                status: "ERROR",
                error: `Không thể kết nối API gacha: ${msg}`,
            };
        }
    }

    // Unreachable, but TypeScript needs it
    return { success: false, status: "ERROR", error: "Unexpected error" };
}

