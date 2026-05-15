import "server-only";
import { PayOS } from "@payos/node";

// ─── PayOS Server-Side Singleton ──────────────────────────────────────────────
// Lazily initialized to avoid import-time errors when env vars are missing.

let _payos: InstanceType<typeof PayOS> | null = null;

export function getPayOS(): InstanceType<typeof PayOS> {
  if (!_payos) {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

    if (!clientId || !apiKey || !checksumKey) {
      throw new Error(
        "[PayOS] Missing env vars: PAYOS_CLIENT_ID, PAYOS_API_KEY, or PAYOS_CHECKSUM_KEY"
      );
    }

    _payos = new PayOS({ clientId, apiKey, checksumKey });
  }

  return _payos;
}
