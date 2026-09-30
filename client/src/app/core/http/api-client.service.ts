import { Injectable } from "@angular/core";
@Injectable({ providedIn: "root" })
export class ApiClient {
  async request<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
    const form = body instanceof FormData;
    const response = await fetch("/api" + url, {
      method,
      credentials: "include",
      headers: form
        ? { "X-Circle-Request": "1" }
        : { "Content-Type": "application/json", "X-Circle-Request": "1" },
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data as T;
  }
}
