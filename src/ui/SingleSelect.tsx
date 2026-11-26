import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

// Uses the same inline listbox as role and skill suggestions, so it cannot
// escape above the field or be clipped by an onboarding scroll container.
export function SingleSelect({
  label,
  value,
  options,
  onChange,
  required = false,
  invalid = false,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  required?: boolean;
  invalid?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const show = () => {
    setActive(Math.max(0, options.indexOf(value)));
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option);
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div
      className="cr-single-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="cr-select-trigger"
        role="combobox"
        aria-label={label}
        aria-required={required}
        aria-invalid={invalid || undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        onClick={() => {
          if (open) setOpen(false);
          else show();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) show();
            else
              setActive(
                (index) =>
                  (index +
                    (event.key === "ArrowDown" ? 1 : options.length - 1)) %
                  options.length,
              );
          } else if (event.key === "Home" && open) {
            event.preventDefault();
            setActive(0);
          } else if (event.key === "End" && open) {
            event.preventDefault();
            setActive(options.length - 1);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) choose(active);
            else show();
          } else if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            const match = options.findIndex((option) =>
              option.toLowerCase().startsWith(event.key.toLowerCase()),
            );
            if (match >= 0) {
              event.preventDefault();
              setActive(match);
              setOpen(true);
            }
          }
        }}
      >
        <span className={value ? "" : "cr-select-placeholder"}>
          {value || "Choose your career stage"}
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open ? (
        <div
          className="cr-role-results cr-select-results"
          role="listbox"
          aria-label={`${label} options`}
          id={`${id}-list`}
        >
          {options.map((option, index) => (
            <button
              key={option}
              type="button"
              role="option"
              tabIndex={-1}
              id={`${id}-option-${index}`}
              aria-selected={value === option}
              data-active={active === index || undefined}
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => setActive(index)}
              onClick={() => choose(index)}
            >
              {option}
              {value === option ? <Check size={16} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
