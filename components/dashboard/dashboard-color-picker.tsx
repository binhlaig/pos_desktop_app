// "use client";

// import { useEffect, useState } from "react";
// import { Palette } from "lucide-react";

// type BrandColors = {
//   name: string;
//   primary: string;
//   accent: string;
// };

// const STORAGE_KEY = "binhlaig_dashboard_brand_colors";

// const BRAND_PRESETS: BrandColors[] = [
//   { name: "Binhlaig", primary: "#0B1F3A", accent: "#D4A017" },
//   { name: "Ocean", primary: "#075985", accent: "#38BDF8" },
//   { name: "Emerald", primary: "#064E3B", accent: "#34D399" },
//   { name: "Violet", primary: "#4C1D95", accent: "#A78BFA" },
// ];

// const DEFAULT_COLORS = BRAND_PRESETS[0];

// function isHexColor(value: unknown): value is string {
//   return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
// }

// function getStoredColors(): BrandColors {
//   try {
//     const stored = JSON.parse(
//       localStorage.getItem(STORAGE_KEY) || "null",
//     ) as Partial<BrandColors> | null;

//     if (stored && isHexColor(stored.primary) && isHexColor(stored.accent)) {
//       return {
//         name: stored.name || "Custom",
//         primary: stored.primary.toUpperCase(),
//         accent: stored.accent.toUpperCase(),
//       };
//     }
//   } catch {
//     // Invalid saved data falls back to the main Binhlaig palette.
//   }

//   return DEFAULT_COLORS;
// }

// function setColorVariable(name: string, value: string) {
//   document.documentElement.style.setProperty(name, value);
// }

// function applyProjectColors(colors: BrandColors) {
//   const root = document.documentElement;
//   const primary = colors.primary;
//   const accent = colors.accent;

//   root.setAttribute("data-dashboard-color", colors.name.toLowerCase());

//   setColorVariable("--dashboard-primary", primary);
//   setColorVariable("--dashboard-accent", accent);
//   setColorVariable("--brand-primary", primary);
//   setColorVariable("--brand-accent", accent);
//   setColorVariable("--primary", primary);
//   setColorVariable("--ring", primary);
//   setColorVariable("--sidebar-primary", primary);
//   setColorVariable("--sidebar-ring", primary);
//   setColorVariable("--chart-1", primary);
//   setColorVariable("--chart-2", accent);

//   // Remap legacy blue-* utilities so existing dashboard pages also follow
//   // the selected project brand without rewriting every component at once.
//   setColorVariable("--color-blue-50", `color-mix(in srgb, ${primary} 6%, white)`);
//   setColorVariable("--color-blue-100", `color-mix(in srgb, ${primary} 12%, white)`);
//   setColorVariable("--color-blue-200", `color-mix(in srgb, ${primary} 22%, white)`);
//   setColorVariable("--color-blue-300", `color-mix(in srgb, ${primary} 38%, white)`);
//   setColorVariable("--color-blue-400", accent);
//   setColorVariable("--color-blue-500", `color-mix(in srgb, ${primary} 82%, ${accent})`);
//   setColorVariable("--color-blue-600", primary);
//   setColorVariable("--color-blue-700", `color-mix(in srgb, ${primary} 86%, black)`);
//   setColorVariable("--color-blue-800", `color-mix(in srgb, ${primary} 74%, black)`);
//   setColorVariable("--color-blue-900", `color-mix(in srgb, ${primary} 62%, black)`);
//   setColorVariable("--color-blue-950", `color-mix(in srgb, ${primary} 48%, black)`);
// }

// export function DashboardColorPicker() {
//   const [colors, setColors] = useState<BrandColors>(DEFAULT_COLORS);
//   const [open, setOpen] = useState(false);

//   /* eslint-disable react-hooks/set-state-in-effect */
//   useEffect(() => {
//     const storedColors = getStoredColors();
//     setColors(storedColors);
//     applyProjectColors(storedColors);
//   }, []);
//   /* eslint-enable react-hooks/set-state-in-effect */

//   const updateColors = (nextColors: BrandColors) => {
//     setColors(nextColors);
//     localStorage.setItem(STORAGE_KEY, JSON.stringify(nextColors));
//     applyProjectColors(nextColors);
//     window.dispatchEvent(
//       new CustomEvent("dashboard-color-change", { detail: nextColors }),
//     );
//   };

