import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899",
  "#F43F5E", "#14B8A6", "#6366F1", "#A855F7",
];

const GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
];

const TECH_IMAGES = [
  "/covers/tech/Tech01.jpg",
  "/covers/tech/Tech02.jpg",
  "/covers/tech/Tech03.jpg",
  "/covers/tech/Tech04.jpg",
  "/covers/tech/Tech05.jpg",
  "/covers/tech/Tech06.jpg",
  "/covers/tech/Tech07.jpg",
  "/covers/tech/Tech08.jpg",
  "/covers/tech/Tech09.jpg",
  "/covers/tech/Tech10.jpg",
  "/covers/tech/Tech11.jpg",
  "/covers/tech/Tech12.jpg",
  "/covers/tech/Tech13.jpg",
  "/covers/tech/Tech14.jpg",
];

type Tab = "galerie" | "charger" | "lien";

interface CoverGalleryModalProps {
  open: boolean;
  onClose: () => void;
  onSelectColor: (value: string) => void;
  onSelectGradient: (value: string) => void;
  onSelectImage: (url: string) => void;
  onUploadFile: (file: File) => void;
  onRemove: () => void;
  hasCover: boolean;
  uploading?: boolean;
}

export function CoverGalleryModal({
  open,
  onClose,
  onSelectColor,
  onSelectGradient,
  onSelectImage,
  onUploadFile,
  onRemove,
  hasCover,
  uploading = false,
}: CoverGalleryModalProps) {
  const [tab, setTab] = useState<Tab>("galerie");
  const [linkValue, setLinkValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
      onClose();
    }
    e.target.value = "";
  };

  const handleApplyLink = () => {
    const url = linkValue.trim();
    if (!url) return;
    onSelectImage(url);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden"
        style={{ width: 520, maxWidth: "96vw", maxHeight: "80vh" }}
      >
        <DialogTitle className="sr-only">Image de couverture</DialogTitle>

        {/* Tab bar + Retirer */}
        <div className="flex items-center border-b px-2 pt-1 gap-1">
          {(["galerie", "charger", "lien"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-2 text-sm font-medium capitalize border-b-2 transition-colors",
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "galerie" ? "Galerie" : t === "charger" ? "Charger" : "Lien"}
            </button>
          ))}
          <div className="flex-1" />
          {hasCover && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground mb-0.5"
              onClick={() => { onRemove(); onClose(); }}
            >
              Retirer
            </Button>
          )}
        </div>

        {/* Galerie tab */}
        {tab === "galerie" && (
          <div className="overflow-y-auto p-4 space-y-5" style={{ maxHeight: "calc(80vh - 48px)" }}>
            {/* Colors */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Couleurs</p>
              <div className="grid grid-cols-4 gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    className="rounded-md h-16 w-full transition-transform hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary/50"
                    style={{ backgroundColor: color }}
                    onClick={() => { onSelectColor(`color:${color}`); onClose(); }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Gradients */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Dégradés</p>
              <div className="grid grid-cols-3 gap-2">
                {GRADIENTS.map((grad, i) => (
                  <button
                    key={i}
                    className="rounded-md h-20 w-full transition-transform hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary/50"
                    style={{ background: grad }}
                    onClick={() => { onSelectGradient(`gradient:${grad}`); onClose(); }}
                  />
                ))}
              </div>
            </div>

            {/* Tech images */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tech</p>
              <div className="grid grid-cols-3 gap-2">
                {TECH_IMAGES.map((src) => (
                  <button
                    key={src}
                    className="rounded-md h-24 w-full overflow-hidden transition-transform hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary/50"
                    onClick={() => { onSelectImage(src); onClose(); }}
                  >
                    <img
                      src={src}
                      alt=""
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Charger tab */}
        {tab === "charger" && (
          <div className="p-6 flex flex-col items-center justify-center gap-4 min-h-[220px]">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Sélectionnez une image depuis votre ordinateur
                </p>
                <Button onClick={() => fileInputRef.current?.click()}>
                  Choisir un fichier
                </Button>
                <p className="text-xs text-muted-foreground">JPG, PNG, GIF, WEBP — max 10 Mo</p>
              </>
            )}
          </div>
        )}

        {/* Lien tab */}
        {tab === "lien" && (
          <div className="p-6 flex flex-col gap-4 min-h-[220px]">
            <p className="text-sm text-muted-foreground">Collez un lien vers une image</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  placeholder="https://exemple.com/image.jpg"
                  className="pl-9"
                  onKeyDown={(e) => e.key === "Enter" && handleApplyLink()}
                />
              </div>
              <Button onClick={handleApplyLink} disabled={!linkValue.trim()}>
                Appliquer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
