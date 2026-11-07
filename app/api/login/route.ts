import { route, readJson, json } from "@/lib/server/http"
import { checkPassword, sessionCookie } from "@/lib/server/auth"

export const POST = route(async (req) => {
  const body = await readJson(req)
  if (!checkPassword(body.password)) {
    await new Promise((r) => setTimeout(r, 800)) // slow down guessing
    return json(401, { error: "Wrong password" })
  }
  return json(200, { ok: true }, { "Set-Cookie": sessionCookie() })
})
