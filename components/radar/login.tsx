"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBoard } from "./use-board"
import { RadarMark } from "./radar-app"

export function Login() {
  const { login } = useBoard()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <div className="bg-muted/40 grid min-h-dvh place-items-center p-4">
      <form
        className="bg-card w-full max-w-sm rounded-2xl border p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError("")
          try {
            await login(password)
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't sign in")
            setBusy(false)
          }
        }}
      >
        <div className="mb-5 flex items-center gap-2">
          <RadarMark className="text-brand size-7" />
          <span className="text-lg font-semibold tracking-tight">Radar</span>
        </div>
        <p className="text-muted-foreground mb-4 text-sm">Your private job board. Enter the board password.</p>
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
        <Button className="mt-3 w-full" disabled={busy || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-destructive mt-2 min-h-5 text-sm" role="alert">
          {error}
        </p>
      </form>
    </div>
  )
}
