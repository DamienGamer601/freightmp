export class HttpError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();

  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new HttpError(
      response.status,
      typeof data === "string" ? data : `Request to ${url} failed with status ${response.status}`,
      data,
    );
  }

  return data as T;
}

export const http = {
  get: <T>(url: string, headers?: Record<string, string>): Promise<T> =>
    request<T>(url, { method: "GET", headers }),

  post: <T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> =>
    request<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  postForm: <T>(url: string, body: URLSearchParams, headers?: Record<string, string>): Promise<T> =>
    request<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
      body: body.toString(),
    }),
};
