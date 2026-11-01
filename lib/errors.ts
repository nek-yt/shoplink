import { ShoplinkError } from "./shoplink";
import { sentence } from "./format";

/**
 * Splits a failed request into messages per form field and one general message. The backend starts each
 * problem with the field it is about ("address must not be empty"), so that word picks the field.
 */
export function splitErrors(err: unknown, fields: readonly string[]) {
  if (!(err instanceof ShoplinkError)) return { fields: {} as Record<string, string>, general: "Something went wrong, please try again" };
  const byField: Record<string, string> = {};
  const other: string[] = [];
  for (const message of err.errors) {
    const field = message.split(" ")[0];
    if (fields.includes(field)) byField[field] ??= sentence(message);
    else other.push(sentence(message));
  }
  const general = Object.keys(byField).length && !other.length ? null : [err.message, ...other].join(". ");
  return { fields: byField, general };
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong, please try again");
