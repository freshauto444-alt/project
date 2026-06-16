"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Sparkles } from "lucide-react"
import { type Car as CarType } from "@/lib/data"
import { useSettings } from "@/lib/settings-context"
import {
  mapApiCar, streamSearch, makeUuid,
  EMPTY_ANSWERS,
  type Answer,
} from "./picker/shared"
import { SuggestionsScreen, type Suggestion } from "./picker/suggestions"
import { AllFiltersForm } from "./picker/filters-form"
import { ResultsScreen } from "./picker/results"

// ─── Main export ──────────────────────────────────────────────────────────────

type Phase = "form" | "suggestions" | "results"

export default function UnifiedPicker({ onSelectCar }: { onSelectCar: (car: CarType) => void }) {
  const { language } = useSettings()
  const [answers, setAnswers] = useState<Answer[]>(EMPTY_ANSWERS)
  const [freeText, setFreeText] = useState("")
  const [results, setResults] = useState<CarType[]>([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [phase, setPhase] = useState<Phase>("form")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [approvedIndices, setApprovedIndices] = useState<Set<number>>(new Set())
  const [searchingIndex, setSearchingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aiUnavailable, setAiUnavailable] = useState(false)
  const [userBudget, setUserBudget] = useState<{ min?: number; max?: number }>({})
  // Set when the suggest stream reports the request is infeasible at the given
  // budget (every pick over budget) — drives the honest "over budget → under-
  // order / widen" banner. NOT triggered by thin parse-history coverage anymore.
  const [thinInfo, setThinInfo] = useState<{ reason?: string; shown: number } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // T9 learning loop: one session id per picker mount + fire-and-forget event
  // logging. Never awaited, never throws — telemetry must not affect the UX.
  const sessionIdRef = useRef<string>(makeUuid())
  const logPickerEvent = useCallback((kind: string, extra: Record<string, unknown>) => {
    try {
      fetch("/api/ai-picker/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ kind, session_id: sessionIdRef.current, ...extra }),
      }).catch(() => {})
    } catch { /* ignore */ }
  }, [])

  const updateAnswer = useCallback((idx: number, ans: Answer) => {
    setAnswers(prev => prev.map((a, i) => (i === idx ? ans : a)))
  }, [])

  // ── Step 1: After questionnaire → get AI suggestions ──────────────────
  const fetchSuggestions = useCallback(async (finalAnswers: Answer[]) => {
    setPhase("suggestions")
    setLoadingSuggestions(true)
    setThinInfo(null)
    try {
      // Build preferences from answers
      const byId = Object.fromEntries(finalAnswers.map(a => [a.questionId, a]))
      const fuelMap: Record<string, string> = {
        "Бензин": "Petrol", "Дизель": "Diesel", "Електро": "Electric",
        "Гібрид": "Hybrid", "Plug-in гібрид": "Hybrid",
        "Газ (LPG)": "LPG", "Газ (CNG)": "CNG", "Етанол": "Ethanol", "Водень": "Hydrogen",
      }
      const bodyMap: Record<string, string> = {
        "Седан": "Sedan", "Хетчбек": "Hatchback", "Універсал": "Estate",
        "Позашляховик": "SUV", "Купе": "Coupe", "Кабріолет": "Convertible",
        "Мікроавтобус": "Van", "Пікап": "Pickup", "Вантажівка": "Truck",
        "Автобус": "Bus", "Мотоцикл": "Motorcycle", "Багі": "Buggy", "Спецтехніка": "Special",
      }
      const transMap: Record<string, string> = {
        "Автомат": "Automatic", "Механіка": "Manual",
        "Робот (DSG/DCT)": "Automatic", "Варіатор (CVT)": "Automatic",
      }
      const driveMap: Record<string, string> = {
        "Передній (FWD)": "FWD", "Задній (RWD)": "RWD", "Повний (AWD/4WD)": "AWD",
      }

      // Budget: selected[0] = "від" (e.g., "30 000"), selected[1] = "до" (e.g., "50 000" or "")
      const cleanNum = (s: string) => {
        const digits = s.replace(/[^\d]/g, "")
        return digits ? parseInt(digits) : NaN
      }
      const cleanFloat = (s: string) => {
        const norm = s.replace(/,/g, ".").replace(/[^\d.]/g, "")
        const n = parseFloat(norm)
        return isNaN(n) ? NaN : n
      }
      const budgetFromStr = byId.budget?.selected[0] ?? ""
      const budgetToStr = byId.budget?.selected[1] ?? ""
      let budgetMin: number | undefined
      let budgetMax: number | undefined
      const bFrom = cleanNum(budgetFromStr)
      const bTo = cleanNum(budgetToStr)
      if (!isNaN(bFrom) && bFrom > 0) budgetMin = bFrom
      if (!isNaN(bTo) && bTo > 0) budgetMax = bTo

      // Mileage range (km)
      const mileageMin = cleanNum(byId.mileage?.selected[0] ?? "")
      const mileageMax = cleanNum(byId.mileage?.selected[1] ?? "")

      // Engine volume (liters)
      const engineMin = cleanFloat(byId.engine?.selected[0] ?? "")
      const engineMax = cleanFloat(byId.engine?.selected[1] ?? "")

      // HP min
      const hpMin = cleanNum(byId.hp?.selected[0] ?? "")

      // Doors + seats (chips, stored as string)
      const doorsStr = byId.doors?.selected[0] ?? ""
      const doors = doorsStr ? parseInt(doorsStr) : NaN
      const seatsStr = byId.seats?.selected[0] ?? ""
      const seatsMinManual = seatsStr === "7+" ? 7 : seatsStr ? parseInt(seatsStr) : NaN

      // Color (UA → EN)
      const colorMap: Record<string, string> = {
        "Білий": "White", "Чорний": "Black", "Сірий": "Grey",
        "Сріблястий": "Silver", "Синій": "Blue", "Червоний": "Red",
        "Зелений": "Green", "Коричневий": "Brown", "Бежевий": "Beige",
        "Жовтий": "Yellow",
      }
      const color = colorMap[byId.color?.selected[0] ?? ""] ?? null

      // Interior material (UA → EN)
      const interiorMap: Record<string, string> = {
        "Шкіра": "Leather", "Екошкіра": "Eco-leather", "Тканина": "Fabric",
        "Велюр": "Velour", "Алькантара": "Alcantara",
        "Комбінований": "Combination", "Карбон": "Carbon",
      }
      const interior = interiorMap[byId.interior?.selected[0] ?? ""] ?? null

      // Save user budget for later use in handleApproveSuggestion
      setUserBudget({ min: budgetMin, max: budgetMax })

      // Cancel previous request if any
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setError(null)

      // If we already know AI is down and the form has at least one structured
      // filter, skip the suggest call entirely and search via parser directly.
      const hasFormFilters = Boolean(
        budgetMax || budgetMin ||
        byId.fuel?.selected[0] || byId.body?.selected[0] ||
        byId.year?.selected[0] || byId.transmission?.selected[0] ||
        byId.drive?.selected[0]
      )
      if (aiUnavailable && hasFormFilters) {
        setLoadingSuggestions(false)
        setPhase("results")
        setLoadingResults(true)
        setResults([])
        const accumulated: CarType[] = []
        const seenIds = new Set<string>()
        let receivedAny = false
        await streamSearch(
          {
            make: null, model: null,
            fuel: fuelMap[byId.fuel?.selected[0] ?? ""] ?? null,
            body_type: bodyMap[byId.body?.selected[0] ?? ""] ?? null,
            transmission: transMap[byId.transmission?.selected[0] ?? ""] ?? null,
            drive: driveMap[byId.drive?.selected[0] ?? ""] ?? null,
            color: color ?? null,
            year_from: byId.year?.selected[0] ? parseInt(byId.year.selected[0]) : null,
            year_to: byId.year?.selected[1] ? parseInt(byId.year.selected[1]) : null,
            budget_min: budgetMin || null,
            budget_max: budgetMax || null,
          },
          controller.signal,
          {
            onCars: (cars) => {
              receivedAny = true
              for (const c of cars) {
                const id = (c as any).source_url ?? (c as any).id
                if (id && seenIds.has(id)) continue
                if (id) seenIds.add(id)
                accumulated.push(c)
              }
              setResults([...accumulated])
            },
            onDone: () => {
              setLoadingResults(false)
              if (!receivedAny) setError("За вашими параметрами авто не знайдено. Спробуйте розширити критерії.")
            },
            onError: (msg) => {
              if (!receivedAny) setError("Не вдалося з'єднатися з парсером. " + msg)
              setLoadingResults(false)
            },
          },
        )
        return
      }

      // Shared helper: run parser directly via SSE streaming. Cars appear as
      // each source completes (cache → AS24 → Bytbil → Blocket), so the user
      // sees something quickly even when the cold scrape takes 10+ seconds.
      const runDirectSearch = async () => {
        setLoadingSuggestions(false)
        setPhase("results")
        setLoadingResults(true)
        setResults([])

        const accumulated: CarType[] = []
        const seenIds = new Set<string>()
        let receivedAny = false

        await streamSearch(
          {
            make: null,
            model: null,
            fuel: fuelMap[byId.fuel?.selected[0] ?? ""] ?? null,
            body_type: bodyMap[byId.body?.selected[0] ?? ""] ?? null,
            transmission: transMap[byId.transmission?.selected[0] ?? ""] ?? null,
            drive: driveMap[byId.drive?.selected[0] ?? ""] ?? null,
            color: color ?? null,
            year_from: byId.year?.selected[0] ? parseInt(byId.year.selected[0]) : null,
            year_to: byId.year?.selected[1] ? parseInt(byId.year.selected[1]) : null,
            budget_min: budgetMin || null,
            budget_max: budgetMax || null,
          },
          controller.signal,
          {
            onCars: (cars) => {
              receivedAny = true
              for (const c of cars) {
                const id = (c as any).source_url ?? (c as any).id
                if (id && seenIds.has(id)) continue
                if (id) seenIds.add(id)
                accumulated.push(c)
              }
              setResults([...accumulated])
            },
            onDone: () => {
              setLoadingResults(false)
              if (!receivedAny) setError("За вашими параметрами авто не знайдено. Спробуйте розширити критерії.")
            },
            onError: (msg) => {
              if (!receivedAny) setError("Не вдалося з'єднатися з парсером. " + msg)
              setLoadingResults(false)
            },
          },
        )
      }

      // ── Streaming SSE suggest call ─────────────────────────────────────────
      // Suggestions arrive one-by-one as Claude generates them; each is shown
      // immediately rather than waiting for all three.
      const res = await fetch("/api/ai-picker/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: {
            fuel: fuelMap[byId.fuel?.selected[0] ?? ""] ?? null,
            body_type: bodyMap[byId.body?.selected[0] ?? ""] ?? null,
            // Send null (not 20000) when user did not specify a budget — the
            // suggest endpoint treats null as "no budget constraint" and lets
            // Claude propose real market prices. The old fallback to 20000
            // made Claude treat €20k as the user's budget, so any realistic
            // premium suggestion got tagged "+over budget" against a value
            // the user never set.
            budget_min: budgetMin || null,
            budget_max: budgetMax || null,
            year_from: byId.year?.selected[0] ? parseInt(byId.year.selected[0]) : null,
            year_to: byId.year?.selected[1] ? parseInt(byId.year.selected[1]) : null,
            transmission: transMap[byId.transmission?.selected[0] ?? ""] ?? null,
            drive: driveMap[byId.drive?.selected[0] ?? ""] ?? null,
            purpose_body_types: byId.purpose?.selected ?? [],
            mileage_min: isNaN(mileageMin) ? null : mileageMin,
            mileage_max: isNaN(mileageMax) ? null : mileageMax,
            displacement_min: isNaN(engineMin) ? null : engineMin,
            displacement_max: isNaN(engineMax) ? null : engineMax,
            hp_min: isNaN(hpMin) ? null : hpMin,
            doors: isNaN(doors) ? null : doors,
            seats_min: isNaN(seatsMinManual) ? null : seatsMinManual,
            color,
            interior_material: interior,
          },
          answers: finalAnswers,
          freeText: freeText || undefined,
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        setError("Не вдалося з'єднатися з сервером. Спробуйте ще раз.")
        return
      }

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let lineBuf = ""
      const arrived: Suggestion[] = []
      let streamDone = false
      let thinShown = false // T10: tracked locally (state setter is async)

      while (!streamDone) {
        const { done, value } = await reader.read()
        if (done) break

        lineBuf += dec.decode(value, { stream: true })
        const lines = lineBuf.split("\n")
        lineBuf = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === "suggestion" && event.suggestion) {
              arrived.push(event.suggestion as Suggestion)
              setSuggestions([...arrived])
              // Keep loading=true until the 'done' event — so the UI can show a
              // "loading more…" indicator under the partial list and the user
              // sees that more suggestions are still streaming in.
            } else if (event.type === "fallback" && event.fallback === "ai_unavailable") {
              setAiUnavailable(true)
              if (!hasFormFilters) {
                setLoadingSuggestions(false)
                setPhase("form")
                setSuggestions([])
              } else {
                await runDirectSearch()
              }
              streamDone = true
              break
            } else if (event.type === "thin") {
              // Request is infeasible at this budget (all picks over budget) —
              // show the honest "over budget → under-order / widen" note. Arrives
              // before "done".
              setThinInfo({ reason: event.reason, shown: event.shown ?? 0 })
              thinShown = true
            } else if (event.type === "done") {
              setLoadingSuggestions(false)
              streamDone = true
              // T10: funnel entry — how many shown, how many grounded, was it thin.
              logPickerEvent("suggestions_shown", {
                shown: arrived.length,
                grounded: arrived.filter(s => (s as any).grounded).length,
                meta: { thin: thinShown },
              })
              break
            } else if (event.type === "error") {
              setError(event.message || "Помилка AI. Спробуйте ще раз.")
              setLoadingSuggestions(false)
              streamDone = true
              break
            }
          } catch { /* skip malformed event */ }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError("Не вдалося з'єднатися з сервером. Спробуйте ще раз.")
        setSuggestions([])
      }
    } finally {
      setLoadingSuggestions(false)
    }
  }, [freeText, aiUnavailable])

  // ── Step 2: User approves a suggestion → targeted parse ───────────────
  const handleApproveSuggestion = useCallback(async (idx: number) => {
    const suggestion = suggestions[idx]
    if (!suggestion) return

    // T9: strongest learning signal — the user picked THIS model. Biases future
    // suggestions (read back in /suggest). Fire-and-forget.
    logPickerEvent("suggestion_approved", {
      make: suggestion.make,
      model: suggestion.model,
      body_type: suggestion.searchParams?.body_type ?? null,
      budget_min: suggestion.searchParams?.budget_min ?? null,
      budget_max: suggestion.searchParams?.budget_max ?? null,
      meta: { yearRange: suggestion.yearRange, grounded: (suggestion as any).grounded ?? null },
    })

    // Cancel any in-flight approval/search before starting a new one. Without this,
    // tapping a second card while the first parser call is still running causes the
    // late response to overwrite the new one.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSearchingIndex(idx)  // Show loading spinner immediately

    // Extract user's form filters to include in chatPreferences (respects detailed filters)
    const byId = Object.fromEntries(answers.map(a => [a.questionId, a]))
    const cleanInt = (s: string) => { const n = parseInt(s.replace(/[^\d]/g, "")); return isNaN(n) ? null : n }
    const cleanFlt = (s: string) => { const n = parseFloat(s.replace(/,/g, ".").replace(/[^\d.]/g, "")); return isNaN(n) ? null : n }
    const colorMap: Record<string, string> = {
      "Білий": "White", "Чорний": "Black", "Сірий": "Grey", "Сріблястий": "Silver",
      "Синій": "Blue", "Червоний": "Red", "Зелений": "Green",
      "Коричневий": "Brown", "Бежевий": "Beige", "Жовтий": "Yellow",
    }
    const interiorMap: Record<string, string> = {
      "Шкіра": "Leather", "Екошкіра": "Eco-leather", "Тканина": "Fabric",
      "Велюр": "Velour", "Алькантара": "Alcantara",
      "Комбінований": "Combination", "Карбон": "Carbon",
    }
    const formMileageMin = cleanInt(byId.mileage?.selected[0] ?? "")
    const formMileageMax = cleanInt(byId.mileage?.selected[1] ?? "")
    const formEngineMin = cleanFlt(byId.engine?.selected[0] ?? "")
    const formEngineMax = cleanFlt(byId.engine?.selected[1] ?? "")
    const formHpMin = cleanInt(byId.hp?.selected[0] ?? "")
    const doorsRaw = byId.doors?.selected[0] ?? ""
    const formDoors = doorsRaw ? parseInt(doorsRaw) : null
    const seatsRaw = byId.seats?.selected[0] ?? ""
    const formSeatsMin = seatsRaw === "7+" ? 7 : seatsRaw ? parseInt(seatsRaw) : null
    const formColor = colorMap[byId.color?.selected[0] ?? ""] ?? null
    const formInterior = interiorMap[byId.interior?.selected[0] ?? ""] ?? null
    // Year — user's form value wins over AI suggestion. AI sometimes narrows
    // a "2017+" form input down to "2018-2020" inside the suggestion, which
    // then excludes the very cars (2021+) that exist in the user's budget.
    const formYearFrom = byId.year?.selected[0] ? parseInt(byId.year.selected[0]) : null
    const formYearTo = byId.year?.selected[1] ? parseInt(byId.year.selected[1]) : null

    // Approve search budget. If the user gave their OWN budget → use it strictly.
    // Otherwise fall back to the AI's proposed priceRange, widened by a tiered
    // tolerance that scales with the price level (so the band isn't artificially
    // tight on pricey cars): <50k fixed, 50-100k ±5k, 100-200k ±10k, 200k+ ±20k.
    // Tier is keyed off the range's upper bound. The 20k turnkey floor always holds.
    const hasUserBudget = userBudget.min != null || userBudget.max != null
    let searchBudgetMin = 20000
    let searchBudgetMax: number | undefined = undefined
    if (hasUserBudget) {
      searchBudgetMin = userBudget.min || 20000
      searchBudgetMax = userBudget.max || undefined
    } else {
      const aiMin = suggestion.searchParams.budget_min
      const aiMax = suggestion.searchParams.budget_max
      if (typeof aiMin === "number" && typeof aiMax === "number") {
        const tol = aiMax < 50000 ? 0 : aiMax < 100000 ? 5000 : aiMax < 200000 ? 10000 : 20000
        searchBudgetMin = Math.max(20000, aiMin - tol)
        searchBudgetMax = aiMax + tol
      }
    }

    try {
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [],
          answers,
          triggerSearch: true,
          clientOrderId: makeUuid(),
          chatPreferences: {
            pairs: [{ make: suggestion.searchParams.make, model: suggestion.searchParams.model }],
            fuel: suggestion.searchParams.fuel ?? null,
            body_type: suggestion.searchParams.body_type ?? null,
            // User's budget if given, else AI range + tiered tolerance (computed above).
            budget_min: searchBudgetMin,
            budget_max: searchBudgetMax,
            // Year filter precedence: explicit form value > AI's yearRange.
            // Passing AI's yearRange to the parser lets AutoScout24 (fregfrom)
            // and mobile.de (minFirstRegistrationDate) filter at the source —
            // way less wasted traffic than tugging all years and filtering
            // client-side. Niche models (Infiniti, narrow E-Class trims) are
            // protected on the server via searchWithFallback's step 3, which
            // drops year if the windowed search returns 0.
            year_from: formYearFrom ?? suggestion.searchParams.year_from ?? null,
            year_to: formYearTo ?? suggestion.searchParams.year_to ?? null,
            transmission: suggestion.searchParams.transmission ?? null,
            drive: suggestion.searchParams.drive ?? null,
            budget: null,
            color: formColor,
            mileage_min: formMileageMin,
            mileage_max: formMileageMax,
            required_options: [],
            displacement_min: formEngineMin,
            displacement_max: formEngineMax,
            hp_min: formHpMin,
            seats_min: formSeatsMin,
            doors: formDoors,
            interior_material: formInterior,
            purpose_body_types: [],
          },
        }),
      })
      const data = await res.json()
      const newCars = (data.cars ?? []).map(mapApiCar)

      // T10: conversion + 0-result signal — did the approved pick actually find cars?
      logPickerEvent("search_completed", {
        make: suggestion.make,
        model: suggestion.model,
        found: newCars.length,
        meta: { via: "approve" },
      })

      // Merge new + old, with three safeguards:
      //   1. New cars go FIRST so the latest pick tops the list.
      //   2. Old cars are kept only if their MAKE matches the new pick.
      //      Without this, a Skoda search left old Skodas in the list when
      //      the user switched to a MINI Cooper search — the relevance
      //      sort then bubbled the newer Skodas above the older MINIs.
      //   3. Old cars also have to fit the new pick's budget + year window.
      const sp = suggestion.searchParams
      const newMake = (sp.make ?? "").toLowerCase()
      const newBudgetMin = sp.budget_min ?? null
      const newBudgetMax = sp.budget_max ?? null
      const newYearFrom = sp.year_from ?? null
      const newYearTo = sp.year_to ?? null

      const matchesNewCriteria = (c: CarType): boolean => {
        if (newMake) {
          const carMake = (c.make ?? "").toLowerCase()
          if (carMake && carMake !== newMake && !carMake.includes(newMake) && !newMake.includes(carMake)) {
            return false
          }
        }
        const price = (c as any).price ?? c.price
        if (typeof price === "number") {
          if (newBudgetMin != null && price < newBudgetMin) return false
          if (newBudgetMax != null && price > newBudgetMax) return false
        }
        const year = (c as any).year ?? c.year
        if (typeof year === "number") {
          if (newYearFrom != null && year < newYearFrom) return false
          if (newYearTo   != null && year > newYearTo)   return false
        }
        return true
      }

      setResults(prev => {
        const newUrls = new Set(newCars.map((c: CarType) => c.sourceUrl || (c as any).source_url))
        const keptOld = prev
          .filter(c => !newUrls.has(c.sourceUrl || (c as any).source_url))
          .filter(matchesNewCriteria)
        return [...newCars, ...keptOld]
      })

      if (newCars.length > 0) {
        // Success — mark approved and switch to results
        setApprovedIndices(prev => new Set(prev).add(idx))
        setPhase("results")
        setLoadingResults(false)
      } else {
        // No cars found — show message, DON'T mark as approved
        setError(data.message || `За параметрами ${suggestion.make} ${suggestion.model} авто не знайдено. Спробуйте інший варіант.`)
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(`Не вдалося знайти ${suggestion.make} ${suggestion.model}. Спробуйте інший варіант.`)
      }
    } finally {
      // Only clear spinner if this call wasn't aborted by a newer one — otherwise
      // we'd hide the spinner the new call just turned on.
      if (!controller.signal.aborted) setSearchingIndex(null)
    }
  }, [suggestions, answers])

  // ── Fallback: search all without suggestions ──────────────────────────
  const handleSearchAll = useCallback(async () => {
    setPhase("results")
    setLoadingResults(true)
    setError(null)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Pass freeText as a user message so the backend's extractFromChat
      // can pull brand/model/year/etc. out of it — otherwise this button
      // only used form answers and ignored everything the user typed in
      // the AI prompt (e.g. "Infiniti SUV від 2018").
      const userMsg = freeText?.trim()
        ? [{ role: "user" as const, content: freeText.trim() }]
        : []
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: userMsg,
          answers,
          triggerSearch: true,
          clientOrderId: makeUuid(),
        }),
        signal: controller.signal,
      })
      const data = await res.json()
      const allCars = (data.cars ?? []).map(mapApiCar)
      setResults(allCars)
      logPickerEvent("search_completed", { found: allCars.length, meta: { via: "search_all" } })
      if (data.cars?.length === 0) {
        setError("За вашими параметрами авто поки не знайдено. Спробуйте змінити критерії.")
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError("Помилка пошуку. Перевірте з'єднання та спробуйте ще раз.")
        setResults([])
      }
    } finally {
      setLoadingResults(false)
    }
  }, [answers, freeText])

  const goBackToForm = useCallback(() => {
    abortRef.current?.abort()
    setPhase("form")
    setSuggestions([])
    setApprovedIndices(new Set())
    setSearchingIndex(null)
    setError(null)
    // Keep answers + freeText so user can adjust them
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setPhase("form")
    setFreeText("")
    setAnswers(EMPTY_ANSWERS)
    setResults([])
    setSuggestions([])
    setApprovedIndices(new Set())
    setSearchingIndex(null)
    setError(null)
  }, [])

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-8" aria-label="AI підбір автомобіля">
      {/* Header */}
      <header className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">AI-підбір</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Знайдіть авто з Європи
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {phase === "form"
            ? "Вкажіть параметри — AI знайде найкращі варіанти з 4 європейських майданчиків"
            : phase === "suggestions"
            ? "AI підібрав моделі під ваші параметри. Оберіть — і ми знайдемо реальні пропозиції"
            : `Знайдено ${results.length} авто з AutoScout24, Mobile.de, Bytbil та Blocket`
          }
        </p>
      </header>

      {/* AI-down banner: shown after a failed AI request — user must fill the form below. */}
      {phase === "form" && aiUnavailable && (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] p-4 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="flex-1">
              <p className="font-semibold text-amber-100">AI зараз недоступний</p>
              <p className="mt-1 text-amber-200/80">
                Не можемо обробити вільний опис автоматично. Заповніть параметри у формі нижче (бюджет, тип кузова, паливо, рік) — система пошукає авто за вашими полями напряму, без AI.
              </p>
            </div>
            <button
              onClick={() => setAiUnavailable(false)}
              className="text-amber-300/70 hover:text-amber-100 text-xs"
              aria-label="Закрити"
            >✕</button>
          </div>
        </div>
      )}

      {/* Filter form */}
      {phase === "form" && (
        <div className="mb-6 rounded-3xl border border-border bg-card/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <AllFiltersForm
            answers={answers}
            onChange={updateAnswer}
            freeText={freeText}
            onFreeTextChange={setFreeText}
            onSubmit={() => {
              try { localStorage.setItem("freshAutoSearch", JSON.stringify(answers)) } catch {}
              fetchSuggestions(answers)
            }}
            onClear={() => {
              setAnswers(EMPTY_ANSWERS)
              setFreeText("")
              setError(null)
              try { localStorage.removeItem("freshAutoSearch") } catch {}
            }}
            loading={loadingSuggestions}
            language={language}
          />
        </div>
      )}

      {/* Suggestions */}
      {phase === "suggestions" && (
        <div className="rounded-3xl border border-border bg-card/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <SuggestionsScreen
            suggestions={suggestions}
            loading={loadingSuggestions}
            onApprove={handleApproveSuggestion}
            onSearchAll={handleSearchAll}
            onReset={reset}
            onBack={goBackToForm}
            onRefresh={() => {
              setApprovedIndices(new Set())
              setError(null)
              fetchSuggestions(answers)
            }}
            approvedIndices={approvedIndices}
            searchingIndex={searchingIndex}
            error={error}
            thin={thinInfo}
          />
        </div>
      )}

      {/* Results */}
      {phase === "results" && (
        <div className="rounded-3xl border border-border bg-card/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <ResultsScreen
            answers={answers}
            cars={results}
            loading={loadingResults}
            onSelectCar={(car) => {
              // T10: deepest funnel step — a suggestion led to a car the user opened.
              logPickerEvent("car_clicked", {
                make: (car as any).make ?? null,
                model: (car as any).model ?? null,
                meta: { id: (car as any).id ?? null },
              })
              onSelectCar(car)
            }}
            onReset={reset}
            onBack={goBackToForm}
            freeText={freeText}
            approvedSuggestion={(() => {
              const idx = [...approvedIndices][approvedIndices.size - 1]
              const s = idx != null ? suggestions[idx] : null
              return s ? { make: s.make, model: s.model, yearRange: s.yearRange, whyRecommended: s.whyRecommended } : null
            })()}
            rejectedSuggestions={suggestions
              .filter((_, i) => !approvedIndices.has(i))
              .map(s => ({ make: s.make, model: s.model }))}
          />
        </div>
      )}
    </section>
  )
}