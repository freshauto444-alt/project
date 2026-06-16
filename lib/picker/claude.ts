// ═══════════════════════════════════════════════════════════════════════════════
//  Claude API wrapper for the chat route. The systemPrompt is passed IN — this
//  module holds only the transport (model id, caching, timeout, error logging),
//  not any prompt text. Extracted from route.ts.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ChatMessage } from "./types"

export async function callClaude(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<string> {
  // Trim chat history to last 12 messages to avoid huge payloads
  const trimmedMessages = messages.slice(-12)

  if (!process.env.ANTHROPIC_API_KEY) {
    const { logError } = await import("@/lib/logger")
    await logError({ source: "ai", level: "error", msg: "ANTHROPIC_API_KEY missing", details: { endpoint: "ai-picker/route" } })
    return ""
  }

  // User wants ≤ 10s responses. Sonnet 4.6 with thinking disabled + effort=low
  // finishes conversational chat in 3-8s. 15s is a firm ceiling for timeouts.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        // System prompt is ~1500 tokens of stable text (rules, market context,
        // funnel scripts). Wrap it in a content block with cache_control so
        // Anthropic caches the prefix for 5 min — repeat calls within that window
        // pay 0.1× input cost on the cached portion (~90% savings).
        system: [
          { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
        ],
        messages: trimmedMessages.map(m => ({ role: m.role, content: m.content })),
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      const { logError } = await import("@/lib/logger")
      await logError({
        source: "ai",
        level: "error",
        msg: `Claude HTTP ${res.status}`,
        details: { body: body.slice(0, 500), endpoint: "ai-picker/route" },
      })
      return ""
    }

    const data = await res.json()
    if (data.error) {
      const { logError } = await import("@/lib/logger")
      await logError({
        source: "ai",
        level: "error",
        msg: `Claude API error: ${data.error.type}`,
        details: { message: data.error.message, endpoint: "ai-picker/route" },
      })
      return ""
    }
    // With adaptive thinking, content[0] is a `thinking` block. Find the text block.
    const textBlock = data.content?.find((b: any) => b?.type === "text")
    return textBlock?.text?.trim() ?? ""
  } catch (e: any) {
    const isTimeout = e?.name === "AbortError"
    const { logError } = await import("@/lib/logger")
    await logError({
      source: "ai",
      level: "error",
      msg: isTimeout ? "Claude timeout (15s)" : `Claude request failed: ${e?.message ?? e}`,
      stack: e?.stack,
      details: { endpoint: "ai-picker/route" },
    })
    return ""
  } finally {
    clearTimeout(timeout)
  }
}
