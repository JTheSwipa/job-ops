import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useVirtualizedListbox } from "@/components/ui/virtualized-listbox";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  searchText?: string;
  disabled?: boolean;
}

interface MultiSelectDropdownProps {
  value: string[];
  options: MultiSelectOption[];
  onValueChange: (value: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  ariaLabel?: string;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  maxBadges?: number;
}

type Row = {
  id: string;
  option: MultiSelectOption;
  searchableValue: string;
};

function getSearchableValue(option: MultiSelectOption): string {
  return [option.label, option.searchText ?? "", option.value].join(" ").trim();
}

function toDomId(value: string): string {
  return Array.from(value)
    .map((c) => (/^[A-Za-z0-9_-]$/.test(c) ? c : `_${c.codePointAt(0)?.toString(36) ?? "0"}_`))
    .join("");
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  value,
  options,
  onValueChange,
  placeholder,
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  ariaLabel,
  disabled = false,
  triggerClassName,
  contentClassName,
  maxBadges = 3,
}) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [listElement, setListElement] = React.useState<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const deferredQuery = React.useDeferredValue(query);
  const listId = React.useId();
  const [activeRowId, setActiveRowId] = React.useState<string | null>(null);

  const selectedSet = React.useMemo(() => new Set(value), [value]);

  const filteredOptions = React.useMemo(() => {
    const trimmed = deferredQuery.trim().toLowerCase();
    if (!trimmed) return options;
    return options.filter((o) => getSearchableValue(o).toLowerCase().includes(trimmed));
  }, [deferredQuery, options]);

  const rows = React.useMemo<Row[]>(() =>
    filteredOptions.map((option) => ({
      id: `${toDomId(listId)}-${toDomId(option.value)}`,
      option,
      searchableValue: getSearchableValue(option),
    })),
    [filteredOptions, listId],
  );

  const rowIds = React.useMemo(() => rows.map((r) => r.id), [rows]);
  const selectableRows = React.useMemo(() => rows.filter((r) => !r.option.disabled), [rows]);
  const activeRowIndex = activeRowId ? rowIds.indexOf(activeRowId) : -1;
  const activeRow = activeRowIndex >= 0 ? rows[activeRowIndex] : null;

  const setListRef = React.useCallback((el: HTMLDivElement | null) => setListElement(el), []);

  const { scrollToIndex, measureElement, getVirtualItems, getTotalSize } =
    useVirtualizedListbox<HTMLButtonElement>({
      count: rows.length,
      estimateSize: () => 40,
      getItemKey: (index: number) => rows[index]?.id ?? index,
      initialRect: { width: 320, height: 256 },
      overscan: 8,
      scrollElement: listElement,
    });

  React.useEffect(() => {
    if (!open) return;
    setActiveRowId(selectableRows[0]?.id ?? null);
  }, [open, selectableRows]);

  React.useEffect(() => {
    if (!open || activeRowIndex < 0) return;
    scrollToIndex(activeRowIndex, { align: "auto" });
  }, [activeRowIndex, open, scrollToIndex]);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const toggleOption = React.useCallback(
    (optionValue: string) => {
      const next = new Set(selectedSet);
      if (next.has(optionValue)) {
        next.delete(optionValue);
      } else {
        next.add(optionValue);
      }
      onValueChange(Array.from(next));
    },
    [selectedSet, onValueChange],
  );

  const moveActive = React.useCallback(
    (direction: 1 | -1) => {
      if (!selectableRows.length) return;
      const currentIndex = selectableRows.findIndex((r) => r.id === activeRowId);
      const nextIndex = (currentIndex + direction + selectableRows.length) % selectableRows.length;
      setActiveRowId(selectableRows[nextIndex]?.id ?? null);
    },
    [activeRowId, selectableRows],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); moveActive(1); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); moveActive(-1); return; }
    if (event.key === "Home") { event.preventDefault(); setActiveRowId(selectableRows[0]?.id ?? null); return; }
    if (event.key === "End") { event.preventDefault(); setActiveRowId(selectableRows[selectableRows.length - 1]?.id ?? null); return; }
    if (event.key === "Enter" && activeRow && !activeRow.option.disabled) {
      event.preventDefault();
      toggleOption(activeRow.option.value);
    }
  };

  const selectedOptions = options.filter((o) => selectedSet.has(o.value));
  const visibleBadges = selectedOptions.slice(0, maxBadges);
  const overflowCount = selectedOptions.length - visibleBadges.length;

  const triggerContent =
    selectedOptions.length === 0 ? (
      <span className="text-muted-foreground">{placeholder}</span>
    ) : (
      <span className="flex flex-wrap gap-1">
        {visibleBadges.map((o) => (
          <Badge key={o.value} variant="secondary" className="gap-1 pr-1 text-xs">
            {o.label}
            <button
              type="button"
              aria-label={`Remove ${o.label}`}
              className="rounded hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                toggleOption(o.value);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {overflowCount > 0 && (
          <Badge variant="outline" className="text-xs">+{overflowCount} more</Badge>
        )}
      </span>
    );

  const virtualItems = getVirtualItems();

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) { setQuery(""); setActiveRowId(null); }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn("h-auto min-h-10 justify-between", triggerClassName)}
        >
          <span className="flex-1 text-left">{triggerContent}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-[320px] p-0", contentClassName)}>
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={activeRowId ?? undefined}
            aria-autocomplete="list"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div
          ref={setListRef}
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={ariaLabel}
          className="max-h-56 overflow-y-auto overflow-x-hidden"
          onWheelCapture={(e) => e.stopPropagation()}
        >
          {rows.length === 0 ? (
            <div className="py-6 text-center text-sm">{emptyText}</div>
          ) : (
            <div className="relative w-full" style={{ height: getTotalSize() }}>
              {virtualItems.map((virtualItem) => {
                const row = rows[virtualItem.index];
                if (!row) return null;
                const selected = selectedSet.has(row.option.value);
                const isActive = row.id === activeRowId;

                return (
                  <button
                    key={virtualItem.key}
                    ref={measureElement}
                    type="button"
                    data-index={virtualItem.index}
                    role="option"
                    tabIndex={-1}
                    aria-selected={selected}
                    aria-disabled={row.option.disabled}
                    id={row.id}
                    className={cn(
                      "absolute left-0 top-0 flex w-full cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none",
                      isActive ? "bg-accent text-accent-foreground" : "",
                      row.option.disabled
                        ? "pointer-events-none opacity-50"
                        : "hover:bg-accent/80 hover:text-accent-foreground",
                    )}
                    style={{ transform: `translateY(${virtualItem.start}px)` }}
                    onMouseEnter={() => { if (!row.option.disabled) setActiveRowId(row.id); }}
                    onClick={() => { if (!row.option.disabled) toggleOption(row.option.value); }}
                  >
                    <div className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground",
                    )}>
                      {selected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate">{row.option.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {selectedOptions.length > 0 && (
          <div className="border-t px-3 py-2">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onValueChange([])}
            >
              Clear all ({selectedOptions.length})
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
