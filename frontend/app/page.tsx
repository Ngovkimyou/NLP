"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const sourceLanguages = ["Auto Detect", "English", "Chinese", "Japanese"];
const targetLanguages = ["English", "Chinese", "Japanese"];
const tones = ["Casual", "Polite", "Business"];

const API_BASE_URL = (() => {
  if (globalThis.window && globalThis.window.location.hostname !== "localhost") {
    // Production: use relative path that Vercel will route to backend
    return "/_/backend";
  }
  // Development: use environment variable or default
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
})();
const MAX_INPUT_LENGTH = 100;
const COPY_STATUS_DURATION_MS = 1800;

type SourceLanguage = "auto" | "english" | "chinese" | "japanese";
type TargetLanguage = "english" | "chinese" | "japanese";
type Tone = "casual" | "polite" | "business";
type CopyTarget = "translation" | "romanization" | "meanings";

type TranslationResponse = {
  detected_language: "english" | "chinese" | "japanese";
  target_language: TargetLanguage;
  tone: Tone;
  translation: string;
  romanization: string | null;
  explanation: string;
  ambiguous_terms: Array<{
    term: string;
    chosen_meaning: string;
    other_meanings: string[];
  }>;
};

type MeaningTerm = TranslationResponse["ambiguous_terms"][number];

type TranslationHistoryItem = {
  id: number;
  input: string;
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  tone: Tone;
  result: TranslationResponse;
};

const labelToSourceValue: Record<string, SourceLanguage> = {
  "Auto Detect": "auto",
  English: "english",
  Chinese: "chinese",
  Japanese: "japanese",
};

const labelToTargetValue: Record<string, TargetLanguage> = {
  English: "english",
  Chinese: "chinese",
  Japanese: "japanese",
};

const labelToToneValue: Record<string, Tone> = {
  Casual: "casual",
  Polite: "polite",
  Business: "business",
};

const sourceValueToLabel: Record<SourceLanguage, string> = {
  auto: "Auto Detect",
  english: "English",
  chinese: "Chinese",
  japanese: "Japanese",
};

const targetValueToLabel: Record<TargetLanguage, string> = {
  english: "English",
  chinese: "Chinese",
  japanese: "Japanese",
};

const toneValueToLabel: Record<Tone, string> = {
  casual: "Casual",
  polite: "Polite",
  business: "Business",
};

