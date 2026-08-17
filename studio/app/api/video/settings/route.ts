import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const ROOT = path.resolve(process.cwd(), "..")
const DATA_FILE = path.join(ROOT, "remotion", "public", "remotion_data.json")

function readData(): any {
  const raw = fs.readFileSync(DATA_FILE, "utf8")
  return JSON.parse(raw.replace(/^\uFEFF/, ""))
}

function writeData(data: any) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8")
}

export async function GET() {
  try {
    const data = readData()
    return NextResponse.json({
      video_filter: data?.video?.video_filter ?? "brightness(1.15) contrast(1.2)",
      captions_offset: data?.captions_offset ?? 0,
    })
  } catch {
    return NextResponse.json({ video_filter: "brightness(1.15) contrast(1.2)", captions_offset: 0 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const data = readData()
    if (!data.video) data.video = {}
    if (typeof body.video_filter === "string") data.video.video_filter = body.video_filter
    if (typeof body.captions_offset === "number") data.captions_offset = body.captions_offset
    writeData(data)
    return NextResponse.json({ success: true, video_filter: data.video.video_filter, captions_offset: data.captions_offset })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
