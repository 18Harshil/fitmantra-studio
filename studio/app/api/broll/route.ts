import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { execSync } from "child_process"
import { readProjectData, writeProjectData } from "@/lib/project"

const ROOT = path.resolve(process.cwd(), "..")
const VISUALS_DIR = path.join(ROOT, "remotion", "public", "visuals")

function getVideoDuration(filePath: string): number {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: "utf-8", timeout: 10000 }
    )
    const dur = parseFloat(out.trim())
    return isNaN(dur) ? 5 : dur
  } catch {
    return 5
  }
}

export async function GET() {
  const data = readProjectData() as any
  const files = fs.readdirSync(VISUALS_DIR).filter(f => f.endsWith(".mp4"))
  return NextResponse.json({
    pip_events: data.pip_events || [],
    availableFiles: files,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const data = readProjectData() as any
  if (!data.pip_events) data.pip_events = []

  let duration = body.duration
  if (!duration || duration <= 0) {
    const filePath = path.join(VISUALS_DIR, path.basename(body.pip_source))
    duration = getVideoDuration(filePath)
  }

  data.pip_events.push({
    timestamp: body.timestamp,
    duration,
    pip_format: body.pip_format || "pip",
    pip_source: body.pip_source,
    search_query: body.search_query || "",
    pip_description: body.pip_description || "",
  })
  writeProjectData(data)
  return NextResponse.json({ success: true, pip_events: data.pip_events })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const data = readProjectData() as any
  const idx = body.index
  if (!data.pip_events || idx < 0 || idx >= data.pip_events.length) {
    return NextResponse.json({ error: "Invalid index" }, { status: 400 })
  }

  let duration = body.duration
  if (!duration || duration <= 0) {
    const filePath = path.join(VISUALS_DIR, path.basename(body.pip_source))
    duration = getVideoDuration(filePath)
  }

  Object.assign(data.pip_events[idx], {
    timestamp: body.timestamp,
    duration,
    pip_format: body.pip_format,
    pip_source: body.pip_source,
    search_query: body.search_query,
    pip_description: body.pip_description,
  })
  writeProjectData(data)
  return NextResponse.json({ success: true, pip_events: data.pip_events })
}

export async function DELETE(req: NextRequest) {
  const index = parseInt(req.nextUrl.searchParams.get("index") || "", 10)
  const data = readProjectData() as any
  if (isNaN(index) || !data.pip_events || index < 0 || index >= data.pip_events.length) {
    return NextResponse.json({ error: "Invalid index" }, { status: 400 })
  }
  data.pip_events.splice(index, 1)
  writeProjectData(data)
  return NextResponse.json({ success: true, pip_events: data.pip_events })
}
