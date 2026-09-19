import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!userId) return NextResponse.json({ error: "Missing user ID" }, { status: 400 });

  const filePath = path.join(process.cwd(), "data", "avatars", `${userId}.png`);
  try {
    const data = fs.readFileSync(filePath);
    return new NextResponse(data, {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}