//   return (
//     <div className="relative">
//       <button
//         type="button"
//         aria-label="Project brand color ရွေးရန်"
//         title={`Project color: ${colors.name}`}
//         aria-haspopup="dialog"
//         aria-expanded={open}
//         onClick={() => setOpen((current) => !current)}
//         className="flex h-9 items-center gap-2 rounded-xl px-2 transition hover:bg-muted active:scale-95"
//       >
//         <Palette className="size-4 text-muted-foreground" />
//         <span className="flex -space-x-1">
//           <span
//             className="size-4 rounded-full border-2 border-background shadow-sm"
//             style={{ backgroundColor: colors.primary }}
//           />
//           <span
//             className="size-4 rounded-full border-2 border-background shadow-sm"
//             style={{ backgroundColor: colors.accent }}
//           />
//         </span>
//       </button>

//       {open && (
//         <>
//           <button
//             type="button"
//             aria-label="Close color picker"
//             onClick={() => setOpen(false)}
//             className="fixed inset-0 z-[70] cursor-default"
//           />

//           <div
//             role="dialog"
//             aria-label="Project brand color"
//             className="absolute right-0 top-[calc(100%+12px)] z-[80] w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-xl"
//           >
//             <div className="mb-3">
//               <p className="text-sm font-semibold">Brand color</p>
//               <p className="mt-0.5 text-[11px] text-muted-foreground">
//                 Project တစ်ခုလုံးအတွက် main နှင့် accent color ရွေးပါ။
//               </p>
//             </div>

//             <div className="grid grid-cols-2 gap-2">
//               {BRAND_PRESETS.map((preset) => {
//                 const selected =
//                   preset.primary === colors.primary &&
//                   preset.accent === colors.accent;

//                 return (
//                   <button
//                     key={preset.name}
//                     type="button"
//                     onClick={() => updateColors(preset)}
//                     className={`flex items-center gap-2 rounded-xl border p-2 text-left transition hover:bg-muted/60 ${
//                       selected
//                         ? "border-[var(--dashboard-accent)] bg-muted/50"
//                         : "border-border"
//                     }`}
//                   >
//                     <span className="flex -space-x-1">
//                       <span
//                         className="size-6 rounded-full border-2 border-popover"
//                         style={{ backgroundColor: preset.primary }}
//                       />
//                       <span
//                         className="size-6 rounded-full border-2 border-popover"
//                         style={{ backgroundColor: preset.accent }}
//                       />
//                     </span>
//                     <span className="min-w-0 truncate text-xs font-medium">
//                       {preset.name}
//                     </span>
//                   </button>
//                 );
//               })}
//             </div>

//             <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
//               {([["Main", "primary"], ["Accent", "accent"]] as const).map(
//                 ([label, key]) => (
//                   <label key={key} className="text-xs font-medium">
//                     <span className="mb-1.5 block text-muted-foreground">
//                       {label}
//                     </span>
//                     <span className="flex h-10 items-center gap-2 rounded-lg border border-border px-2">
//                       <input
//                         type="color"
//                         value={colors[key]}
//                         onChange={(event) =>
//                           updateColors({
//                             ...colors,
//                             name: "Custom",
//                             [key]: event.target.value.toUpperCase(),
//                           })
//                         }
//                         className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
//                         aria-label={`${label} color`}
//                       />
//                       <span className="font-mono text-[10px] uppercase">
//                         {colors[key]}
//                       </span>
//                     </span>
//                   </label>
//                 ),
//               )}
//             </div>

//             <button
//               type="button"
//               onClick={() => updateColors(DEFAULT_COLORS)}
//               className="mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
//             >
//               Binhlaig main brand သို့ ပြန်ထားရန်
//             </button>
//           </div>
//         </>
//       )}
//     </div>
//   );
// }



"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Palette, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  BRAND_PRESETS,
  DEFAULT_BRAND_COLORS,
  getStoredBrandColors,
  saveBrandColors,
  type BrandColors,
} from "@/lib/brand-colors";

