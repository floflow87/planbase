import { useConfigAll } from "@/hooks/useConfigAll";

type Category = { key: string; label: string };
type Props = { value: string; onChange: (v: string) => void };

export function ProjectCategorySelect({ value, onChange }: Props) {
  const { data, isLoading } = useConfigAll();
  const categories: Category[] = data?.registryMap?.project_categories ?? [];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={isLoading || categories.length === 0}
    >
      <option value="" disabled>Choisir une catégorie…</option>
      {categories.map((c) => (
        <option key={c.key} value={c.key}>{c.label}</option>
      ))}
    </select>
  );
}
