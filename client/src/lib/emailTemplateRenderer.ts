export interface TemplateContext {
  contact?: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    email?: string;
  };
  client?: {
    name?: string;
  };
  project?: {
    name?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    budget?: string;
  };
  user?: {
    full_name?: string;
    email?: string;
    phone?: string;
    signature?: string;
  };
  today?: string;
}

export interface RenderResult {
  subject: string;
  body: string;
  missingVars: string[];
}

const VARIABLE_RE = /\{\{([a-z_.]+)\}\}/g;

function resolvePath(ctx: TemplateContext, path: string): string | undefined {
  if (path === "today") return ctx.today ?? new Date().toLocaleDateString("fr-FR");
  const [ns, key] = path.split(".") as [keyof TemplateContext, string];
  const obj = ctx[ns] as Record<string, string | undefined> | undefined;
  if (!obj) return undefined;
  return obj[key];
}

export function renderTemplate(
  subject: string,
  body: string,
  ctx: TemplateContext
): RenderResult {
  const missing: Set<string> = new Set();

  function replace(text: string): string {
    return text.replace(VARIABLE_RE, (_, path) => {
      const val = resolvePath(ctx, path);
      if (val !== undefined && val !== "") return val;
      missing.add(`{{${path}}}`);
      return `{{${path}}}`;
    });
  }

  return {
    subject: replace(subject),
    body: replace(body),
    missingVars: Array.from(missing),
  };
}

export const TEMPLATE_VARIABLES: { label: string; value: string; group: string }[] = [
  { group: "Contact", label: "Prénom", value: "{{contact.first_name}}" },
  { group: "Contact", label: "Nom", value: "{{contact.last_name}}" },
  { group: "Contact", label: "Nom complet", value: "{{contact.full_name}}" },
  { group: "Contact", label: "Email", value: "{{contact.email}}" },
  { group: "Client", label: "Nom du client", value: "{{client.name}}" },
  { group: "Projet", label: "Nom du projet", value: "{{project.name}}" },
  { group: "Projet", label: "Statut", value: "{{project.status}}" },
  { group: "Projet", label: "Date de début", value: "{{project.start_date}}" },
  { group: "Projet", label: "Date de fin", value: "{{project.end_date}}" },
  { group: "Projet", label: "Budget", value: "{{project.budget}}" },
  { group: "Moi", label: "Nom complet", value: "{{user.full_name}}" },
  { group: "Moi", label: "Email", value: "{{user.email}}" },
  { group: "Moi", label: "Téléphone", value: "{{user.phone}}" },
  { group: "Moi", label: "Signature", value: "{{user.signature}}" },
  { group: "Date", label: "Aujourd'hui", value: "{{today}}" },
];

export const TEMPLATE_CATEGORIES = [
  { value: "commercial", label: "Commercial" },
  { value: "projet", label: "Projet" },
  { value: "facturation", label: "Facturation" },
  { value: "administratif", label: "Administratif" },
  { value: "autre", label: "Autre" },
];
