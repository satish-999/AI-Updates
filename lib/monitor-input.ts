export function monitorQuestion(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a topic to monitor.");
  const question = value.trim().replace(/\s+/g, " ");
  if (question.length < 2 || question.length > 240 || !/[\p{L}\p{N}]/u.test(question)) {
    throw new Error("Use 2–240 characters, including a word or number.");
  }
  return question;
}

export function monitorId(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d{0,18}$/.test(value)) {
    throw new Error("Invalid monitor.");
  }
  return value;
}
