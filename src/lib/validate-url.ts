const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal",
  "metadata.internal",
]);

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^0\./,
  /^fc00:/i,
  /^fe80:/i,
  /^fd/i,
  /^::1$/,
];

export function validateAndNormalizeUrl(input: string): string {
  let raw = input.trim();

  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    raw = "https://" + raw;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URLs with credentials are not allowed");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error("This URL cannot be scanned");
  }

  if (PRIVATE_IP_RANGES.some((r) => r.test(hostname))) {
    throw new Error("This URL cannot be scanned");
  }

  if (!hostname.includes(".") || hostname.endsWith(".local")) {
    throw new Error("Please enter a public domain name");
  }

  if (parsed.port && !["80", "443", ""].includes(parsed.port)) {
    throw new Error("Only standard HTTP/HTTPS ports are allowed");
  }

  return parsed.toString();
}
