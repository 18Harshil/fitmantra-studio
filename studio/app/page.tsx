"use client"

import { useState, useEffect } from "react"

interface PipEvent {
  timestamp: number
  duration: number
  pip_format: "pip" | "full"
  pip_source: string
  search_query: string
  pip_description: string
}

export default function Page() {
  const [pipEvents, setPipEvents] = useState<PipEvent[]>([])
  const [availableFiles, setAvailableFiles] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [previewKey, setPreviewKey] = useState(0)

  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState("")
  const [formError, setFormError] = useState("")
  const [brollUploadFile, setBrollUploadFile] = useState<File | null>(null)
  const [brollInputKey, setBrollInputKey] = useState(0)
  const [pipelineInputKey, setPipelineInputKey] = useState(0)

  const PIPELINE_URL = "http://localhost:8001"
  const [pipelineFile, setPipelineFile] = useState<File | null>(null)
  const [pipelineRunning, setPipelineRunning] = useState(false)
  const [pipelineSteps, setPipelineSteps] = useState<Record<number, {status: string; message: string; elapsed_sec: number; total_elapsed_sec: number}>>({})
  const [pipelineError, setPipelineError] = useState("")
  const [pipelineOpen, setPipelineOpen] = useState(false)

  const STEP_LABELS: Record<number, string> = {
    0: "Validating input",
    1: "Extracting audio",
    2: "Transcribing",
    3: "Analysing with AI",
    4: "Cleaning video",
    5: "Preparing brolls & finalizing",
  }

  const [form, setForm] = useState({
    pip_source: "",
    timestamp: "",
    duration: "",
    pip_format: "pip" as "pip" | "full",
    pip_description: "",
    search_query: "",
  })

  useEffect(() => { setMounted(true) }, [])

  async function loadBrolls() {
    const res = await fetch("/api/broll")
    const data = await res.json()
    setPipEvents(data.pip_events || [])
    setAvailableFiles(data.availableFiles || [])
  }

  useEffect(() => { loadBrolls() }, [])

  useEffect(() => {
    fetch(`${PIPELINE_URL}/api/status`).then(r => r.json()).then(s => {
      if (s.status === "running" || s.status === "waiting_for_approval") {
        setPipelineRunning(true)
        setPipelineOpen(true)
        connectPipelineSSE()
      }
    }).catch(() => {})
  }, [mounted])

  async function uploadFile(file: File) {
    setUploading(true)
    setUploadStatus("Uploading...")
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (data.success) {
        setUploadStatus(`Uploaded ${data.fileName}`)
        setBrollUploadFile(null)
        const brollRes = await fetch("/api/broll")
        const brollData = await brollRes.json()
        setAvailableFiles(brollData.availableFiles || [])
        setForm(f => ({ ...f, pip_source: `visuals/${data.fileName}` }))
      } else {
        setUploadStatus(`Error: ${data.error}`)
      }
    } catch (e: any) {
      setUploadStatus(`Error: ${e.message}`)
    }
    setUploading(false)
    setTimeout(() => setUploadStatus(""), 3000)
  }

  async function saveBroll() {
    setFormError("")
    if (!form.pip_source) { setFormError("Select a broll file"); return }
    if (!form.timestamp) { setFormError("Enter a timestamp"); return }
    const body = {
      ...form,
      timestamp: parseFloat(form.timestamp),
      duration: parseFloat(form.duration),
    }
    if (editIndex !== null) {
      await fetch("/api/broll", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: editIndex, ...body }),
      })
    } else {
      await fetch("/api/broll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    }
    resetForm()
    loadBrolls()
  }

  async function removeBroll(index: number) {
    await fetch(`/api/broll?index=${index}`, { method: "DELETE" })
    if (editIndex === index) resetForm()
    loadBrolls()
  }

  function editBroll(index: number) {
    const ev = pipEvents[index]
    setForm({
      pip_source: ev.pip_source,
      timestamp: String(ev.timestamp),
      duration: String(ev.duration),
      pip_format: ev.pip_format,
      pip_description: ev.pip_description,
      search_query: ev.search_query,
    })
    setEditIndex(index)
  }

  function resetForm() {
    setForm({ pip_source: "", timestamp: "", duration: "", pip_format: "pip", pip_description: "", search_query: "" })
    setEditIndex(null)
    setFormError("")
  }

  function connectPipelineSSE() {
    const es = new EventSource(`${PIPELINE_URL}/api/stream`)
    es.addEventListener("log", (e: MessageEvent) => {
      let p: any
      try { p = JSON.parse(e.data) } catch { return }
      setPipelineSteps(prev => {
        const cur = prev[p.step]
        if (cur && (cur.status === "done" || cur.status === "error") && p.status !== "complete") return prev
        return { ...prev, [p.step]: p }
      })
      if (p.status === "error") { setPipelineError(p.message || "Pipeline error"); es.close(); setPipelineRunning(false) }
      if (p.status === "waiting_for_approval") {
        es.close()
        fetch(`${PIPELINE_URL}/api/brolls`).then(r => r.json()).then(data => {
          const approvals = (data.pip_events || []).map((_: any, i: number) => ({ index: i, action: "approve" }))
          fetch(`${PIPELINE_URL}/api/brolls/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approvals }) })
        }).then(() => {
          connectPipelineSSE()
        }).catch(() => { setPipelineRunning(false) })
      }
      if (p.status === "complete") { es.close(); setPipelineRunning(false); loadBrolls(); setPreviewKey(k => k + 1) }
    })
    es.addEventListener("ping", () => {})
    es.onerror = () => { setPipelineError("Connection lost"); setPipelineRunning(false); es.close() }
  }

  async function runPipeline() {
    if (!pipelineFile) return
    setPipelineRunning(true)
    setPipelineError("")
    setPipelineSteps({})
    try {
      const fd = new FormData()
      fd.append("file", pipelineFile)
      const upRes = await fetch(`${PIPELINE_URL}/api/upload`, { method: "POST", body: fd })
      if (!upRes.ok) throw new Error("Upload failed")

      const stRes = await fetch(`${PIPELINE_URL}/api/start`, { method: "POST" })
      if (!stRes.ok) {
        let errMsg = ""
        try { const e = await stRes.json(); errMsg = e.detail || e.error || JSON.stringify(e) } catch { errMsg = await stRes.text() }
        throw new Error(errMsg || `Pipeline start failed (${stRes.status})`)
      }

      connectPipelineSSE()
    } catch (e: any) { setPipelineError(e.message); setPipelineRunning(false) }
  }

  function totalElapsed(steps: Record<number, any>): string {
    const vals = Object.values(steps)
    if (!vals.length) return ""
    const max = Math.max(...vals.map((v: any) => v.total_elapsed_sec || 0))
    return max > 0 ? `${max.toFixed(0)}s` : ""
  }

  function mediaUrl(fileName: string) {
    return `/api/media?file=${encodeURIComponent(fileName)}`
  }

  function getFileName(pipSource: string) {
    return pipSource.replace(/^visuals\//, "")
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a0a", color: "#eee" }}>
      {/* Video Preview */}
      <div style={{ width: "40%", display: "flex", flexDirection: "column", borderRight: "1px solid #222", padding: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#00ff88", margin: "0 0 8px 0" }}>Live Preview</h2>
        <div style={{ flex: 1, background: "#000", borderRadius: 12, overflow: "hidden" }}>
          {mounted && (
            <iframe
              key={previewKey}
              src="http://localhost:3001/MainVideo"
              style={{ width: "100%", height: "100%", border: "none" }}
              title="Remotion Preview"
            />
          )}
        </div>
      </div>

      {/* Broll Manager */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 16, overflow: "hidden" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#00ff88" }}>
          FitMantra Studio — Broll Manager
        </h1>

        {/* Pipeline */}
        <div style={{ background: "#111", borderRadius: 12, marginBottom: 16, border: "1px solid #333", flexShrink: 0, overflow: "hidden" }}>
          <div
            onClick={() => setPipelineOpen(!pipelineOpen)}
            style={{ padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", userSelect: "none" }}
          >
            <h3 style={{ margin: 0, fontSize: 14, color: pipelineRunning ? "#00ff88" : "#aaa" }}>
              {pipelineRunning ? "⏳ Pipeline Running..." : "🎬 Raw Video Pipeline"}
            </h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={async (e) => { e.stopPropagation(); await fetch("/api/pipeline/reset", { method: "POST" }); setPipelineRunning(false); setPipelineSteps({}); setPipelineError(""); setPipelineFile(null); setPipelineInputKey(k => k + 1) }}
                style={{ ...smallBtnStyle, background: "#2a1a1a", color: "#f88", padding: "2px 8px", fontSize: 10 }}
                title="Reset pipeline server if stuck"
              >Reset</button>
              <span style={{ color: "#555", fontSize: 12 }}>{pipelineOpen ? "▲" : "▼"}</span>
            </div>
          </div>
          {pipelineOpen && (
            <div style={{ padding: "0 16px 16px", borderTop: "1px solid #222" }}>
              <p style={{ fontSize: 11, color: "#666", margin: "10px 0" }}>
                Upload a raw speaker video. The pipeline will transcribe, analyse, clean, and prepare brolls automatically.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    key={pipelineInputKey}
                    type="file" accept=".mp4"
                    onChange={e => { setPipelineFile(e.target.files?.[0] || null); setPipelineOpen(true) }}
                    disabled={pipelineRunning}
                    style={{ flex: 1, fontSize: 12, color: "#ccc" }}
                  />
                  {pipelineFile && !pipelineRunning && (
                    <button
                      onClick={() => { setPipelineFile(null); setPipelineError(""); setPipelineSteps({}); setPipelineInputKey(k => k + 1) }}
                      style={{ ...smallBtnStyle, background: "#3a1a1a", color: "#f44", padding: "4px 8px" }}
                      title="Clear selected file"
                    >✕</button>
                  )}
                </div>
                <button
                  onClick={runPipeline}
                  disabled={pipelineRunning || !pipelineFile}
                  style={{
                    padding: "8px 16px", borderRadius: 6, border: "none",
                    background: pipelineRunning ? "#333" : "#00ff88",
                    color: pipelineRunning ? "#666" : "#000",
                    fontWeight: 600, fontSize: 12, cursor: pipelineRunning ? "wait" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pipelineRunning ? "Processing..." : "Process Video"}
                </button>
                {pipelineRunning && (
                  <button
                    onClick={() => { setPipelineRunning(false); setPipelineSteps({}); setPipelineFile(null) }}
                    style={{ ...smallBtnStyle, background: "#3a1a1a", color: "#f44", padding: "6px 12px" }}
                  >Cancel</button>
                )}
              </div>

              {/* Progress bar */}
              {pipelineRunning && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {[0, 1, 2, 3, 4, 5].map(s => {
                      const step = pipelineSteps[s]
                      const done = step?.status === "done" || step?.status === "complete"
                      const running = step?.status === "running"
                      const err = step?.status === "error"
                      return (
                        <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: err ? "#f55" : running ? "#00ff88" : done ? "#00ff8866" : "#222" }} />
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4, textAlign: "center" }}>
                    {totalElapsed(pipelineSteps) && `${totalElapsed(pipelineSteps)} elapsed`}
                  </div>
                </div>
              )}

              {/* Step details */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[0, 1, 2, 3, 4, 5].map(s => {
                  const step = pipelineSteps[s]
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: step ? ((step.status === "done" || step.status === "complete") ? "#4a4" : step.status === "error" ? "#f55" : "#ccc") : "#444" }}>
                      <span style={{ width: 14, textAlign: "center" }}>
                        {step?.status === "done" || step?.status === "complete" ? "✔" : step?.status === "error" ? "✘" : step?.status === "running" ? "●" : "○"}
                      </span>
                      <span style={{ flex: 1 }}>{STEP_LABELS[s]}</span>
                      {step?.elapsed_sec > 0 && <span style={{ color: "#666" }}>{step.elapsed_sec.toFixed(0)}s</span>}
                    </div>
                  )
                })}
              </div>

              {pipelineError && (
                <div style={{ color: "#f55", fontSize: 12, marginTop: 8, padding: 8, background: "#2a1111", borderRadius: 6 }}>
                  {pipelineError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upload Broll */}
        <div style={{ background: "#111", borderRadius: 12, padding: 16, marginBottom: 16, border: "1px solid #333", flexShrink: 0 }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 14, color: "#aaa" }}>Upload New Broll</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "center" }}>
              <input
                key={brollInputKey}
                type="file" accept=".mp4"
                onChange={e => setBrollUploadFile(e.target.files?.[0] || null)}
                disabled={uploading}
                style={{ flex: 1, fontSize: 12, color: "#ccc" }}
              />
              {brollUploadFile && !uploading && (
                <button
                  onClick={() => { setBrollUploadFile(null); setBrollInputKey(k => k + 1) }}
                  style={{ ...smallBtnStyle, background: "#3a1a1a", color: "#f44", padding: "4px 8px" }}
                  title="Clear selected file"
                >✕</button>
              )}
            </div>
            <button
              onClick={() => { if (brollUploadFile) uploadFile(brollUploadFile) }}
              disabled={uploading || !brollUploadFile}
              style={{
                padding: "8px 16px", borderRadius: 6, border: "none",
                background: uploading || !brollUploadFile ? "#333" : "#00ff88",
                color: uploading || !brollUploadFile ? "#666" : "#000",
                fontWeight: 600, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
          {uploadStatus && !uploading && (
            <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>{uploadStatus}</div>
          )}
        </div>

        {/* Add/Edit Form */}
        <div style={{ background: "#111", borderRadius: 12, padding: 16, marginBottom: 16, border: "1px solid #222", flexShrink: 0 }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 14, color: "#aaa" }}>
            {editIndex !== null ? `Edit Broll #${editIndex}` : "Add New Broll"}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <select
              value={form.pip_source}
              onChange={e => setForm(f => ({ ...f, pip_source: e.target.value }))}
              style={inputStyle}
            >
              <option value="">Select broll file...</option>
              {availableFiles.map(f => (
                <option key={f} value={`visuals/${f}`}>{f}</option>
              ))}
            </select>
            <input
              placeholder="Search query"
              value={form.search_query}
              onChange={e => setForm(f => ({ ...f, search_query: e.target.value }))}
              style={inputStyle}
            />
            <input
              placeholder="Timestamp (seconds)"
              type="number" step="0.1" min="0"
              value={form.timestamp}
              onChange={e => setForm(f => ({ ...f, timestamp: e.target.value }))}
              style={inputStyle}
            />
            <input
              placeholder="Duration (seconds)"
              type="number" step="0.1" min="0"
              value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
              style={inputStyle}
            />
            <select
              value={form.pip_format}
              onChange={e => setForm(f => ({ ...f, pip_format: e.target.value as "pip" | "full" }))}
              style={inputStyle}
            >
              <option value="pip">Picture-in-Picture</option>
              <option value="full">Full Screen</option>
            </select>
            <input
              placeholder="Description"
              value={form.pip_description}
              onChange={e => { setForm(f => ({ ...f, pip_description: e.target.value })); setFormError("") }}
              style={inputStyle}
            />
          </div>
          {formError && (
            <div style={{ color: "#f55", fontSize: 12, marginTop: 8 }}>{formError}</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={saveBroll} style={primaryBtnStyle}>
              {editIndex !== null ? "Update Broll" : "Add Broll"}
            </button>
            {editIndex !== null && (
              <button onClick={resetForm} style={secondaryBtnStyle}>Cancel</button>
            )}
          </div>
        </div>

        {/* Broll List */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <h3 style={{ fontSize: 14, color: "#aaa", margin: "0 0 8px 0" }}>
            Current Brolls ({pipEvents.length})
          </h3>
          {pipEvents.length === 0 && (
            <p style={{ color: "#555", fontSize: 13, textAlign: "center", marginTop: 40 }}>
              No brolls added yet. Select a file and fill the form above.
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pipEvents.map((ev, i) => (
              <div key={i} style={{
                display: "flex", gap: 12, padding: 12,
                background: "#111", borderRadius: 10, border: "1px solid #222", alignItems: "center",
              }}>
                <div style={{ width: 120, height: 68, borderRadius: 6, overflow: "hidden", background: "#000", flexShrink: 0 }}>
                  <video
                    src={mediaUrl(getFileName(ev.pip_source))}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    preload="metadata" muted
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#eee", marginBottom: 2 }}>
                    {ev.pip_description || getFileName(ev.pip_source)}
                  </div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    @{ev.timestamp}s · {ev.duration}s · {ev.pip_format === "full" ? "Full" : "PiP"}
                  </div>
                  <div style={{ fontSize: 10, color: "#555", marginTop: 2, wordBreak: "break-all" }}>
                    {ev.pip_source}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => editBroll(i)} style={{ ...smallBtnStyle, background: "#1a3a1a", color: "#4f4" }}>
                    Edit
                  </button>
                  <button onClick={() => removeBroll(i)} style={{ ...smallBtnStyle, background: "#3a1a1a", color: "#f44" }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 6, border: "1px solid #333",
  background: "#0a0a0a", color: "#eee", fontSize: 12, outline: "none",
}

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 20px", borderRadius: 6, border: "none",
  background: "#00ff88", color: "#000", fontWeight: 600, fontSize: 12, cursor: "pointer",
}

const secondaryBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle, background: "#222", color: "#aaa",
}

const smallBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 4, border: "none",
  fontSize: 11, fontWeight: 600, cursor: "pointer",
}
