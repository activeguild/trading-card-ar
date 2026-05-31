export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function apiFetch(
  url: string,
  token: string | null,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.detail ?? `Error: ${res.status}`)
  }
  return res
}

export async function apiJson<T>(
  url: string,
  token: string | null,
  options: RequestInit = {},
): Promise<T> {
  if (
    options.body &&
    typeof options.body === 'string' &&
    !options.headers
  ) {
    options.headers = { 'Content-Type': 'application/json' }
  }
  const res = await apiFetch(url, token, options)
  return res.json()
}
