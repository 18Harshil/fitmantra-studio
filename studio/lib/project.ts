import { execSync } from "child_process"
import fs from "fs"
import path from "path"

const ROOT = path.resolve(process.cwd(), "..")
const DATA_PATH = path.join(ROOT, "remotion", "public", "remotion_data.json")

export function readProjectData(): object {
  const raw = fs.readFileSync(DATA_PATH, "utf-8")
  return JSON.parse(raw)
}

export function writeProjectData(data: object): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8")
}

export type EditOperation = {
  type: "set" | "push" | "remove"
  path: string[]
  value?: unknown
  index?: number
}

function isNumeric(v: string) { return /^\d+$/.test(v) }

function applyEdit(data: any, op: EditOperation): void {
  const { type, path: p, value, index } = op
  let obj = data
  for (let i = 0; i < p.length - 1; i++) {
    if (!obj[p[i]]) obj[p[i]] = {}
    obj = obj[p[i]]
  }
  const key = p[p.length - 1]
  switch (type) {
    case "set": {
      // Safety: if setting an array element to an object/array, merge/reject to prevent corruption
      const targetIsArrayElement = (p.length >= 2 && isNumeric(p[p.length - 2])) || isNumeric(key)
      if (targetIsArrayElement) {
        const existing = obj[key]
        if (Array.isArray(value)) {
          // LLM tried to replace whole element with an array — merge fields into first element
          obj[key] = { ...(typeof existing === "object" && existing !== null ? existing : {}), ...(value[0] || {}) }
        } else if (typeof value === "object" && value !== null && typeof existing === "object" && existing !== null && !Array.isArray(value) && !Array.isArray(existing)) {
          Object.assign(existing, value)
        } else {
          obj[key] = value
        }
      } else {
        obj[key] = value
      }
      break
    }
    case "push": {
      if (!Array.isArray(obj[key])) obj[key] = []
      obj[key].push(value)
      break
    }
    case "remove": {
      // If key is numeric and parent is array, remove by index from parent
      if (isNumeric(key) && Array.isArray(obj)) {
        const idx = index ?? parseInt(key, 10)
        obj.splice(idx, 1)
      } else if (Array.isArray(obj[key]) && index !== undefined) {
        obj[key].splice(index, 1)
      } else if (Array.isArray(obj)) {
        obj.splice(index ?? obj.length - 1, 1)
      } else {
        delete obj[key]
      }
      break
    }
  }
}

export function applyEdits(ops: EditOperation[]): object {
  const data = readProjectData()
  for (const op of ops) applyEdit(data, op)
  writeProjectData(data)
  return data
}

export function triggerRender(): string {
  const remotionDir = path.join(ROOT, "remotion")
  try {
    const out = execSync("npx remotion render src/index.ts MainVideo out/output.mp4 --overwrite", {
      cwd: remotionDir,
      timeout: 300_000,
      encoding: "utf-8",
    })
    return out
  } catch (e: any) {
    return `Render failed:\n${e.stderr || e.message}`
  }
}
