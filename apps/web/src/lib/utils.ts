import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractNumberFromJid(jid: string): string {
  return `+${jid.split(":")[0]}`;
}
