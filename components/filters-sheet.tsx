"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export type LibraryFilters = {
  gender: "homme" | "femme" | "unisexe" | null;
  tags: string[];
};

const TAG_OPTIONS = [
  { value: "printemps", label: "Printemps" },
  { value: "ete", label: "Ete" },
  { value: "automne", label: "Automne" },
  { value: "hiver", label: "Hiver" },
  { value: "jour", label: "Jour" },
  { value: "nuit", label: "Nuit" },
] as const;

export const EMPTY_FILTERS: LibraryFilters = { gender: null, tags: [] };

export function countActiveFilters(filters: LibraryFilters) {
  return (filters.gender ? 1 : 0) + filters.tags.length;
}

export function FiltersSheet({
  filters,
  onChange,
}: {
  filters: LibraryFilters;
  onChange: (filters: LibraryFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  return (
    <>
      <Button
        variant="outline"
        size="icon-lg"
        className="relative rounded-full"
        onClick={() => setOpen(true)}
        aria-label="Filtres"
      >
        <SlidersHorizontal />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Filtres</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-5 px-4 pb-4">
            <div className="space-y-2">
              <Label>Genre</Label>
              <Select
                value={filters.gender ?? "tous"}
                onValueChange={(v) =>
                  onChange({ ...filters, gender: v === "tous" ? null : (v as LibraryFilters["gender"]) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  <SelectItem value="homme">Homme</SelectItem>
                  <SelectItem value="femme">Femme</SelectItem>
                  <SelectItem value="unisexe">Unisexe</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categories</Label>
              <div className="grid grid-cols-2 gap-3">
                {TAG_OPTIONS.map((tag) => (
                  <label key={tag.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={filters.tags.includes(tag.value)}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...filters,
                          tags: checked
                            ? [...filters.tags, tag.value]
                            : filters.tags.filter((t) => t !== tag.value),
                        })
                      }
                    />
                    {tag.label}
                  </label>
                ))}
              </div>
            </div>

            {activeCount > 0 && (
              <Button variant="outline" onClick={() => onChange(EMPTY_FILTERS)}>
                Reinitialiser
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
