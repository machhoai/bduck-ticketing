/**
 * Verifies the INTERNAL_API_KEY from Authorization: Bearer <key> header.
 * Used by POS integration endpoints (/api/v1/...).
 *
 * Key is stored in INTERNAL_API_KEY env variable.
 * Generate a secure key: openssl rand -hex 32
 */
export function verifyApiKey(req: Request): boolean {
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!apiKey) {
    // Misconfigured — deny all requests rather than allowing open access
    console.error("[verifyApiKey] INTERNAL_API_KEY is not set");
    return false;
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");

  return scheme === "Bearer" && token === apiKey;
}

/** Standard 401 response for unauthenticated API requests. */
export function unauthorizedResponse(): Response {
  return Response.json(
    { success: false, error: "Unauthorized — invalid or missing API key" },
    {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer realm=\"B.Duck POS API\"" },
    }
  );
}