export function BrandColorPicker() {
  const pickerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);

  const [colors, setColors] = useState<BrandColors>(
    DEFAULT_BRAND_COLORS,
  );

  useEffect(() => {
    setColors(getStoredBrandColors());
  }, []);

  useEffect(() => {
    function closeWhenClickedOutside(
      event: MouseEvent,
    ) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener(
        "mousedown",
        closeWhenClickedOutside,
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        closeWhenClickedOutside,
      );
    };
  }, [open]);

  function updateColors(nextColors: BrandColors) {
    setColors(nextColors);
    saveBrandColors(nextColors);
  }

  function selectPreset(preset: BrandColors) {
    updateColors(preset);
  }

  function updateCustomColor(
    key: "primary" | "accent",
    value: string,
  ) {
    updateColors({
      ...colors,
      name: "Custom",
      [key]: value.toUpperCase(),
    });
  }

  function resetColors() {
    updateColors(DEFAULT_BRAND_COLORS);
  }

  return (
    <div ref={pickerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="
          h-10 gap-2 rounded-xl
          border-brand-border
          bg-background
          hover:bg-brand-soft
        "
        aria-label="Brand color ရွေးရန်"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() =>
          setOpen((current) => !current)
        }
      >
        <Palette className="size-4" />

        <span>အရောင်</span>

        <span className="flex -space-x-1">
          <span
            className="
              size-4 rounded-full
              border-2 border-background
            "
            style={{
              backgroundColor: colors.primary,
            }}
          />

          <span
            className="
              size-4 rounded-full
              border-2 border-background
            "
            style={{
              backgroundColor: colors.accent,
            }}
          />
        </span>
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Brand color ရွေးရန်"
          className="
            absolute right-0 top-12 z-50
            w-[min(20rem,calc(100vw-2rem))]
            rounded-2xl border border-border
            bg-card p-4 text-card-foreground
            shadow-2xl
          "
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="
                    grid size-8 place-items-center
                    rounded-lg bg-brand-soft
                    text-brand-primary
                  "
                >
                  <Palette className="size-4" />
                </span>

                <p className="text-sm font-semibold">
                  Brand color
                </p>
              </div>

              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Dashboard အတွက် main နှင့် accent
                အရောင်ရွေးပါ။
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="size-8 rounded-lg"
              aria-label="Close color picker"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Preset colors */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {BRAND_PRESETS.map((preset) => {
              const selected =
                preset.primary === colors.primary &&
                preset.accent === colors.accent;

              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() =>
                    selectPreset(preset)
                  }
                  className={`
                    relative flex min-w-0 items-center
                    gap-2 rounded-xl border p-2.5
                    text-left transition
                    hover:bg-muted
                    ${
                      selected
                        ? "border-brand-primary bg-brand-soft"
                        : "border-border"
                    }
                  `}
                >
                  <span className="flex shrink-0 -space-x-1">
                    <span
                      className="
                        size-7 rounded-full
                        border-2 border-card
                      "
                      style={{
                        backgroundColor:
                          preset.primary,
                      }}
                    />

                    <span
                      className="
                        size-7 rounded-full
                        border-2 border-card
                      "
                      style={{
                        backgroundColor:
                          preset.accent,
                      }}
                    />
                  </span>

                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {preset.name}
                  </span>

                  {selected && (
                    <span
                      className="
                        grid size-5 shrink-0
                        place-items-center rounded-full
                        bg-brand-primary text-white
                      "
                    >
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom colors */}
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-3 text-xs font-semibold">
              Custom colors
            </p>

            <div className="grid grid-cols-2 gap-3">
              <ColorInput
                label="Main"
                value={colors.primary}
                onChange={(value) =>
                  updateCustomColor(
                    "primary",
                    value,
                  )
                }
              />

              <ColorInput
                label="Accent"
                value={colors.accent}
                onChange={(value) =>
                  updateCustomColor(
                    "accent",
                    value,
                  )
                }
              />
            </div>
          </div>

          <div
            className="
              mt-4 flex items-center gap-3
              rounded-xl border border-brand-border
              bg-brand-soft p-3
            "
          >
            <span
              className="size-9 rounded-lg"
              style={{
                backgroundColor: colors.primary,
              }}
            />

            <span
              className="size-9 rounded-lg"
              style={{
                backgroundColor: colors.accent,
              }}
            />

            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">
                {colors.name}
              </p>

              <p className="truncate text-[10px] text-muted-foreground">
                {colors.primary} · {colors.accent}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={resetColors}
            className="
              mt-3 w-full justify-center gap-2
              rounded-xl text-xs
              text-muted-foreground
            "
          >
            <RotateCcw className="size-3.5" />
            Binhlaig main brand သို့ ပြန်ထားရန်
          </Button>
        </div>
      )}
    </div>
  );
}

type ColorInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function ColorInput({
  label,
  value,
  onChange,
}: ColorInputProps) {
  return (
    <label className="text-xs font-medium">
      <span className="mb-1.5 block text-muted-foreground">
        {label}
      </span>

      <span
        className="
          flex h-11 items-center gap-2
          rounded-xl border border-border
          bg-background px-2
        "
      >
        <input
          type="color"
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="
            size-7 cursor-pointer rounded-md
            border-0 bg-transparent p-0
          "
          aria-label={`${label} color`}
        />

        <span className="min-w-0 truncate font-mono text-[10px] uppercase">
          {value}
        </span>
      </span>
    </label>
  );
}