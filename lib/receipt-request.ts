export type ReceiptRequest = { requestId: string };
export type ReceiptAttempts = Map<string, string>;

// Keep every attempted payload until the sale finishes, including A -> B -> A edits.
// The serialized payload is also what fetch sends; no mutable cart objects are retained.
export function withReceiptRequestId<T extends object>(
  attempts: ReceiptAttempts,
  payload: T,
): T & ReceiptRequest {
  const fingerprint = JSON.stringify(payload);
  let requestId = attempts.get(fingerprint);
  if (!requestId) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    requestId = `pos_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    attempts.set(fingerprint, requestId);
  }
  return { ...payload, requestId };
}

// Restaurant payment is already committed. Retry only its receipt, never the payment.
export async function postReceiptWithRetry(url: string, init: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, init);
    if (response.status < 500) return response;
  } catch {
    // A lost response may mean the receipt committed; reuse the exact body/key.
  }
  return fetch(url, init);
}
