export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export function formatCurrency(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number(value?.toString?.() ?? 0);

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0);
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${formatDate(date)} ${hour}:${minute}`;
}

export function toInt(value: string | string[] | undefined, fallback = 1) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function toSearch(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}
