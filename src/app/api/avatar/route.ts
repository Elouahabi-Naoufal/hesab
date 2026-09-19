import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/server/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const filePath = path.join(process.cwd(), "data", "avatars", `${session.userId}.png`);
  try {
    const data = fs.readFileSync(filePath);
    return new NextResponse(data, {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}