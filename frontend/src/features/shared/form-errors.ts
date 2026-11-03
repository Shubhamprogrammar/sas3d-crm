import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ApiError } from "@/services/api";

/** Shows server validation messages next to the matching form fields. */
export function applyServerErrors<T extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<T>,
) {
  for (const issue of error.errors) {
    if (issue.path && issue.message) setError(issue.path as Path<T>, { message: issue.message });
  }
}
