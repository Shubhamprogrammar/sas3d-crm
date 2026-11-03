import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";

const CONTROL =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-ink placeholder:text-ink-3 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-surface-2 disabled:text-ink-3 aria-[invalid=true]:border-bad";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  }) => ReactNode;
}

export function FormField({ label, error, hint, required, className = "", children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium text-ink-2">
        {label}
        {required && <span className="text-bad"> *</span>}
      </label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": message ? messageId : undefined,
      })}
      {message && (
        <p id={messageId} className={`mt-1 text-xs ${error ? "text-bad" : "text-ink-3"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...rest }, ref) {
    return <input ref={ref} className={`h-9 ${CONTROL} ${className}`} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={`py-2 ${CONTROL} ${className}`} {...rest} />;
});

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, className = "", ...rest },
  ref,
) {
  return (
    <div className={`relative ${className}`}>
      <select ref={ref} className={`h-9 appearance-none pr-8 ${CONTROL}`} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-ink-3"
        aria-hidden
      />
    </div>
  );
});

/** Native picker: gives keyboard, locale and mobile support without a date library. */
export const DatePicker = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { withTime?: boolean }
>(function DatePicker({ withTime, ...rest }, ref) {
  return <Input ref={ref} type={withTime ? "datetime-local" : "date"} {...rest} />;
});
