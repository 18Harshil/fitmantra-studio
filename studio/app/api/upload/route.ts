import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const ROOT = path.resolve(process.cwd(), "..")
const VISUALS_DIR = path.join(ROOT, "remotion", "public", "visuals")

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    if (!file.name.endsWith(".mp4")) {
      return NextResponse.json({ error: "Only .mp4 files are accepted" }, { status: 400 })
    }

    const fileName = file.name
    const filePath = path.join(VISUALS_DIR, fileName)

    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    return NextResponse.json({ success: true, fileName })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
