/**
 * Billing Statuses Configuration
 * Centralized source of truth for billing status definitions
 */

export const BILLING_STATUSES = [
  { key: "brouillon", label: "Brouillon", order: 10, color: "#C4B5FD", colorClass: "bg-violet-100 border-violet-200", textColorClass: "text-violet-700", darkColorClass: "dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800" },
  { key: "devis_envoye", label: "Devis envoyé", order: 20, color: "#FDE047", colorClass: "bg-yellow-100 border-yellow-200", textColorClass: "text-yellow-700", darkColorClass: "dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800" },
  { key: "devis_accepte", label: "Devis accepté", order: 30, color: "#93C5FD", colorClass: "bg-blue-100 border-blue-200", textColorClass: "text-blue-700", darkColorClass: "dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  { key: "bon_commande", label: "BDC émis", order: 40, color: "#93C5FD", colorClass: "bg-blue-100 border-blue-200", textColorClass: "text-blue-700", darkColorClass: "dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  { key: "facture", label: "Facturé", order: 50, color: "#93C5FD", colorClass: "bg-blue-100 border-blue-200", textColorClass: "text-blue-700", darkColorClass: "dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  { key: "paye", label: "Payé", order: 60, color: "#86EFAC", colorClass: "bg-green-100 border-green-200", textColorClass: "text-green-700", darkColorClass: "dark:bg-green-900/30 dark:text-green-300 dark:border-green-800", isTerminal: true },
  { key: "partiel", label: "Partiel", order: 70, color: "#5EEAD4", colorClass: "bg-teal-100 border-teal-200", textColorClass: "text-teal-700", darkColorClass: "dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800" },
  { key: "annule", label: "Annulé", order: 80, color: "#D1D5DB", colorClass: "bg-gray-100 border-gray-200", textColorClass: "text-gray-700", darkColorClass: "dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-700", isTerminal: true },
  { key: "retard", label: "Retard", order: 90, color: "#FCA5A5", colorClass: "bg-red-100 border-red-200", textColorClass: "text-red-700", darkColorClass: "dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
] as const;

export type BillingStatusKey = typeof BILLING_STATUSES[number]["key"];

export const billingStatusByKey = Object.fromEntries(
  BILLING_STATUSES.map(s => [s.key, s])
) as Record<BillingStatusKey, typeof BILLING_STATUSES[number]>;

export const billingStatusKeys = BILLING_STATUSES.map(s => s.key);

export const billingStatusOptions = BILLING_STATUSES.map(s => ({
  value: s.key,
  label: s.label,
  color: s.color,
}));

export function getBillingStatusLabel(key: BillingStatusKey | string | null): string {
  if (!key) return "Brouillon";
  return billingStatusByKey[key as BillingStatusKey]?.label ?? key;
}

export function getBillingStatusColorClass(key: BillingStatusKey | string | null): string {
  const statusKey = key || "brouillon";
  const status = billingStatusByKey[statusKey as BillingStatusKey];
  if (!status) return "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800";
  return `${status.colorClass} ${status.textColorClass} ${status.darkColorClass}`;
}

export function getBillingStatusOrder(key: BillingStatusKey | string | null): number {
  if (!key) return 10;
  return billingStatusByKey[key as BillingStatusKey]?.order ?? 10;
}

export function isTerminalBillingStatus(key: BillingStatusKey | string | null): boolean {
  if (!key) return false;
  return billingStatusByKey[key as BillingStatusKey]?.isTerminal === true;
}

export function getBillingStatusColor(key: BillingStatusKey | string | null): string {
  const statusKey = key || "brouillon";
  return billingStatusByKey[statusKey as BillingStatusKey]?.color ?? "#C4B5FD";
}
