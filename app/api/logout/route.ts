import { route, json } from "@/lib/server/http"
import { clearedCookie } from "@/lib/server/auth"

export const POST = route(async () => json(200, { ok: true }, { "Set-Cookie": clearedCookie() }))
