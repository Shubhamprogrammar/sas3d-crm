import axios, { AxiosError } from "axios";
import type { PageMeta } from "@/types";

export interface FieldError {
  path?: string;
  message?: string;
  code?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: FieldError[] = [],
  ) {
    super(message);
  }
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta: PageMeta;
}

const client = axios.create({ baseURL: "/api/v1", withCredentials: true });

client.interceptors.response.use(
  undefined,
  (error: AxiosError<{ message?: string; errors?: FieldError[] }>) => {
    if (!error.response)
      throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
    const { status, data } = error.response;
    if (
      status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new ApiError(data?.message ?? "Something went wrong", status, data?.errors ?? []);
  },
);

export const api = {
  async get<T>(path: string, params?: object) {
    const { data } = await client.get<Envelope<T>>(path, { params });
    return data;
  },
  async post<T>(path: string, body?: unknown) {
    const { data } = await client.post<Envelope<T>>(path, body ?? {});
    return data;
  },
  async patch<T>(path: string, body?: unknown) {
    const { data } = await client.patch<Envelope<T>>(path, body ?? {});
    return data;
  },
  async delete<T>(path: string) {
    const { data } = await client.delete<Envelope<T>>(path);
    return data;
  },
  async upload<T>(path: string, form: FormData) {
    const { data } = await client.post<Envelope<T>>(path, form);
    return data;
  },
};

/** Fetches through the authenticated client, then hands the browser a file to save. */
export async function downloadFile(path: string, filename: string, params?: object) {
  let response;
  try {
    response = await client.get<Blob>(path, { params, responseType: "blob" });
  } catch (error) {
    // An error body requested as a blob loses its message, so report it generically.
    if (error instanceof ApiError)
      throw new ApiError(
        error.status === 403
          ? "You do not have permission to download this"
          : "The download failed",
        error.status,
      );
    throw error;
  }
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
