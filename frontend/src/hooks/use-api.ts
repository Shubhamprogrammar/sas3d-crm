"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/services/api";

/** Query keys are [path, params], so invalidating "/leads" also covers "/leads/123". */
export const invalidatePaths = (queryClient: QueryClient, paths: string[]) =>
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return (
        typeof key === "string" &&
        paths.some(
          (path) => key === path || key.startsWith(`${path}/`) || key.startsWith(`${path}?`),
        )
      );
    },
  });

export function useApiQuery<T>(
  path: string | null,
  params?: object,
  options: { keepPrevious?: boolean; refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: [path, params ?? {}],
    enabled: path !== null,
    queryFn: async () => (await api.get<T>(path as string, params)).data,
    refetchInterval: options.refetchInterval,
    placeholderData: options.keepPrevious ? (previous) => previous : undefined,
  });
}

/** List endpoint variant that also exposes pagination metadata. */
export function useApiList<T>(path: string | null, params?: object) {
  const query = useQuery({
    queryKey: [path, params ?? {}],
    enabled: path !== null,
    queryFn: async () => {
      const { data, meta } = await api.get<T[]>(path as string, params);
      return { items: data, meta };
    },
    placeholderData: (previous) => previous,
  });
  return { ...query, items: query.data?.items ?? [], meta: query.data?.meta };
}

interface MutationConfig<TInput, TResult> {
  request: (input: TInput) => Promise<{ data: TResult; message: string }>;
  /** Paths to refresh after success. */
  invalidate: string[];
  onSuccess?: (data: TResult) => void;
  onError?: (error: ApiError) => void;
  /** Set false when the caller shows its own result. */
  toastSuccess?: boolean;
  /** Set false when the caller renders the error inline. */
  toastError?: boolean;
}

export function useApiMutation<TInput = void, TResult = unknown>(
  config: MutationConfig<TInput, TResult>,
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: async (input: TInput) => config.request(input),
    onSuccess: async ({ data, message }) => {
      if (config.toastSuccess !== false) toast.success(message);
      await invalidatePaths(queryClient, config.invalidate);
      config.onSuccess?.(data);
    },
    onError: (error: Error) => {
      if (config.toastError !== false) toast.error(error.message);
      if (error instanceof ApiError) config.onError?.(error);
    },
  });
  return { ...mutation, data: mutation.data?.data };
}
