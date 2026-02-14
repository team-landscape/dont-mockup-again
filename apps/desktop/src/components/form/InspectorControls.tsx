import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import { normalizeLocaleTag } from '../../lib/project-model';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';

interface LabeledFieldProps {
  label: string;
  children: ReactNode;
}

export function LabeledField({ label, children }: LabeledFieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

interface SwitchRowProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function SwitchRow({ label, checked, onCheckedChange, disabled = false }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
      <Label className="text-xs">{label}</Label>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}

export function NumberField({ label, value, onValueChange, disabled = false }: NumberFieldProps) {
  return (
    <LabeledField label={label}>
      <Input
        type="number"
        disabled={disabled}
        value={Number.isFinite(value) ? String(value) : ''}
        onChange={(event) => onValueChange(Number(event.target.value))}
      />
    </LabeledField>
  );
}

const HEX_COLOR_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(HEX_COLOR_PATTERN);
  if (!match) return null;
  const raw = match[1].toLowerCase();
  if (raw.length === 6) return `#${raw}`;
  return `#${raw.split('').map((char) => `${char}${char}`).join('')}`;
}

interface ColorFieldProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  fallbackColor?: string;
}

export function ColorField({ label, value, onValueChange, fallbackColor = '#111827' }: ColorFieldProps) {
  const normalizedHex = normalizeHexColor(value);
  const pickerValue = normalizedHex || fallbackColor;
  const isTransparent = value.trim().toLowerCase() === 'transparent';
  const previewStyle: CSSProperties = isTransparent
    ? {
      backgroundImage: [
        'linear-gradient(45deg, rgba(148,163,184,0.35) 25%, transparent 25%)',
        'linear-gradient(-45deg, rgba(148,163,184,0.35) 25%, transparent 25%)',
        'linear-gradient(45deg, transparent 75%, rgba(148,163,184,0.35) 75%)',
        'linear-gradient(-45deg, transparent 75%, rgba(148,163,184,0.35) 75%)'
      ].join(','),
      backgroundSize: '10px 10px',
      backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0'
    }
    : { backgroundColor: normalizedHex || value || fallbackColor };

  return (
    <LabeledField label={label}>
      <div className="flex items-center gap-2">
        <div
          className="h-9 w-9 rounded-md border bg-muted"
          style={previewStyle}
          aria-label={`${label} preview`}
        />
        <Input
          value={value}
          placeholder="#111827"
          className="font-mono text-xs"
          onChange={(event) => onValueChange(event.target.value)}
        />
        <Input
          type="color"
          value={pickerValue}
          className="h-9 w-12 cursor-pointer p-1"
          onChange={(event) => onValueChange(event.target.value)}
          aria-label={`${label} picker`}
        />
      </div>
    </LabeledField>
  );
}

interface LocaleSelectorProps {
  value: string[];
  options: string[];
  onChange: (next: string[]) => void;
}

interface FontSelectorProps {
  value: string;
  options: string[];
  onChange: (next: string) => void;
}

interface InspectorCopyFieldsProps {
  locale: string;
  titleValue: string;
  subtitleValue: string;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
}

