const viteApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = viteApiBaseUrl || "http://localhost:3001";

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: FormData | Record<string, unknown>;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers();
  const body = createRequestBody(options.body, headers);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  });

  const data = (await parseResponseBody(res)) as T & { message?: string };

  if (!res.ok) {
    throw new Error(data?.message || "Ошибка запроса");
  }

  return data;
}

function createRequestBody(
  body: RequestOptions["body"],
  headers: Headers,
): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (body instanceof FormData) {
    return body;
  }

  headers.set("Content-Type", "application/json");
  return JSON.stringify(body);
}

async function parseResponseBody(res: Response): Promise<unknown> {
  if (res.status === 204) {
    return {};
  }

  const text = await res.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}
