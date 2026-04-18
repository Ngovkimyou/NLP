"use client";

import { useEffect, useRef, useState } from "react";

const sourceLanguages = ["Auto Detect", "English", "Chinese", "Japanese"];
const targetLanguages = ["English", "Chinese", "Japanese"];
const tones = ["Casual", "Polite", "Business"];

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SourceLanguage = "auto" | "english" | "chinese" | "japanese";
type TargetLanguage = "english" | "chinese" | "japanese";
type Tone = "casual" | "polite" | "business";

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
  const [inputText, setInputText] = useState(
    "Can you send me the file tomorrow? I need it for the meeting."
  );
  const [result, setResult] = useState<TranslationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null
  );
  const hasInput = inputText.trim().length > 0;
  let translationText = "";
  let detailText = "";

  if (hasInput) {
    if (result?.translation) {
      translationText = result.translation;
    } else if (isLoading) {
      translationText = "Translating...";
    }

    detailText = error || result?.romanization || result?.explanation || "";
  }

  useEffect(() => {
    if (!hasInput) {
      return;
    }

    if (debounceRef.current) {
      globalThis.clearTimeout(debounceRef.current);
    }

    debounceRef.current = globalThis.setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/translate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: inputText,
            source_language: sourceLanguage,
            target_language: targetLanguage,
            tone,
          }),
        });

        if (!response.ok) {
          throw new Error("Translation request failed.");
        }

        const data: TranslationResponse = await response.json();
        setResult(data);
      } catch {
        setError("Unable to reach the backend. Make sure FastAPI is running.");
      } finally {
        setIsLoading(false);
      }
    }, 450);

    return () => {
      if (debounceRef.current) {
        globalThis.clearTimeout(debounceRef.current);
      }
    };
  }, [hasInput, inputText, sourceLanguage, targetLanguage, tone]);

  function handleSwap() {
    if (sourceLanguage === "auto") {
      setSourceLanguage(targetLanguage);
      setTargetLanguage("english");
      return;
    }

    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage as TargetLanguage);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b1a] px-3 py-4 text-white sm:px-5 md:px-6 lg:px-8">
      <BackgroundGlow />

      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl items-center justify-center sm:min-h-[calc(100vh-2.5rem)]">
        <section className="w-full rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(12,19,40,0.94),rgba(9,14,31,0.92))] p-3 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.95)] backdrop-blur sm:rounded-[28px] sm:p-4 lg:rounded-[34px] lg:p-5">
          <header className="relative overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(135deg,rgba(33,49,89,0.95),rgba(21,27,57,0.98))] px-3 py-4 sm:px-4 lg:rounded-[28px] lg:px-5 lg:py-5">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-8 top-0 h-px w-28 bg-linear-to-r from-transparent via-cyan-300/70 to-transparent lg:w-32" />
              <div className="absolute bottom-4 left-1/2 h-px w-28 -translate-x-1/2 bg-linear-to-r from-transparent via-fuchsia-300/40 to-transparent lg:w-40" />
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
          </header>

          <section className="mt-4 grid gap-4 md:mt-5 md:gap-5 xl:grid-cols-2">
            <PanelShell accent="cyan" compactOnMobile>
              <textarea
                className="min-h-22 w-full resize-none bg-transparent text-[15px] leading-6 text-slate-50 outline-none placeholder:text-slate-500 sm:min-h-28 sm:text-base md:min-h-55 md:text-[18px] md:leading-8 lg:min-h-80 lg:text-[22px] lg:leading-9"
                placeholder="Enter text..."
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
              />
            </PanelShell>

            <PanelShell accent="fuchsia">
              <div className="flex h-full min-h-42 flex-col sm:min-h-47.5 md:min-h-55 lg:min-h-80">
                <div className="flex-1">
                  <p className="text-[15px] leading-6 text-white sm:text-base md:text-[18px] md:leading-8 lg:text-[22px] lg:leading-9">
                    {translationText}
                  </p>
                </div>
                <div className="mt-4 border-t border-white/8 pt-4 text-[13px] leading-6 text-cyan-100/70 sm:text-sm md:mt-5 md:pt-5 md:leading-7">
                  {detailText}
                </div>
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
      className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-white/16 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),rgba(120,119,255,0.14)_35%,rgba(14,20,42,0.96)_72%)] text-base text-cyan-200 shadow-[0_0_24px_rgba(56,189,248,0.25),0_0_48px_rgba(217,70,239,0.12)] transition duration-200 hover:scale-[1.03] hover:text-white sm:h-14 sm:w-14 sm:text-lg lg:h-16 lg:w-16 lg:text-xl"
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
      className={`relative w-full rounded-2xl border bg-[linear-gradient(180deg,rgba(9,15,31,0.96),rgba(10,18,36,0.88))] px-3 py-2.5 before:absolute before:left-2.5 before:top-1/2 before:h-4 before:w-px before:-translate-y-1/2 sm:rounded-[20px] sm:px-4 sm:py-3 sm:before:left-3 md:rounded-[21px] md:px-4 md:py-3 md:before:left-3.5 lg:rounded-[22px] lg:px-5 lg:py-4 lg:before:left-4 lg:before:h-6 ${accentStyles[accent]}`}
    >
      <select
        className="w-full appearance-none bg-transparent text-center text-[12px] font-semibold text-white outline-none sm:text-sm md:text-[15px] lg:text-base"
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

function PanelShell({
  children,
  accent,
  compactOnMobile = false,
}: Readonly<{
  children: React.ReactNode;
  accent: "cyan" | "fuchsia";
  compactOnMobile?: boolean;
}>) {
  const accentStyles = {
    cyan: "before:from-cyan-300/70 before:via-cyan-200/0 border-cyan-300/10 shadow-[0_0_0_1px_rgba(34,211,238,0.04)]",
    fuchsia:
      "before:from-fuchsia-300/70 before:via-fuchsia-200/0 border-fuchsia-300/10 shadow-[0_0_0_1px_rgba(217,70,239,0.04)]",
  } as const;

  return (
    <section
      className={`rounded-[22px] border bg-[linear-gradient(180deg,rgba(23,31,64,0.95),rgba(13,19,39,0.98))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:rounded-3xl md:rounded-[28px] md:p-4 lg:rounded-[30px] ${compactOnMobile ? "min-h-37.5 sm:min-h-43 md:min-h-75" : "min-h-55 sm:min-h-60 md:min-h-75"} ${accentStyles[accent]}`}
    >
      <div
        className={`relative h-full rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,15,32,0.95),rgba(7,13,28,0.98))] p-4 before:pointer-events-none before:absolute before:left-4 before:top-0 before:h-px before:w-20 before:bg-linear-to-r before:to-transparent sm:rounded-[20px] md:rounded-[22px] md:p-5 md:before:left-5 md:before:w-28 ${accentStyles[accent]}`}
      >
        <div className="relative h-full">{children}</div>
      </div>
    </section>
  );
}
