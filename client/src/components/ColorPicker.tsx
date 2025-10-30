import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check } from "lucide-react";

const PASTEL_COLORS = [
  { name: "Gris clair", value: "#e5e7eb" },
  { name: "Rose", value: "#fecdd3" },
  { name: "Orange", value: "#fed7aa" },
  { name: "Jaune", value: "#fde68a" },
  { name: "Vert clair", value: "#bbf7d0" },
  { name: "Turquoise", value: "#a5f3fc" },
  { name: "Bleu clair", value: "#bfdbfe" },
  { name: "Violet", value: "#ddd6fe" },
  { name: "Lavande", value: "#e9d5ff" },
  { name: "Pêche", value: "#fecaca" },
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2"
          data-testid="button-color-picker"
        >
          <div
            className="h-4 w-4 rounded border"
            style={{ backgroundColor: value }}
          />
          <span>Couleur</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" data-testid="popover-color-picker">
        <div className="grid grid-cols-5 gap-2">
          {PASTEL_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              className="relative h-8 w-8 rounded border hover-elevate active-elevate-2"
              style={{ backgroundColor: color.value }}
              onClick={() => onChange(color.value)}
              title={color.name}
              data-testid={`button-color-${color.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {value === color.value && (
                <Check className="absolute inset-0 m-auto h-4 w-4 text-foreground" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
