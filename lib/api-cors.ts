import { NextResponse } from "next/server";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(corsHeaders)) {
    res.headers.set(k, v);
  }
  return res;
}

export function corsJson(data: unknown, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(data, init);
  return withCors(res);
}

export function handleOptions(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}