export default function Home() {
  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>("auto");
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>("japanese");
  const [tone, setTone] = useState<Tone>("polite");
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<TranslationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [translationHistory, setTranslationHistory] = useState<
    TranslationHistoryItem[]
  >([]);
  const [copyStatus, setCopyStatus] = useState<CopyTarget | null>(null);
  const debounceRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null
  );
  const copyResetRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null
  );
  const skipNextAutoTranslateRef = useRef(false);
  const hasInput = inputText.trim().length > 0;
  const isAtInputLimit = inputText.length >= MAX_INPUT_LENGTH;
  const meaningTerms = result?.ambiguous_terms ?? [];
  let translationText = "";
  let detailText = isAtInputLimit
    ? `Text limit reached. Please keep translations under ${MAX_INPUT_LENGTH} characters.`
    : "";
  let meaningsStatus = "Awaiting input.";

  if (hasInput) {
    if (result?.translation) {
      translationText = result.translation;
    } else if (isLoading) {
      translationText = "Translating...";
    }

    detailText =
      error ||
      detailText ||
      "";

    if (error) {
      meaningsStatus = "Meaning scan is paused until translation succeeds.";
    } else if (isLoading) {
      meaningsStatus = "Scanning possible meanings...";
    } else if (meaningTerms.length === 0) {
      meaningsStatus = "No tracked ambiguous words found.";
    } else {
      meaningsStatus = "";
    }
  }

  const startTranslation = useCallback(
    async (textToTranslate: string) => {
      const trimmedText = textToTranslate.trim();

      if (!trimmedText) {
        return;
      }

      setIsLoading(true);
      setError(null);
      setCopyStatus(null);

      try {
        const response = await fetch(`${API_BASE_URL}/translate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: trimmedText,
            source_language: sourceLanguage,
            target_language: targetLanguage,
            tone,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const message =
            typeof errorData?.detail === "string"
              ? errorData.detail
              : "Translation request failed.";
          throw new Error(message);
        }

        const data: TranslationResponse = await response.json();
        setResult(data);
        setTranslationHistory((currentHistory) => [
          {
            id: Date.now(),
            input: trimmedText,
            sourceLanguage,
            targetLanguage,
            tone,
            result: data,
          },
          ...currentHistory,
        ].slice(0, 10));
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to reach the backend. Make sure FastAPI is running."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [sourceLanguage, targetLanguage, tone]
  );

  useEffect(() => {
    if (!hasInput) {
      if (debounceRef.current) {
        globalThis.clearTimeout(debounceRef.current);
      }
      return;
    }

    if (!autoTranslate) {
      return;
    }

    if (skipNextAutoTranslateRef.current) {
      skipNextAutoTranslateRef.current = false;
      return;
    }

    if (debounceRef.current) {
      globalThis.clearTimeout(debounceRef.current);
    }

    debounceRef.current = globalThis.setTimeout(() => {
      void startTranslation(inputText);
    }, 450);

    return () => {
      if (debounceRef.current) {
        globalThis.clearTimeout(debounceRef.current);
      }
    };
  }, [autoTranslate, hasInput, inputText, startTranslation]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) {
        globalThis.clearTimeout(copyResetRef.current);
      }
    };
  }, []);

  function handleInputChange(value: string) {
    const nextValue = value.slice(0, MAX_INPUT_LENGTH);

    setInputText(nextValue);

    if (nextValue.trim().length === 0) {
      if (debounceRef.current) {
        globalThis.clearTimeout(debounceRef.current);
      }

      setResult(null);
      setError(null);
      setIsLoading(false);
      setCopyStatus(null);
    }
  }

  function handleSwap() {
    const previousInput = inputText;
    const previousTranslation = result?.translation ?? "";
    const nextSourceLanguage: SourceLanguage = targetLanguage;
    const nextTargetLanguage: TargetLanguage =
      sourceLanguage === "auto"
        ? result?.detected_language ?? "english"
        : (sourceLanguage as TargetLanguage);

    if (debounceRef.current) {
      globalThis.clearTimeout(debounceRef.current);
    }

    setSourceLanguage(nextSourceLanguage);
    setTargetLanguage(nextTargetLanguage);
    setError(null);
    setIsLoading(false);

    if (previousTranslation.trim().length === 0) {
      setResult(null);
      return;
    }

    setInputText(previousTranslation.slice(0, MAX_INPUT_LENGTH));
    setResult({
      detected_language: nextSourceLanguage,
      target_language: nextTargetLanguage,
      tone,
      translation: previousInput,
      romanization: null,
      explanation: "",
      ambiguous_terms: [],
    });
  }

  async function handleCopy(target: CopyTarget, value: string) {
    if (!value.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(target);

      if (copyResetRef.current) {
        globalThis.clearTimeout(copyResetRef.current);
      }

      copyResetRef.current = globalThis.setTimeout(() => {
        setCopyStatus(null);
      }, COPY_STATUS_DURATION_MS);
    } catch {
      setError("Unable to copy. Please check your browser clipboard permission.");
    }
  }

  function restoreHistoryItem(item: TranslationHistoryItem) {
    if (debounceRef.current) {
      globalThis.clearTimeout(debounceRef.current);
    }

    skipNextAutoTranslateRef.current = true;
    setInputText(item.input.slice(0, MAX_INPUT_LENGTH));
    setSourceLanguage(item.sourceLanguage);
    setTargetLanguage(item.targetLanguage);
    setTone(item.tone);
    setResult(item.result);
    setError(null);
    setIsLoading(false);
  }

  const meaningsCopyText = formatMeaningsForCopy(meaningTerms);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#070b1a] px-2 py-3 text-white sm:px-5 sm:py-4 md:px-6 lg:px-8">
      <BackgroundGlow />

      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl items-center justify-center sm:min-h-[calc(100vh-2.5rem)]">
        <section className="w-full min-w-0 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(12,19,40,0.94),rgba(9,14,31,0.92))] p-2 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.95)] backdrop-blur sm:rounded-[28px] sm:p-4 lg:rounded-[34px] lg:p-5">
          <header className="relative overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(135deg,rgba(33,49,89,0.95),rgba(21,27,57,0.98))] px-2 py-3 sm:px-4 sm:py-4 lg:rounded-[28px] lg:px-5 lg:py-5">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-8 top-0 h-px w-28 bg-linear-to-r from-transparent via-cyan-300/70 to-transparent lg:w-32" />
              <div className="absolute bottom-4 left-1/2 hidden h-px w-28 -translate-x-1/2 bg-linear-to-r from-transparent via-fuchsia-300/40 to-transparent sm:block lg:w-40" />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3 md:gap-4">
              <div className="flex justify-end">
                <SelectChip
                  value={sourceValueToLabel[sourceLanguage]}
                  options={sourceLanguages}
                  accent="cyan"
                  onChange={(value) =>
                    setSourceLanguage(labelToSourceValue[value])
                  }
                />
              </div>

              <div className="flex justify-center">
                <SwapButton onClick={handleSwap} />
              </div>

              <div className="flex justify-start">
                <div className="grid w-full gap-2 lg:gap-3">
                  <SelectChip
                    value={targetValueToLabel[targetLanguage]}
                    options={targetLanguages}
                    accent="fuchsia"
                    onChange={(value) =>
                      setTargetLanguage(labelToTargetValue[value])
                    }
                  />
                  <SelectChip
                    value={toneValueToLabel[tone]}
                    options={tones}
                    accent="violet"
                    onChange={(value) => setTone(labelToToneValue[value])}
                  />
                </div>
              </div>
            </div>

            <div className="mx-auto mt-5 grid w-full max-w-72 grid-cols-2 items-center justify-center gap-2 sm:mt-4 sm:flex sm:max-w-none sm:flex-wrap sm:gap-3">
              <label className="flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-cyan-200/12 bg-white/4 px-2 py-1.5 text-[11px] font-semibold text-cyan-50/85 sm:min-h-11 sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-2 sm:text-sm">
                <input
                  type="checkbox"
                  checked={autoTranslate}
                  onChange={(event) => setAutoTranslate(event.target.checked)}
                  className="h-3 w-3 shrink-0 accent-cyan-300 sm:h-4 sm:w-4"
                />
                <span className="min-w-0 truncate">Auto</span>
              </label>
              <button
                type="button"
                onClick={() => void startTranslation(inputText)}
                disabled={!hasInput || isLoading}
                className="min-h-8 min-w-0 rounded-xl border border-fuchsia-200/16 bg-fuchsia-200/10 px-2 py-1.5 text-[11px] font-semibold text-fuchsia-50 transition hover:bg-fuchsia-200/16 disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-11 sm:rounded-2xl sm:px-5 sm:py-2 sm:text-sm"
              >
                <span className="block truncate">
                  {isLoading ? "Translating..." : "Translate"}
                </span>
              </button>
            </div>
          </header>

          <section className="mt-4 grid gap-4 md:mt-5 md:gap-5 xl:grid-cols-2">
            <PanelShell accent="cyan" compactOnMobile>
              <textarea
                className="min-h-22 w-full resize-none wrap-break-word bg-transparent text-sm leading-6 text-slate-50 outline-none placeholder:text-slate-500 sm:min-h-28 sm:text-base md:min-h-55 md:text-[18px] md:leading-8 lg:min-h-80 lg:text-[22px] lg:leading-9"
                placeholder="Enter text..."
                value={inputText}
                maxLength={MAX_INPUT_LENGTH}
                onChange={(event) => handleInputChange(event.target.value)}
              />
              <div className="mt-3 text-right text-xs font-medium text-cyan-100/55">
                {inputText.length}/{MAX_INPUT_LENGTH}
              </div>
              {isAtInputLimit && (
                <p className="mt-2 text-right text-xs font-semibold text-amber-200">
                  Text limit reached. Please shorten your input.
                </p>
              )}
            </PanelShell>

            <PanelShell accent="fuchsia">
              <div className="flex h-full min-h-42 flex-col sm:min-h-47.5 md:min-h-55 lg:min-h-80">
                <div className="relative flex-1">
                  <div className="absolute right-0 top-0">
                    <CopyControl
                      copied={copyStatus === "translation"}
                      label="Copy translation"
                      disabled={!result?.translation}
                      onClick={() =>
                        void handleCopy("translation", result?.translation ?? "")
                      }
                    />
                  </div>
                  <p className="wrap-break-word pr-10 text-sm leading-6 text-white sm:pr-11 sm:text-base md:text-[18px] md:leading-8 lg:text-[22px] lg:leading-9">
                    {translationText}
                  </p>
                </div>
                <div className="mt-4 border-t border-white/8 pt-4 text-[13px] leading-6 text-cyan-100/70 sm:text-sm md:mt-5 md:pt-5 md:leading-7">
                  {result?.romanization && (
                    <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-white/3 px-3 py-2">
                      <p className="min-w-0 wrap-break-word">{result.romanization}</p>
                      <CopyControl
                        copied={copyStatus === "romanization"}
                        label="Copy romanization"
                        onClick={() =>
                          void handleCopy(
                            "romanization",
                            stripRomanizationLabel(result.romanization ?? "")
                          )
                        }
                      />
                    </div>
                  )}
                  {detailText}
                </div>
              </div>
            </PanelShell>

            <PanelShell accent="cyan" className="xl:col-span-2">
              <div className="flex min-h-50 flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
                  <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100/55 sm:text-xs sm:tracking-[0.18em]">
                    Possible Meaning
                  </p>
                  <div className="flex items-center gap-2">
                    <CopyControl
                      copied={copyStatus === "meanings"}
                      label="Copy meanings"
                      disabled={meaningTerms.length === 0}
                      onClick={() => void handleCopy("meanings", meaningsCopyText)}
                    />
                    <p className="shrink-0 text-[11px] font-medium text-fuchsia-100/60 sm:text-xs">
                      {meaningTerms.length} found
                    </p>
                  </div>
                </div>

                {meaningsStatus ? (
                  <p className="flex flex-1 items-center text-sm leading-6 text-cyan-100/70 sm:text-base">
                    {meaningsStatus}
                  </p>
                ) : (
                  <div className="grid flex-1 gap-3 pt-4 md:grid-cols-2">
                    {meaningTerms.map((item) => (
                      <article
                        key={item.term}
                        className="min-w-0 rounded-2xl border border-white/8 bg-white/3 p-3 sm:p-4"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <h2 className="text-base font-semibold text-white sm:text-lg">
                            <span className="wrap-break-word">{item.term}</span>
                          </h2>
                        </div>
                        <p className="mt-2 wrap-break-word text-[13px] leading-6 text-cyan-50/85 sm:text-sm">
                          {item.chosen_meaning}
                        </p>
                        {item.other_meanings.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.other_meanings.map((meaning) => (
                              <span
                                key={meaning}
                                className="max-w-full wrap-break-word rounded-full border border-fuchsia-200/12 bg-fuchsia-200/8 px-2.5 py-1 text-[11px] font-medium text-fuchsia-50/78 sm:px-3 sm:text-xs"
                              >
                                {meaning}
                              </span>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </PanelShell>

            <PanelShell accent="fuchsia" className="xl:col-span-2" dense>
              <div className="flex min-h-38 flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
                  <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-fuchsia-100/55 sm:text-xs sm:tracking-[0.18em]">
                    Translation History
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={translationHistory.length === 0}
                      onClick={() => setTranslationHistory([])}
                      className="rounded-xl border border-fuchsia-200/12 bg-fuchsia-200/8 px-2.5 py-1.5 text-[11px] font-semibold text-fuchsia-50/75 transition hover:bg-fuchsia-200/14 disabled:cursor-not-allowed disabled:opacity-35 sm:px-3 sm:text-xs"
                    >
                      Clear
                    </button>
                    <p className="shrink-0 text-[11px] font-medium text-cyan-100/60 sm:text-xs">
                      {translationHistory.length}/10
                    </p>
                  </div>
                </div>

                {translationHistory.length === 0 ? (
                  <p className="flex flex-1 items-center text-sm leading-6 text-cyan-100/70 sm:text-base">
                    No translations yet.
                  </p>
                ) : (
                  <div className="grid flex-1 gap-3 pt-4 lg:grid-cols-2">
                    {translationHistory.map((item) => (
                      <article
                        key={item.id}
                        className="min-h-24 min-w-0 rounded-2xl border border-white/8 bg-white/3 p-3 sm:p-4"
                      >
                        <div className="flex h-full items-center justify-between gap-3">
                          <div className="min-w-0 py-1">
                            <p className="wrap-break-word text-[13px] font-semibold text-white sm:text-sm">
                              {item.input}
                            </p>
                            <p className="mt-1 line-clamp-2 wrap-break-word text-[13px] leading-6 text-cyan-50/75 sm:text-sm">
                              {item.result.translation}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => restoreHistoryItem(item)}
                            className="shrink-0 rounded-xl border border-cyan-200/12 bg-cyan-200/8 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-50/80 transition hover:bg-cyan-200/14 sm:px-3 sm:text-xs"
                          >
                            Restore
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </PanelShell>
          </section>
        </section>
      </div>
    </main>
  );
}

function BackgroundGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-[-8%] top-[-12%] h-72 w-72 rounded-full bg-fuchsia-500/18 blur-3xl sm:h-80 sm:w-80" />
      <div className="absolute right-[-8%] top-[8%] h-80 w-80 rounded-full bg-cyan-400/18 blur-3xl sm:h-96 sm:w-96" />
      <div className="absolute bottom-[-10%] left-[18%] h-64 w-64 rounded-full bg-violet-500/16 blur-3xl sm:h-72 sm:w-72" />
    </div>
  );
}

function SwapButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-10 w-10 items-center justify-center rounded-full border border-white/16 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),rgba(120,119,255,0.14)_35%,rgba(14,20,42,0.96)_72%)] text-sm text-cyan-200 shadow-[0_0_24px_rgba(56,189,248,0.25),0_0_48px_rgba(217,70,239,0.12)] transition duration-200 hover:scale-[1.03] hover:text-white sm:h-14 sm:w-14 sm:text-lg lg:h-16 lg:w-16 lg:text-xl"
      aria-label="Swap languages"
    >
      <span className="absolute inset-1.25 rounded-full border border-cyan-300/20" />
      <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,rgba(34,211,238,0.2),rgba(217,70,239,0.18),rgba(34,211,238,0.2))] opacity-60 blur-[2px]" />
      <span className="relative">{"\u2194"}</span>
    </button>
  );
}

function SelectChip({
  value,
  options,
  accent,
  onChange,
}: Readonly<{
  value: string;
  options: string[];
  accent: "cyan" | "fuchsia" | "violet";
  onChange: (value: string) => void;
}>) {
  const accentStyles = {
    cyan: "border-cyan-300/18 shadow-[0_0_28px_rgba(34,211,238,0.08)] before:bg-cyan-300/70",
    fuchsia:
      "border-fuchsia-300/18 shadow-[0_0_28px_rgba(217,70,239,0.08)] before:bg-fuchsia-300/70",
    violet:
      "border-violet-300/18 shadow-[0_0_28px_rgba(167,139,250,0.08)] before:bg-violet-300/70",
  } as const;

  return (
    <label
      className={`relative w-full rounded-2xl border bg-[linear-gradient(180deg,rgba(9,15,31,0.96),rgba(10,18,36,0.88))] px-2 py-2 before:absolute before:left-2 before:top-1/2 before:h-4 before:w-px before:-translate-y-1/2 sm:rounded-[20px] sm:px-4 sm:py-3 sm:before:left-3 md:rounded-[21px] md:px-4 md:py-3 md:before:left-3.5 lg:rounded-[22px] lg:px-5 lg:py-4 lg:before:left-4 lg:before:h-6 ${accentStyles[accent]}`}
    >
      <select
        className="w-full appearance-none bg-transparent text-center text-[11px] font-semibold text-white outline-none sm:text-sm md:text-[15px] lg:text-base"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option} className="text-slate-950">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function CopyControl({
  copied,
  label,
  disabled = false,
  onClick,
}: Readonly<{
  copied: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}>) {
  return (
    <div className="flex min-h-7 items-center gap-1.5 sm:min-h-8 sm:gap-2">
      {copied && (
        <span className="text-[11px] font-semibold text-cyan-100/70 sm:text-xs">
          Copied
        </span>
      )}
      <IconButton label={label} disabled={disabled} onClick={onClick} />
    </div>
  );
}

function IconButton({
  label,
  disabled = false,
  onClick,
}: Readonly<{
  label: string;
  disabled?: boolean;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-cyan-50/75 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 sm:h-8 sm:w-8"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 sm:h-4 sm:w-4"
        fill="none"
      >
        <path
          d="M8 8.5C8 7.12 9.12 6 10.5 6H17c1.38 0 2.5 1.12 2.5 2.5V15c0 1.38-1.12 2.5-2.5 2.5h-6.5A2.5 2.5 0 0 1 8 15V8.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M5 13.5V7c0-1.1.9-2 2-2h6.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
      </svg>
    </button>
  );
}

function formatMeaningsForCopy(terms: MeaningTerm[]) {
  return terms
    .map((term) => {
      const otherMeanings = term.other_meanings.length
        ? ` Other meanings: ${term.other_meanings.join(", ")}.`
        : "";
      return `${term.term}: ${term.chosen_meaning}.${otherMeanings}`;
    })
    .join("\n");
}

function stripRomanizationLabel(value: string) {
  return value.replace(/^(Romaji|Pinyin):\s*/i, "");
}

function PanelShell({
  children,
  accent,
  compactOnMobile = false,
  className = "",
  dense = false,
}: Readonly<{
  children: React.ReactNode;
  accent: "cyan" | "fuchsia";
  compactOnMobile?: boolean;
  className?: string;
  dense?: boolean;
}>) {
  const minHeightClass = getPanelMinHeightClass(dense, compactOnMobile);
  const accentStyles = {
    cyan: "before:from-cyan-300/70 before:via-cyan-200/0 border-cyan-300/10 shadow-[0_0_0_1px_rgba(34,211,238,0.04)]",
    fuchsia:
      "before:from-fuchsia-300/70 before:via-fuchsia-200/0 border-fuchsia-300/10 shadow-[0_0_0_1px_rgba(217,70,239,0.04)]",
  } as const;

  return (
    <section
      className={`min-w-0 rounded-[18px] border bg-[linear-gradient(180deg,rgba(23,31,64,0.95),rgba(13,19,39,0.98))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:rounded-3xl sm:p-3 md:rounded-[28px] md:p-4 lg:rounded-[30px] ${minHeightClass} ${accentStyles[accent]} ${className}`}
    >
      <div
        className={`relative h-full min-w-0 rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,15,32,0.95),rgba(7,13,28,0.98))] p-3 before:pointer-events-none before:absolute before:left-3 before:top-0 before:h-px before:w-16 before:bg-linear-to-r before:to-transparent sm:rounded-[20px] sm:p-4 md:rounded-[22px] md:p-5 md:before:left-5 md:before:w-28 ${accentStyles[accent]}`}
      >
        <div className="relative h-full">{children}</div>
      </div>
    </section>
  );
}

function getPanelMinHeightClass(dense: boolean, compactOnMobile: boolean) {
  if (dense) {
    return "min-h-0";
  }

  if (compactOnMobile) {
    return "min-h-37.5 sm:min-h-43 md:min-h-75";
  }

  return "min-h-55 sm:min-h-60 md:min-h-75";
}
