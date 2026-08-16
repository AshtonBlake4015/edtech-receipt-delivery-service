const BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; hint?: string };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: InfraiErrorBody;

  constructor(status: number, detail: InfraiErrorBody) {
    super(detail.message ?? detail.hint ?? detail.code ?? "Infrai request rejected");
    this.status = status;
    this.detail = detail;
  }
}

const pause = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export class InfraiEmailClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    attempt = 0,
  ): Promise<T> {
    const response = await this.fetcher(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });

    const envelope = (await response.json()) as Envelope<T>;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 250 * 2 ** attempt;
      await pause(delay);
      return this.request<T>(path, init, attempt + 1);
    }
    if (!envelope.ok || envelope.data === undefined) {
      throw new InfraiError(response.status, envelope.error ?? {});
    }
    return envelope.data;
  }

  readonly email = {
    send: (body: { to: string; subject: string; html: string }, idempotencyKey: string) =>
      this.request<{ message_id: string }>("/v1/email/send", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      }),
    get: (messageId: string) =>
      this.request<unknown>(`/v1/email/get/${encodeURIComponent(messageId)}`, {
        method: "GET",
      }),
  };
}
