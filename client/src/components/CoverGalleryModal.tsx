import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link, Upload, X } from "lucide-react";
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

interface CoverGalleryPanelProps {
  onClose: () => void;
  onSelectColor: (value: string) => void;
  onSelectGradient: (value: string) => void;
  onSelectImage: (url: string) => void;
  onUploadFile: (file: File) => void;
  onRemove: () => void;
  hasCover: boolean;
  uploading?: boolean;
}

function LazyImage({ src, onClick }: { src: string; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <button
      ref={ref}
      className="rounded-md h-14 w-full overflow-hidden relative transition-transform hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary/50 bg-muted"
      onClick={onClick}
    >
      {!loaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      {inView && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(
            "w-full h-full object-cover transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setLoaded(true)}
          draggable={false}
        />
      )}
    </button>
  );
}

export function CoverGalleryPanel({
  onClose,
  onSelectColor,
  onSelectGradient,
  onSelectImage,
  onUploadFile,
  onRemove,
  hasCover,
  uploading = false,
}: CoverGalleryPanelProps) {
  const [tab, setTab] = useState<Tab>("galerie");
  const [linkValue, setLinkValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { onUploadFile(file); onClose(); }
    e.target.value = "";
  };

  const handleApplyLink = () => {
    const url = linkValue.trim();
    if (!url) return;
    onSelectImage(url);
    onClose();
  };

  return (
    <div
      ref={panelRef}
      className="bg-popover border border-border rounded-lg shadow-xl overflow-hidden flex flex-col"
      style={{ width: 460, maxWidth: "92vw" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Tab bar */}
      <div className="flex items-center border-b px-2 pt-1 gap-1 shrink-0">
        {(["galerie", "charger", "lien"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium capitalize border-b-2 transition-colors",
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
            className="text-xs text-muted-foreground h-7"
            onClick={() => { onRemove(); onClose(); }}
          >
            Retirer
          </Button>
        )}
        <Button size="icon" variant="ghost" className="shrink-0" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Galerie tab */}
      {tab === "galerie" && (
        <div className="overflow-y-auto p-3 space-y-4" style={{ maxHeight: 360 }}>
          {/* Colors */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Couleurs</p>
            <div className="grid grid-cols-6 gap-1.5">
              {COLORS.map((color) => (
                <button
                  key={color}
                  className="rounded h-8 w-full transition-transform hover:scale-[1.05] active:scale-[0.95] focus:outline-none focus:ring-2 focus:ring-primary/50"
                  style={{ backgroundColor: color }}
                  onClick={() => { onSelectColor(`color:${color}`); onClose(); }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Gradients */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Dégradés</p>
            <div className="grid grid-cols-3 gap-1.5">
              {GRADIENTS.map((grad, i) => (
                <button
                  key={i}
                  className="rounded h-10 w-full transition-transform hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary/50"
                  style={{ background: grad }}
                  onClick={() => { onSelectGradient(`gradient:${grad}`); onClose(); }}
                />
              ))}
            </div>
          </div>

          {/* Tech images */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tech</p>
            <div className="grid grid-cols-4 gap-1.5">
              {TECH_IMAGES.map((src) => (
                <LazyImage
                  key={src}
                  src={src}
                  onClick={() => { onSelectImage(src); onClose(); }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Charger tab */}
      {tab === "charger" && (
        <div className="p-5 flex flex-col items-center justify-center gap-3 min-h-[180px]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Upload className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Sélectionnez une image depuis votre ordinateur
              </p>
              <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                Choisir un fichier
              </Button>
              <p className="text-[10px] text-muted-foreground">JPG, PNG, GIF, WEBP — max 10 Mo</p>
            </>
          )}
        </div>
      )}

      {/* Lien tab */}
      {tab === "lien" && (
        <div className="p-4 flex flex-col gap-3 min-h-[180px]">
          <p className="text-xs text-muted-foreground">Collez un lien vers une image</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                placeholder="https://exemple.com/image.jpg"
                className="pl-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleApplyLink()}
                autoFocus
              />
            </div>
            <Button size="sm" onClick={handleApplyLink} disabled={!linkValue.trim()}>
              Appliquer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Keep backward compat alias
export { CoverGalleryPanel as CoverGalleryModal };
