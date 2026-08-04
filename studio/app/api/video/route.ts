import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const ROOT = path.resolve(process.cwd(), "..")
const RENDER_OUT = path.join(ROOT, "remotion", "out", "MainVideo.mp4")
const DATA_FILE = path.join(ROOT, "remotion", "public", "remotion_data.json")
const FALLBACK = path.join(ROOT, "remotion", "public", "visuals", "input.mp4")

export async function GET() {
  let file = RENDER_OUT
  if (!fs.existsSync(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))
      file = path.join(ROOT, "remotion", "public", data?.video?.src ?? "visuals/input.mp4")
    } catch {
      file = FALLBACK
    }
  }
  if (!fs.existsSync(file)) {
    return new NextResponse("No video found", { status: 404 })
  }
  const stat = fs.statSync(file)
  const content = fs.readFileSync(file)
  return new NextResponse(content, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  })
}
