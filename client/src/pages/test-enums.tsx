import { useState } from "react";
import { ProjectTypeSelect } from "@/components/ProjectTypeSelect";
import { ProjectCategorySelect } from "@/components/ProjectCategorySelect";

export default function TestEnumsPage() {
  const [type, setType] = useState("");
  const [cat, setCat] = useState("");

  return (
    <div style={{ padding: 24, display: "grid", gap: 12, maxWidth: 420 }}>
      <h1 style={{ fontWeight: 700, fontSize: 18 }}>Test enums</h1>

      <ProjectTypeSelect value={type} onChange={setType} />
      <ProjectCategorySelect value={cat} onChange={setCat} />

      <pre style={{ background: "#111", color: "#fff", padding: 12, borderRadius: 8 }}>
        {JSON.stringify({ type, cat }, null, 2)}
      </pre>
    </div>
  );
}
