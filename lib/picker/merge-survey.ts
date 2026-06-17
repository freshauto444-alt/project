// ═══════════════════════════════════════════════════════════════════════════════
//  Survey → chat fallback merge.
//  The chat-derived preferences (explicit user words) always win; survey answers
//  only fill fields the chat left unset. Mutates `chat` in place, matching the
//  original inline behavior in the ai-picker route.
// ═══════════════════════════════════════════════════════════════════════════════
import type { ChatPreferences } from "@/lib/picker/types"
import { extractSearchParams } from "@/lib/picker/survey-params"

type SurveyBase = ReturnType<typeof extractSearchParams>

export function mergeSurveyIntoChat(chat: ChatPreferences, base: SurveyBase): void {
  // Merge survey answers as fallback — respect user's explicit chat preferences
  if (!chat.budget && base.budget_max) chat.budget = base.budget_max
  if (!chat.budget_min && base.budget_min) chat.budget_min = base.budget_min
  // Only set budget_max from survey if user didn't explicitly set min-only in chat
  // (user said "від 30к" = they want 30k+, don't cap from survey)
  if (!chat.budget_max && base.budget_max && !chat.budget_min) chat.budget_max = base.budget_max
  if (!chat.fuel && base.fuel) chat.fuel = base.fuel
  if (!chat.body_type && base.body_type) chat.body_type = base.body_type
  if (!chat.year_from && base.year_from) chat.year_from = base.year_from
  if (!chat.year_to && base.year_to) chat.year_to = base.year_to
  if (!chat.transmission && base.transmission) chat.transmission = base.transmission
  if (!chat.drive && base.drive) chat.drive = base.drive
  // Purpose presets → merge into chat if not overridden by explicit chat values
  if (chat.hp_min == null && base.hp_min != null) chat.hp_min = base.hp_min
  if (chat.seats_min == null && base.seats_min != null) chat.seats_min = base.seats_min
  if (chat.displacement_min == null && base.displacement_min != null) chat.displacement_min = base.displacement_min
  if (chat.purpose_body_types.length === 0 && base.purpose_body_types.length > 0)
    chat.purpose_body_types = base.purpose_body_types
}
