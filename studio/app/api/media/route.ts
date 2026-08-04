import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const ROOT = path.resolve(process.cwd(), "..")
const VISUALS_DIR = path.join(ROOT, "remotion", "public", "visuals")

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file")
  if (!file) return new NextResponse("Missing file param", { status: 400 })

  const safeName = path.basename(file)
  const filePath = path.join(VISUALS_DIR, safeName)
  if (!fs.existsSync(filePath)) return new NextResponse("File not found", { status: 404 })

  const stat = fs.statSync(filePath)
  const range = req.headers.get("range")

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-")
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1
    const chunkSize = end - start + 1
    const buf = Buffer.alloc(chunkSize)
    const fd = fs.openSync(filePath, "r")
    fs.readSync(fd, buf, 0, chunkSize, start)
    fs.closeSync(fd)
    return new NextResponse(buf, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": "video/mp4",
      },
    })
  }

  const content = fs.readFileSync(filePath)
  return new NextResponse(content, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    },
  })
}
