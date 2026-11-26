import { useId, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { searchSuggestions } from "../services/careerCatalog.js";

export function SuggestionPicker({
  label,
  catalog,
  selected,
  onAdd,
  limit,
  listLabel,
  required = false,
}: {
  label: string;
  catalog: readonly string[];
  selected: string[];
  onAdd: (value: string) => void;
  limit: number;
  listLabel: string;
  required?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = searchSuggestions(query, catalog, selected);
  const showing = open && results.length > 0 && selected.length < limit;
  const choose = (value: string) => {
    const trimmed = value.trim().slice(0, 100);
    if (
      !trimmed ||
      selected.length >= limit ||
      selected.some((item) => item.toLowerCase() === trimmed.toLowerCase())
    )
      return;
    onAdd(trimmed);
    setQuery("");
    setOpen(false);
    setActive(0);
    input.current?.focus();
  };
  return (
    <div
      className="cr-suggestion-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="cr-inline-form">
        <input
          ref={input}
          role="combobox"
          aria-label={label}
          aria-required={required || undefined}
          aria-autocomplete="list"
          aria-expanded={showing}
          aria-controls={`${id}-results`}
          aria-activedescendant={
            showing
              ? `${id}-option-${Math.min(active, results.length - 1)}`
              : undefined
          }
          value={query}
          maxLength={100}
          disabled={selected.length >= limit}
          placeholder={
            selected.length >= limit ? "Remove one to add another" : label
          }
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (
              (event.key === "ArrowDown" || event.key === "ArrowUp") &&
              showing
            ) {
              event.preventDefault();
              setActive(
                (value) =>
                  (value +
                    (event.key === "ArrowDown" ? 1 : results.length - 1)) %
                  results.length,
              );
            } else if (event.key === "Escape") setOpen(false);
            else if (event.key === "Enter") {
              event.preventDefault();
              choose(
                showing
                  ? results[Math.min(active, results.length - 1)]!
                  : query,
              );
            }
          }}
        />
        <button
          type="button"
          className="auth-secondary"
          disabled={!query.trim() || selected.length >= limit}
          onClick={() => choose(query)}
        >
          Add
        </button>
      </div>
      {showing ? (
        <div
          className="cr-role-results"
          id={`${id}-results`}
          role="listbox"
          aria-label={listLabel}
        >
          {results.map((value, index) => (
            <button
              key={value}
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              aria-selected={active === index}
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => setActive(index)}
              onClick={() => choose(value)}
            >
              {value}
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
