import { motion } from "framer-motion";

import { useState } from "react";
import { Button } from "../ui/button";
import { Minus, Plus } from "lucide-react";
import { Input } from "../ui/input";


const jpy = (n: number) =>
    n.toLocaleString("ja-JP", { style: "currency", currency: "JPY" });


export function GridGlow() {
    return (
      <div aria-hidden className="pointer-events-none absolute -z-10 inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>
    );
  }



 export function ScanBeam() {
    return (
      <motion.div aria-hidden className="pointer-events-none absolute -z-10 top-0 left-0 right-0 h-24 bg-gradient-to-b from-sky-500/15 to-transparent" animate={{ y: [0, 600, 0] }} transition={{ repeat: Infinity, duration: 8, ease: "linear" }} />
    );
  }

  export function LogoMark() {
    return (
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500/40 to-indigo-500/30" />
        <div className="absolute inset-[2px] rounded-2xl bg-background" />
      </div>
    );
  }
  


  export function QtyControl({
    value,
    onChange,
  }: {
    value: number;
    onChange: (v: number) => void;
  }) {
    return (
      <div className="flex items-center justify-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-10"
          onClick={() => onChange(Math.max(1, value - 1))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          value={value}
          onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
          className="w-14 text-center h-10"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-10"
          onClick={() => onChange(value + 1)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }


 


  