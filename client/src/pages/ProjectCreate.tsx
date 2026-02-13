import { useState } from "react";
import { ProjectTypeSelect } from "@/components/ProjectTypeSelect";

export default function ProjectCreate() {
  const [projectType, setProjectType] = useState("");

  return (
    <div>
      <h1>Nouveau projet</h1>

      <ProjectTypeSelect value={projectType} onChange={setProjectType} />
    </div>
  );
}
