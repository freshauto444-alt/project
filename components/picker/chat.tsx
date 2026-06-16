"use client"

// ═══════════════════════════════════════════════════════════════════════════════
//  AIChat — the conversational picker chat (+ SearchingBanner). Extracted from
//  unified-picker. Renders ResultCard-free; the orchestrator/ResultsScreen wires
//  the found cars. NOTE: prompt/UX copy lives in the route, not here.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { RotateCcw, Send, Sparkles } from "lucide-react"
import { type Car as CarType } from "@/lib/data"
import { t, tp } from "@/lib/i18n"
import { useSettings } from "@/lib/settings-context"
import {
  mapApiCar, makeUuid, buildTags,
  type Answer, type ChatMessage, type RetrySuggestion,
} from "./shared"

function SearchingBanner() {
  const { language } = useSettings()
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState(tp("status_connecting", language))

  const steps = [
    { at: 5,  text: tp("status_as24", language) },
    { at: 25, text: tp("status_reviewing", language) },
    { at: 45, text: tp("status_blocket", language) },
    { at: 65, text: tp("status_mobilede", language) },
    { at: 80, text: tp("status_scoring", language) },
    { at: 92, text: tp("status_ranking", language) },
  ]

  useEffect(() => {
    let current = 0
    const interval = setInterval(() => {
      // Повільно росте до 95, останні % чекає реальної відповіді
      const increment = current < 60 ? 1.2 : current < 85 ? 0.5 : 0.15
      current = Math.min(current + increment, 95)
      setProgress(current)
      const step = [...steps].reverse().find(s => current >= s.at)
      if (step) setStatusText(step.text)
    }, 800)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 rounded-2xl border border-primary/15 bg-primary/[0.03] p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.2 }}
                className="block h-1.5 w-1.5 rounded-full bg-primary"
              />
            ))}
          </div>
          <span className="text-sm text-white/70">{statusText}</span>
        </div>
        <span className="text-[11px] text-primary/60">{Math.round(progress)}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      <p className="text-[11px] text-white/25">{tp("banner_hint", language)}</p>
    </motion.div>
  )
}

// ─── AIChat (замінити ТІЛЬКИ цей компонент в unified-picker.tsx) ──────────────

