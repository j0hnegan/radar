import "server-only"

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  })
}

const MAX_BODY = 1024 * 1024

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const ct = (req.headers.get("content-type") || "").toLowerCase()
  // JSON-only POSTs: a cheap CSRF guard on top of SameSite=Strict cookies.
  if (!ct.startsWith("application/json")) throw new HttpError(415, "Send JSON (Content-Type: application/json)")
  const len = Number(req.headers.get("content-length") || 0)
  if (len > MAX_BODY) throw new HttpError(413, "Body too large")
  const text = await req.text()
  if (text.length > MAX_BODY) throw new HttpError(413, "Body too large")
  if (!text) return {}
  try {
    const v = JSON.parse(text)
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error()
    return v
  } catch {
    throw new HttpError(400, "Invalid JSON body")
  }
}

export function route(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req)
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.status >= 500 ? "Server error: " + err.message : err.message })
      // Let Next.js handle its own control-flow errors (prerender bail-outs and the like).
      if (err && typeof err === "object" && "digest" in err) throw err
      console.error(err)
      return json(500, { error: "Server error" })
    }
  }
}
