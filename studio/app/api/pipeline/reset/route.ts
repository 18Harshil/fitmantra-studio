import { NextResponse } from "next/server"
import { execSync } from "child_process"

export async function POST() {
  try {
    // Kill existing python pipeline process on port 8001
    execSync("Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Where-Object { $_ -gt 0 } | Stop-Process -Force -ErrorAction SilentlyContinue", { shell: "powershell", timeout: 5000 })
    // Small delay then restart
    execSync('$env:KMP_DUPLICATE_LIB_OK="TRUE"; $env:PYTHONIOENCODING="utf-8"; Start-Process -WindowStyle Hidden -FilePath "C:\\Users\\Harshil\\miniconda3\\python.exe" -ArgumentList "-u","C:\\Users\\Harshil\\Downloads\\fitmantra-video-pipeline\\fitmantra-video-pipeline\\pipeline\\server.py"', { shell: "powershell", timeout: 5000 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