export const InspectorCopyFields = memo(function InspectorCopyFields({
  locale,
  titleValue,
  subtitleValue,
  onTitleChange,
  onSubtitleChange
}: InspectorCopyFieldsProps) {
  const [titleDraft, setTitleDraft] = useState(titleValue);
  const [subtitleDraft, setSubtitleDraft] = useState(subtitleValue);

  useEffect(() => {
    setTitleDraft(titleValue);
  }, [titleValue]);

  useEffect(() => {
    setSubtitleDraft(subtitleValue);
  }, [subtitleValue]);

  useEffect(() => {
    if (titleDraft === titleValue) return;
    const timer = window.setTimeout(() => {
      onTitleChange(titleDraft);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [onTitleChange, titleDraft, titleValue]);

  useEffect(() => {
    if (subtitleDraft === subtitleValue) return;
    const timer = window.setTimeout(() => {
      onSubtitleChange(subtitleDraft);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [onSubtitleChange, subtitleDraft, subtitleValue]);

  return (
    <>
      <LabeledField label={`Title (${locale})`}>
        <Input
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
        />
      </LabeledField>

      <LabeledField label={`Subtitle (${locale})`}>
        <Textarea
          value={subtitleDraft}
          onChange={(event) => setSubtitleDraft(event.target.value)}
          className="min-h-[92px]"
        />
      </LabeledField>
    </>
  );
});

export function LocaleSelector({ value, options, onChange }: LocaleSelectorProps) {
  const [search, setSearch] = useState('');
  const [customLocale, setCustomLocale] = useState('');
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const merged = useMemo(
    () => [...new Set([...options, ...value])].sort((a, b) => a.localeCompare(b)),
    [options, value]
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return merged;
    return merged.filter((locale) => locale.toLowerCase().includes(query));
  }, [merged, search]);

  const label = value.length === 0
    ? 'Select locales'
    : `${value.length} locale(s) selected`;

  function addCustomLocale() {
    const normalized = normalizeLocaleTag(customLocale);
    if (!normalized) return;
    if (!value.includes(normalized)) {
      onChange([...value, normalized]);
    }
    setCustomLocale('');
  }

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (!details || !details.open) return;
      if (event.target instanceof Node && details.contains(event.target)) return;
      details.open = false;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const details = detailsRef.current;
      if (!details || !details.open) return;
      details.open = false;
    };

    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);

  return (
    <details ref={detailsRef} className="group relative">
      <summary className="flex h-9 cursor-pointer list-none items-center justify-between rounded-md border border-input bg-background px-3 text-sm">
        <span>{label}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div data-native-wheel className="absolute z-30 mt-1 w-full rounded-md border bg-popover p-2 shadow-md">
        <div className="mb-2 grid gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search locales"
            className="h-8"
          />
          <div className="flex gap-2">
            <Input
              value={customLocale}
              onChange={(event) => setCustomLocale(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addCustomLocale();
                }
              }}
              placeholder="Add locale (e.g. es-MX)"
              className="h-8"
            />
            <Button type="button" size="sm" variant="outline" onClick={addCustomLocale}>
              Add
            </Button>
          </div>
        </div>

        <ScrollArea className="h-56 pr-2">
          <div className="grid gap-1.5">
            {filtered.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">No locale found.</p>
            ) : null}

            {filtered.map((locale) => {
              const checked = value.includes(locale);
              return (
                <label key={locale} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/60">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={checked}
                    onChange={(event) => {
                      if (event.target.checked) {
                        onChange([...value, locale]);
                        return;
                      }

                      if (value.length <= 1) {
                        return;
                      }

                      onChange(value.filter((entry) => entry !== locale));
                    }}
                  />
                  <span className="text-sm">{locale}</span>
                </label>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </details>
  );
}

export function FontSelector({ value, options, onChange }: FontSelectorProps) {
  const [search, setSearch] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const normalizedOptions = useMemo(
    () => [...new Set(options.map((font) => font.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [options]
  );
  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    const next = query
      ? normalizedOptions.filter((font) => font.toLowerCase().includes(query))
      : normalizedOptions;
    return next;
  }, [normalizedOptions, search]);

  const rowHeight = 32;
  const viewportHeight = 224;
  const overscan = 6;
  const totalCount = filteredOptions.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    totalCount,
    startIndex + Math.ceil(viewportHeight / rowHeight) + (overscan * 2)
  );
  const virtualItems = filteredOptions.slice(startIndex, endIndex);
  const topOffset = startIndex * rowHeight;
  const totalHeight = totalCount * rowHeight;

  useEffect(() => {
    setScrollTop(0);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [search]);

  useEffect(() => {
    const details = detailsRef.current;
    if (!details) return;

    const handleToggle = () => {
      if (!details.open) return;
      const selectedIndex = filteredOptions.findIndex((font) => font === value);
      if (selectedIndex < 0 || !listRef.current) return;
      const targetScroll = Math.max(0, (selectedIndex * rowHeight) - Math.floor(viewportHeight / 2));
      listRef.current.scrollTop = targetScroll;
      setScrollTop(targetScroll);
    };

    details.addEventListener('toggle', handleToggle);
    return () => details.removeEventListener('toggle', handleToggle);
  }, [filteredOptions, value]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (!details || !details.open) return;
      if (event.target instanceof Node && details.contains(event.target)) return;
      details.open = false;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const details = detailsRef.current;
      if (!details || !details.open) return;
      details.open = false;
    };

    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);

  const label = value || 'Select font';

  return (
    <details ref={detailsRef} className="group relative">
      <summary className="flex h-9 cursor-pointer list-none items-center justify-between rounded-md border border-input bg-background px-3 text-sm">
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div data-native-wheel className="absolute z-30 mt-1 w-full rounded-md border bg-popover p-2 shadow-md">
        <div className="mb-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search fonts"
            className="h-8"
          />
        </div>

        <div
          ref={listRef}
          className="h-56 overflow-y-auto pr-1"
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <div style={{ height: totalHeight }}>
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">No font found.</p>
            ) : null}

            <div style={{ transform: `translateY(${topOffset}px)` }}>
              {virtualItems.map((font) => {
                const selected = font === value;
                return (
                  <button
                    key={font}
                    type="button"
                    className={`flex h-8 w-full items-center rounded-md px-2 text-left text-sm hover:bg-muted/60 ${selected ? 'bg-muted font-medium' : ''}`}
                    onClick={() => {
                      onChange(font);
                      const details = detailsRef.current;
                      if (details) details.open = false;
                    }}
                  >
                    <span className="truncate">{font}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
