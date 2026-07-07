import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface GuideStep {
  urlPattern: string;
  selector: string;
  message: string;
  position?: string;
}

interface GuideDefinition {
  id: string;
  title: string;
  description?: string;
  steps: GuideStep[];
}

interface GuideStepsFile {
  guides: GuideDefinition[];
}

async function loadGuides(): Promise<GuideStepsFile> {
  const filePath = path.join(process.cwd(), "src/data/ebay-guide/guide-steps.json");
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as GuideStepsFile;
}

export async function GET(request: NextRequest) {
  try {
    const guideId = request.nextUrl.searchParams.get("guideId")?.trim() || "hunting-basics";
    const data = await loadGuides();
    const guide = data.guides.find((item) => item.id === guideId);

    if (!guide) {
      return NextResponse.json({ error: "Guide not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      guideId: guide.id,
      title: guide.title,
      description: guide.description ?? null,
      steps: guide.steps,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load guide steps.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
