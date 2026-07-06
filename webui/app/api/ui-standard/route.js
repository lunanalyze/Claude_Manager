import { NextResponse } from "next/server";
import { readSelections, writeSelection, selectionStatus } from "@/lib/ui-standard";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(selectionStatus());
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { element, candidate } = body ?? {};
  if (!element || !candidate) {
    return NextResponse.json({ error: "element·candidate 필요" }, { status: 400 });
  }
  try {
    writeSelection(element, candidate);
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 400 });
  }
  return NextResponse.json(selectionStatus());
}
