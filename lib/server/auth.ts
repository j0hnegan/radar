import "server-only"
import crypto from "node:crypto"
import { HttpError } from "./http"

const COOKIE = "radar_session"
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

const isLocal = () => process.env.RADAR_LOCAL_DATA === "1" && process.env.NODE_ENV !== "production"

function password() {
  const p = process.env.BOARD_PASSWORD || (isLocal() ? "local-dev-password" : "")
  if (!p) throw new HttpError(500, "BOARD_PASSWORD is not set")
  return p
}

// The signing key comes from the password, so changing BOARD_PASSWORD signs everyone out.
function key() {
  return crypto.createHash("sha256").update("radar-session:" + password()).digest()
}

function safeEqual(a: string, b: string) {
  const ha = crypto.createHash("sha256").update(a).digest()
  const hb = crypto.createHash("sha256").update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}

function sign(payload: string) {
  return crypto.createHmac("sha256", key()).update(payload).digest("base64url")
}

function cookie(value: string, maxAge: number) {
  const parts = [`${COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${maxAge}`]
  if (!isLocal()) parts.push("Secure")
  return parts.join("; ")
}

export function sessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE
  const payload = `${exp}.${crypto.randomBytes(8).toString("base64url")}`
  return cookie(`${payload}.${sign(payload)}`, MAX_AGE)
}

export function clearedCookie() {
  return cookie("", 0)
}

function readCookie(req: Request, name: string) {
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=")
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return ""
}

export function hasSession(req: Request) {
  const value = readCookie(req, COOKIE)
  const parts = value.split(".")
  if (parts.length !== 3) return false
  const [exp, nonce, sig] = parts
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false
  return safeEqual(sig, sign(`${exp}.${nonce}`))
}

export function requireSession(req: Request) {
  if (!hasSession(req)) throw new HttpError(401, "Not signed in")
}

export function checkPassword(given: unknown) {
  return typeof given === "string" && safeEqual(given, password())
}

export function requireIngestKey(req: Request) {
  const k = process.env.INGEST_KEY || (isLocal() ? "local-dev-ingest-key-0123456789" : "")
  if (!k || k.length < 24) throw new HttpError(500, "INGEST_KEY is not set, or is shorter than 24 characters")
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)
  if (!m || !safeEqual(m[1].trim(), k)) throw new HttpError(401, "Bad or missing ingest key")
}
