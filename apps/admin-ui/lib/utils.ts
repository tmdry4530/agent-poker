import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatChips(amount: number): string {
  return amount.toLocaleString();
}

export function formatTimestamp(value: string | number): string {
  return new Date(value).toLocaleString();
}
