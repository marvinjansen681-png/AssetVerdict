/**
 * React Hook Form's `register()` on `<input type="number">` submits string
 * values by default (no `valueAsNumber`), which Prisma's Float columns
 * reject. Coerce a whitelisted set of fields to numbers at the API boundary
 * so every form tab is covered regardless of client-side register options.
 */
export function coerceNumericFields<T extends Record<string, unknown>>(
  body: T,
  numericKeys: readonly string[]
): T {
  const result: Record<string, unknown> = { ...body };
  for (const key of numericKeys) {
    if (key in result && result[key] !== null && result[key] !== undefined) {
      const num = Number(result[key]);
      if (!Number.isNaN(num)) {
        result[key] = num;
      }
    }
  }
  return result as T;
}
