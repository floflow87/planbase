import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function NoteNew() {
  const [, navigate] = useLocation();
  const isCreatingRef = useRef(false);

  useEffect(() => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;

    const today = new Date().toISOString().split("T")[0];
    apiRequest("/api/notes", "POST", {
      title: "",
      content: { type: "doc", content: [] },
      plainText: "",
      status: "draft",
      visibility: "private",
      noteDate: today,
    })
      .then((res) => res.json())
      .then((note) => {
        queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
        navigate(`/notes/${note.id}`, { replace: true });
      })
      .catch(() => {
        navigate("/notes", { replace: true });
      });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground text-sm">Création de la note...</p>
    </div>
  );
}
