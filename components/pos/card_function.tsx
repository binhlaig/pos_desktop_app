
import { Trash2 } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { QtyControl } from "./effect";




const jpy = (n: number) =>
    n.toLocaleString("ja-JP", { style: "currency", currency: "JPY" });

 export function CartTable({
    lines,
    page,
    setPage,
    pageCount,
    updateQty,
    updateDisc,
    removeLine,
    canEditDiscount,
  }: {
    lines: {
      id: string;
      name: string;
      qty: number;
      price: number;
      discount: number;
      taxable: boolean;
    }[];
    page: number;
    setPage: React.Dispatch<React.SetStateAction<number>>;
    pageCount: number;
    updateQty: (id: string, qty: number) => void;
    updateDisc: (id: string, discount: number) => void;
    removeLine: (id: string) => void;
    canEditDiscount: boolean;
  }) {

    return (
      <div className="mt-4 rounded-xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm bg-white/5">
          <div className="text-xs text-slate-400">Page</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Prev
            </Button>
            <span className="tabular-nums">
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
            >
              Next
            </Button>
          </div>
        </div>
  
        <div className="max-h/[52vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background/90 backdrop-blur">
              <TableRow>
                <TableHead className="w-[44%]">Item</TableHead>
                <TableHead className="w-[12%] text-right">Price</TableHead>
                <TableHead className="w-[18%] text-center">Qty</TableHead>
                <TableHead className="w-[16%]">Discount</TableHead>
                <TableHead className="w-[10%] text-right">Line</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, idx) => (
                <TableRow
                  key={l.id}
                  className={`group ${
                    idx % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent"
                  } hover:bg-white/10 transition-colors`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={l.taxable ? "default" : "secondary"}
                        className="rounded-full shrink-0"
                      >
                        {l.taxable ? "Tax" : "NoTax"}
                      </Badge>
                      <div className="min-w-0">
                        <div
                          className="font-medium leading-tight truncate"
                          title={l.name}
                        >
                          {l.name}
                        </div>
                        <div className="text-xs text-slate-400">SKU: {l.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums align-middle">
                    {jpy(l.price)}
                  </TableCell>
                  <TableCell className="align-middle">
                    <QtyControl
                      value={l.qty}
                      onChange={(q) => updateQty(l.id, q)}
                    />
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="flex items-center gap-2">
                      <Slider
                        min={0}
                        max={100}
                        step={5}
                        value={[Math.round(l.discount * 100)]}
                        onValueChange={([v]) =>
                          canEditDiscount && updateDisc(l.id, v / 100)
                        }
                        className="w-28"
                        disabled={!canEditDiscount}
                      />
                      <span
                        className={`w-12 text-right tabular-nums font-medium ${
                          l.discount > 0 ? "text-emerald-400" : "text-slate-300"
                        }`}
                      >
                        {Math.round(l.discount * 100)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold align-middle">
                    {jpy(Math.round(l.qty * l.price * (1 - l.discount)))}
                  </TableCell>
                  <TableCell className="text-right align-middle">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeLine(l.id)}
                      className="opacity-70 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }
  