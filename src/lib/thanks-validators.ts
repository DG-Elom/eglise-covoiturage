type ValidationResult =
  | { ok: true }
  | { ok: false; error: "message_too_short" | "message_too_long" };

export function validateThanksMessage(message: string): ValidationResult {
  const trimmed = message.trim();
  if (trimmed.length === 0) return { ok: false, error: "message_too_short" };
  if (message.length > 500) return { ok: false, error: "message_too_long" };
  return { ok: true };
}
