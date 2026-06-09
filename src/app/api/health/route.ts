import { NextResponse } from "next/server";
import { cropIds, varietyCount } from "@/planning";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: process.env.npm_package_version ?? "0.1.0",
    crops: cropIds.length,
    varieties: varietyCount(),
  });
}
