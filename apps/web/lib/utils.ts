import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS class names with deterministic precedence.
 *
 * `clsx` resolves conditional/array inputs to a class string; `twMerge`
 * then collapses conflicting Tailwind utilities so later-arg wins.
 */
export function cn(...inputs: ClassValue[]) {
  // eslint-plugin-tailwindcss inspects the `clsx(...)` call and mistakes
  // the spread identifier (`inputs`) for a classname string. Downstream
  // callers are still linted normally.
  // eslint-disable-next-line tailwindcss/no-custom-classname
  return twMerge(clsx(inputs));
}
