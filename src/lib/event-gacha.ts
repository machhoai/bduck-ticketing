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
