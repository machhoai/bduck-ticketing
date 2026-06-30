const MAX_CODE_LENGTH = 128;
const MAX_JSON_BODY_BYTES = 4096;

export function validateCode(code: string, label = "code"): Response | null {
  if (!code) {
    return Response.json(
      { success: false, error: "MISSING_CODE", message: `Missing required query param: ${label}` },
      { status: 400 }
    );
  }

  if (code.length > MAX_CODE_LENGTH) {
    return Response.json(
      { success: false, error: "CODE_TOO_LONG", message: `${label} must be ${MAX_CODE_LENGTH} characters or less` },
      { status: 400 }
    );
  }

  return null;
}

export function validateJsonBodySize(req: Request): Response | null {
  const contentLength = req.headers.get("content-length");
  if (!contentLength) return null;

  const bytes = Number(contentLength);
  if (!Number.isFinite(bytes) || bytes <= MAX_JSON_BODY_BYTES) return null;

  return Response.json(
    { success: false, error: "PAYLOAD_TOO_LARGE", message: `JSON body must be ${MAX_JSON_BODY_BYTES} bytes or less` },
    { status: 413 }
  );
}

export function serverErrorResponse(tag: string, err: unknown): Response {
  console.error(tag, err);
  return Response.json(
    { success: false, error: "SERVER_ERROR", message: "Loi he thong, vui long thu lai" },
    { status: 500 }
  );
}