export function AIChat({
  answers,
  cars,
  onNewCars,
  onPrefsChange,
  freeText,
  approvedSuggestion,
  rejectedSuggestions,
}: {
  answers: Answer[]
  cars: CarType[]
  onNewCars: (cars: CarType[]) => void
  onPrefsChange?: (prefs: any) => void
  // Journey context — what the user told us up to this point, so the chat
  // doesn't ask things we already know.
  freeText?: string
  approvedSuggestion?: { make: string; model: string; yearRange: string; whyRecommended: string } | null
  rejectedSuggestions?: { make: string; model: string }[]
}) {
  const { language } = useSettings()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [clientOrderId, setClientOrderId] = useState<string | null>(null)
  const [chatPreferences, setChatPreferences] = useState<any>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length > 1) return
    const tags = buildTags(answers)
    let intro: string
    if (approvedSuggestion && language === "uk") {
      // Reference the picked card so the chat picks up where the picker left
      // off instead of acting like a stranger. whyRecommended is the AI's own
      // earlier reasoning — repeating it confirms continuity.
      const why = approvedSuggestion.whyRecommended?.split(/[.!?]/)[0]?.trim()
      intro = `Бачу, обрали ${approvedSuggestion.make} ${approvedSuggestion.model} (${approvedSuggestion.yearRange}). ${
        why ? why + ". " : ""
      }Знайдено ${cars.length} варіантів. Можу заглибитись у конкретне авто, порівняти з альтернативою або підстроїти підбір — що цікаво?`
    } else if (approvedSuggestion) {
      intro = `Picked ${approvedSuggestion.make} ${approvedSuggestion.model} (${approvedSuggestion.yearRange}). ${cars.length} matches. Want a deep dive, a comparison, or to refine?`
    } else if (tags.length > 0) {
      intro = language === "uk"
        ? `Знайдено ${cars.length} варіантів за вашими критеріями (${tags.slice(0, 3).join(", ")}${tags.length > 3 ? " та інші" : ""}).${
            cars.length === 0
              ? " Можу запустити пошук на європейських майданчиках — зазвичай знаходжу 15-30 свіжих варіантів. Скажіть що шукаєте."
              : " Можу детально розповісти про будь-яке авто або уточнити підбір."
          }`
        : `Found ${cars.length} matches for your criteria (${tags.slice(0, 3).join(", ")}${tags.length > 3 ? " and more" : ""}).${
            cars.length === 0
              ? " I can search European marketplaces — usually 15-30 fresh options. Tell me what you need."
              : " I can dive into any car or refine the selection."
          }`
    } else {
      intro = tp("chat_intro", language)
    }
    setMessages([{ role: "assistant", content: intro }])
  }, [cars.length, language, approvedSuggestion])

  useEffect(() => {
    const el = messagesContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading, searching])

  // Compact journey-context blob — passed with every chat-side request so
  // the server prompt knows what the user told us before reaching the chat.
  // Keeps server payload stable and easy to drop into a single prompt block.
  const journey = {
    freeText: freeText?.trim() || null,
    approvedSuggestion: approvedSuggestion ?? null,
    rejectedSuggestions: rejectedSuggestions ?? [],
  }

  // Запуск парсера з передачею chatPreferences
  const runSearch = async (orderId: string, fullMessages: ChatMessage[]) => {
    setSearching(true)
    try {
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: fullMessages,
          answers,
          cars: [],
          triggerSearch: true,
          clientOrderId: orderId,
          chatPreferences, // Pass previous preferences for cumulative search
          journey,
          prevCount: cars.length, // so the assistant can admit when results didn't change
        }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: "assistant", content: data.message, retrySuggestion: data.retrySuggestion ?? null }])
      if (data.chatPreferences) { setChatPreferences(data.chatPreferences); onPrefsChange?.(data.chatPreferences) }
      onNewCars((data.cars ?? []).map(mapApiCar))
    } catch {
      setMessages(m => [
        ...m,
        { role: "assistant", content: tp("chat_error", language) + " " + tp("chat_retry", language) },
      ])
    } finally {
      setSearching(false)
    }
  }

  // Apply AI-suggested adjustment + re-run search
  const applyRetrySuggestion = async (sug: RetrySuggestion) => {
    if (searching || loading) return
    const nextPrefs = { ...(chatPreferences ?? {}), ...sug.prefs }
    setChatPreferences(nextPrefs)
    onPrefsChange?.(nextPrefs)
    const ackMsg: ChatMessage = { role: "user", content: `Застосувати: ${sug.label}` }
    const next: ChatMessage[] = [...messages, ackMsg]
    setMessages(next)
    setSearching(true)
    try {
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          answers,
          cars: [],
          triggerSearch: true,
          clientOrderId: clientOrderId ?? makeUuid(),
          chatPreferences: nextPrefs,
          journey,
        }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: "assistant", content: data.message, retrySuggestion: data.retrySuggestion ?? null }])
      if (data.chatPreferences) { setChatPreferences(data.chatPreferences); onPrefsChange?.(data.chatPreferences) }
      onNewCars((data.cars ?? []).map(mapApiCar))
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Не вдалося перешукати. Спробуйте ще раз." }])
    } finally {
      setSearching(false)
    }
  }

  const send = async () => {
    if (!input.trim() || loading || searching) return
    const text = input.trim()
    setInput("")
    const next: ChatMessage[] = [...messages, { role: "user", content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          answers,
          cars: cars.slice(0, 8),
          chatPreferences, // Always pass current preferences
          journey,
        }),
      })
      const data = await res.json()

      // Update preferences if returned
      if (data.chatPreferences) { setChatPreferences(data.chatPreferences); onPrefsChange?.(data.chatPreferences) }

      // AI decided to search
      if (data.searching && data.clientOrderId) {
        setMessages(m => [...m, { role: "assistant", content: data.message, retrySuggestion: data.retrySuggestion ?? null }])
        setClientOrderId(data.clientOrderId)
        runSearch(data.clientOrderId, next)
        return
      }

      setMessages(m => [
        ...m,
        { role: "assistant", content: data.message ?? tp("chat_retry", language), retrySuggestion: data.retrySuggestion ?? null },
      ])
    } catch {
      setMessages(m => [
        ...m,
        { role: "assistant", content: "Сталася помилка. Спробуйте ще раз." },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white/[0.015]">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-primary/18 bg-primary/[0.07]">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">AI-консультант Fresh Auto</div>
          <div className="flex items-center gap-1 text-[10px] text-white/22">
            <motion.span
              animate={{ opacity: searching ? [0.4, 1, 0.4] : 1 }}
              transition={{ duration: 1.2, repeat: searching ? Infinity : 0 }}
              className={`h-1.5 w-1.5 rounded-full ${searching ? "bg-amber-400" : "bg-primary/55"}`}
            />
            {searching ? tp("chat_status_searching", language) : tp("chat_status_online", language)}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex max-h-72 flex-col gap-2.5 overflow-y-auto p-4 scrollbar-thin"
      >
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="flex max-w-[88%] flex-col gap-1.5">
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-tr-sm bg-primary/[0.07] text-primary"
                    : "rounded-tl-sm bg-white/[0.04] text-white/70"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "assistant" && msg.retrySuggestion && (
                <button
                  onClick={() => applyRetrySuggestion(msg.retrySuggestion!)}
                  disabled={loading || searching}
                  className="group flex items-center gap-2 self-start rounded-xl border border-primary/30 bg-primary/[0.08] px-3 py-2 text-[12px] font-medium text-primary transition-all hover:border-primary/60 hover:bg-primary/[0.14] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
                  Перешукати: {msg.retrySuggestion.label}
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {loading && !searching && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white/[0.04] px-3.5 py-3">
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                  className="block h-1.5 w-1.5 rounded-full bg-white/35"
                />
              ))}
            </div>
          </div>
        )}

        {searching && <SearchingBanner />}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          disabled={searching}
          placeholder={searching ? tp("chat_status_searching", language) : tp("chat_placeholder", language)}
          className="flex-1 rounded-xl border border-border bg-white/[0.025] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/35 outline-none transition-all focus:border-primary/22 disabled:opacity-40"
        />
        <motion.button
          whileTap={{ scale: 0.91 }}
          onClick={send}
          disabled={!input.trim() || loading || searching}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all cursor-pointer ${
            input.trim() && !loading && !searching
              ? "bg-primary/[0.08] text-primary hover:bg-primary/[0.15]"
              : "bg-white/[0.03] text-white/15"
          }`}
        >
          <Send className="h-3.5 w-3.5" />
        </motion.button>
      </div>
    </div>
  )
}
