import { useConfigAll } from "@/hooks/useConfigAll";

type Props = { value: string; onChange: (v: string) => void };

export function ProjectTypeSelect({ value, onChange }: Props) {
  const { data, isLoading } = useConfigAll();
  const options: string[] = data?.registryMap?.project_types ?? [];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={isLoading || options.length === 0}
    >
      <option value="" disabled>Choisir un type…</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}


