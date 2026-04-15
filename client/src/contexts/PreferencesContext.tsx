import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface PreferencesContextType {
  taskReminderEnabled: boolean;
  setTaskReminderEnabled: (val: boolean) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [taskReminderEnabled, setTaskReminderState] = useState<boolean>(() => {
    const saved = localStorage.getItem("planbase-task-reminder");
    return saved === null ? true : saved === "true";
  });

  const setTaskReminderEnabled = useCallback((val: boolean) => {
    setTaskReminderState(val);
    localStorage.setItem("planbase-task-reminder", String(val));
  }, []);

  return (
    <PreferencesContext.Provider value={{ taskReminderEnabled, setTaskReminderEnabled }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used within a PreferencesProvider");
  return context;
}
