"use client";

// Minimal API client: session cookie + Django CSRF. No extra deps.

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(detail: string, code: string, status: number) {
    super(detail);
    this.code = code;
    this.status = status;
  }
}

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : "";
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    // ensure the CSRF cookie exists before reading it
    if (!getCookie("csrftoken")) {
      await fetch("/api/v1/auth/me", { credentials: "include" });
    }
    headers["X-CSRFToken"] = getCookie("csrftoken");
  }

  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      data.detail ?? `Request failed (${res.status})`,
      data.code ?? "error",
      res.status,
    );
  }
  return data as T;
}

export interface Me {
  id: number;
  email: string;
  roles: string[];
  active_role: string;
  verification_status: string | null;
}
