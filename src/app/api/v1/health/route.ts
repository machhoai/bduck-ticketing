/**
 * GET /api/v1/health
 * Health check — no auth required.
 * POS system can poll this to verify connectivity.
 */
export async function GET() {
  return Response.json({
    ok: true,
    service: "B.Duck Cityfuns Ticket API",
    version: "1",
    timestamp: new Date().toISOString(),
  });
}
