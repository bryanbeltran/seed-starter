import { NextResponse } from "next/server";
import { openApiSpec } from "@/api/openapi";
import { apiRoute } from "@/lib/apiRoute";

export const GET = apiRoute("openapi", async () => {
  return NextResponse.json(openApiSpec);
}, { limit: 120 });
