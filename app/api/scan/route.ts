import { extractEpcFromBody, recordScan } from "@/lib/scans";
import { corsJson, handleOptions } from "@/lib/api-cors";

export const runtime = "nodejs";

export function OPTIONS() {
  return handleOptions();
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return corsJson({ success: false, epc: "" }, { status: 400 });
  }

  const epc = extractEpcFromBody(body);
  if (!epc) {
    return corsJson({ success: false, epc: "" }, { status: 400 });
  }

  try {
    const result = await recordScan(epc);
    if (!result.success) {
      return corsJson({ success: false, epc }, { status: 400 });
    }
    return corsJson({ success: true, epc });
  } catch (e) {
    console.error("[POST /api/scan]", e);
    return corsJson({ success: false, epc }, { status: 500 });
  }
}
