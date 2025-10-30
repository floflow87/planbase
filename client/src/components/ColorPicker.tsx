import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check } from "lucide-react";

const PASTEL_COLORS = [
  { name: "Gris clair", value: "rgba(229, 231, 235, 0.25)" },
  { name: "Rose", value: "rgba(254, 205, 211, 0.25)" },
  { name: "Orange", value: "rgba(254, 215, 170, 0.25)" },
  { name: "Jaune", value: "rgba(253, 230, 138, 0.25)" },
  { name: "Vert clair", value: "rgba(187, 247, 208, 0.25)" },
  { name: "Turquoise", value: "rgba(165, 243, 252, 0.25)" },
  { name: "Bleu clair", value: "rgba(191, 219, 254, 0.25)" },
  { name: "Violet", value: "rgba(221, 214, 254, 0.25)" },
  { name: "Lavande", value: "rgba(233, 213, 255, 0.25)" },
  { name: "Pêche", value: "rgba(254, 202, 202, 0.25)" },
  { name: "Menthe", value: "rgba(167, 243, 208, 0.25)" },
  { name: "Ciel", value: "rgba(186, 230, 253, 0.25)" },
  { name: "Mauve", value: "rgba(196, 181, 253, 0.25)" },
  { name: "Corail", value: "rgba(252, 211, 77, 0.25)" },
  { name: "Saumon", value: "rgba(251, 207, 232, 0.25)" },
  { name: "Citron", value: "rgba(254, 249, 195, 0.25)" },
  { name: "Aqua", value: "rgba(207, 250, 254, 0.25)" },
  { name: "Lilas", value: "rgba(233, 213, 255, 0.25)" },
  { name: "Pêche clair", value: "rgba(254, 215, 170, 0.25)" },
  { name: "Vert d'eau", value: "rgba(153, 246, 228, 0.25)" },
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
