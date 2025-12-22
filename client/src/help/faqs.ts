export interface FAQItem {
  question: string;
  answer: string;
}

export interface ModuleHelp {
  id: string;
  title: string;
  summary: string;
  avatarMessage: string;
  faqs: FAQItem[];
  ctaLabel?: string;
  ctaAction?: string;
}

export const MODULE_HELP: Record<string, ModuleHelp> = {
  dashboard: {
    id: "dashboard",
    title: "Tableau de bord",
    summary: "Ton tableau de bord te donne une vue d'ensemble de ton activité : KPIs, projets en cours, temps passé et alertes importantes.",
    avatarMessage: "Je te réponds ici.",
    faqs: [
      {
        question: "Comment sont calculés les KPIs ?",
        answer: "Les KPIs sont calculés en temps réel à partir de tes projets, temps saisis et tâches. Le CA est basé sur tes projets facturés, le temps sur tes saisies et la rentabilité sur le ratio budget/temps.",
      },
      {
        question: "Puis-je personnaliser les widgets affichés ?",
        answer: "Pour l'instant, les widgets sont fixes et optimisés pour te donner les infos les plus importantes. La personnalisation arrive bientôt.",
      },
      {
        question: "Que signifient les alertes ?",
        answer: "Les alertes t'indiquent les projets en retard, les dépassements de budget ou les tâches bloquées. Clique dessus pour voir le détail.",
      },
    ],
    ctaLabel: "Voir mes projets",
    ctaAction: "/projects",
  },
  crm: {
    id: "crm",
    title: "CRM & Pipeline",
    summary: "Gère tes clients, contacts et opportunités commerciales. Suis ton pipeline de vente et transforme tes opportunités en projets.",
    avatarMessage: "Je te réponds ici.",
    faqs: [
      {
        question: "Comment ajouter un nouveau client ?",
        answer: "Clique sur le bouton '+ Client' en haut à droite. Tu peux créer une entreprise ou un contact individuel avec toutes ses coordonnées.",
      },
      {
        question: "Comment créer un projet depuis une opportunité ?",
        answer: "Quand une opportunité est gagnée, ouvre sa fiche et clique sur 'Créer un projet'. Toutes les infos seront reprises automatiquement.",
      },
      {
        question: "Puis-je personnaliser les étapes du pipeline ?",
        answer: "Oui, dans les paramètres CRM tu peux ajouter, modifier ou supprimer les étapes pour qu'elles correspondent à ton process commercial.",
      },
      {
        question: "Comment importer mes clients existants ?",
        answer: "L'import CSV est prévu pour une prochaine version. En attendant, tu peux ajouter tes clients manuellement.",
      },
    ],
    ctaLabel: "Ajouter un client",
    ctaAction: "add-client",
  },
  projects: {
    id: "projects",
    title: "Projets",
    summary: "Tes projets centralisent tout : client, budget, temps, tâches et rentabilité. C'est le cœur de Planbase.",
    avatarMessage: "Je te réponds ici.",
    faqs: [
      {
        question: "Comment créer un projet ?",
        answer: "Clique sur '+ Projet', choisis un client (optionnel), définis le budget et le périmètre. Tu pourras ensuite ajouter des tâches et saisir du temps.",
      },
      {
        question: "Comment suivre la rentabilité d'un projet ?",
        answer: "Dans la fiche projet, l'onglet 'Rentabilité' te montre le budget consommé vs restant, le temps passé et les projections.",
      },
      {
        question: "Puis-je archiver un projet terminé ?",
        answer: "Oui, dans les options du projet tu peux l'archiver. Il restera accessible dans tes archives mais ne sera plus affiché par défaut.",
      },
      {
        question: "Comment gérer les paiements d'un projet ?",
        answer: "Dans l'onglet 'Facturation' du projet, tu peux suivre les acomptes, factures et paiements reçus.",
      },
    ],
    ctaLabel: "Créer un projet",
    ctaAction: "add-project",
  },
  tasks: {
    id: "tasks",
    title: "Tâches",
    summary: "Organise ton travail avec des tâches liées à tes projets. Priorise, assigne et suis l'avancement en Kanban ou en liste.",
    avatarMessage: "Je te réponds ici.",
    faqs: [
      {
        question: "Comment créer une tâche ?",
        answer: "Clique sur '+ Tâche' ou directement dans une colonne Kanban. Associe-la à un projet pour un meilleur suivi.",
      },
      {
        question: "Comment prioriser mes tâches ?",
        answer: "Utilise le drag & drop pour réorganiser tes tâches. Les colonnes représentent les statuts : À faire, En cours, Terminé.",
      },
      {
        question: "Puis-je lier une tâche à un ticket backlog ?",
        answer: "Oui, dans la fiche tâche tu peux la relier à un ticket. Le temps saisi sur la tâche sera aussi comptabilisé sur le ticket.",
      },
    ],
    ctaLabel: "Ajouter une tâche",
    ctaAction: "add-task",
  },
  notes: {
    id: "notes",
    title: "Notes",
    summary: "Capture tes idées, réunions et décisions. Organise-les par projet pour garder le contexte.",
    avatarMessage: "Je te réponds ici.",
    faqs: [
      {
        question: "Comment créer une note ?",
        answer: "Clique sur '+ Note' et commence à écrire. Tu peux utiliser le formatage riche : titres, listes, liens, etc.",
      },
      {
        question: "Comment lier une note à un projet ?",
        answer: "Dans l'éditeur de note, utilise le sélecteur de projet pour l'associer. Elle apparaîtra aussi dans la fiche projet.",
      },
      {
        question: "Puis-je partager une note ?",
        answer: "Le partage est prévu pour une prochaine version. En attendant, tu peux exporter ta note en Markdown.",
      },
    ],
    ctaLabel: "Créer une note",
    ctaAction: "add-note",
  },
  backlog: {
    id: "backlog",
    title: "Backlog",
    summary: "Structure ton travail avec des épics, user stories et tickets. Planifie tes sprints pour livrer progressivement.",
    avatarMessage: "Je te réponds ici.",
    faqs: [
      {
        question: "Quelle est la différence entre épic, story et ticket ?",
        answer: "Un épic est un gros bloc de travail, une story décrit une fonctionnalité utilisateur, un ticket est une tâche technique. Tu peux organiser comme tu préfères.",
      },
      {
        question: "Comment planifier un sprint ?",
        answer: "Crée un sprint avec une date de début/fin, puis glisse les tickets dedans. Tu verras la charge et l'avancement.",
      },
      {
        question: "Comment estimer mes tickets ?",
        answer: "Utilise les story points ou les heures. L'estimation aide à planifier et comparer prévu vs réalisé.",
      },
      {
        question: "Puis-je lier un ticket à une tâche ?",
        answer: "Oui, un ticket peut être lié à une ou plusieurs tâches. Le temps saisi sur les tâches remonte automatiquement.",
      },
    ],
    ctaLabel: "Créer un ticket",
    ctaAction: "add-ticket",
  },
  roadmap: {
    id: "roadmap",
    title: "Roadmap",
    summary: "Visualise ta planification dans le temps. Place tes jalons, épics et dépendances sur une timeline.",
    avatarMessage: "Je te réponds ici.",
    faqs: [
      {
        question: "Comment ajouter un élément à la roadmap ?",
        answer: "Clique sur '+ Élément' ou double-clique sur la timeline. Tu peux ajouter des jalons, des épics ou des blocs libres.",
      },
      {
        question: "Comment créer une dépendance ?",
        answer: "Sélectionne un élément, puis clique sur 'Ajouter dépendance' et choisis l'élément prédécesseur.",
      },
      {
        question: "Puis-je exporter ma roadmap ?",
        answer: "L'export image/PDF est prévu pour une prochaine version.",
      },
    ],
    ctaLabel: "Voir la roadmap",
    ctaAction: "/roadmap",
  },
  finance: {
    id: "finance",
    title: "Rentabilité",
    summary: "Analyse la santé financière de tes projets. Compare budget, temps passé et marge pour prendre les bonnes décisions.",
    avatarMessage: "Je te réponds ici.",
    faqs: [
      {
        question: "Comment est calculée la rentabilité ?",
        answer: "La rentabilité = (Budget - Coût du temps passé) / Budget. Le coût du temps est basé sur ton TJM ou taux horaire.",
      },
      {
        question: "Comment définir mon TJM ?",
        answer: "Dans Paramètres > Profil, tu peux définir ton TJM par défaut. Tu peux aussi le personnaliser par projet.",
      },
      {
        question: "Que faire si un projet n'est pas rentable ?",
        answer: "Analyse le ratio temps/budget. Tu peux renégocier, optimiser ton process ou ajuster tes estimations futures.",
      },
      {
        question: "Comment suivre mes revenus mensuels ?",
        answer: "L'onglet 'Vue globale' te montre tes revenus par mois, basés sur les projets facturés.",
      },
    ],
    ctaLabel: "Voir mes projets",
    ctaAction: "/projects",
  },
  "time-tracker": {
    id: "time-tracker",
    title: "Suivi du temps",
    summary: "Enregistre ton temps passé sur chaque projet. C'est la base pour calculer ta rentabilité et tes recommandations.",
    avatarMessage: "Je te réponds ici.",
    faqs: [
      {
        question: "Comment saisir du temps ?",
        answer: "Clique sur '+ Temps' ou utilise le timer en haut. Choisis le projet, la durée et une description optionnelle.",
      },
      {
        question: "Puis-je modifier une entrée de temps ?",
        answer: "Oui, clique sur une entrée pour l'éditer. Tu peux changer la durée, le projet ou la date.",
      },
      {
        question: "Comment voir mon temps par semaine/mois ?",
        answer: "Utilise les filtres en haut pour changer la période. Tu verras le total et la répartition par projet.",
      },
    ],
    ctaLabel: "Ajouter du temps",
    ctaAction: "add-time",
  },
};

export function getModuleHelp(moduleId: string): ModuleHelp | undefined {
  return MODULE_HELP[moduleId];
}

export function getModuleIdFromPath(path: string): string | undefined {
  if (path === "/" || path === "/dashboard" || path === "/home") return "dashboard";
  if (path.startsWith("/crm")) return "crm";
  if (path.startsWith("/projects")) return "projects";
  if (path.startsWith("/tasks")) return "tasks";
  if (path.startsWith("/notes")) return "notes";
  if (path.startsWith("/product")) return "backlog";
  if (path.startsWith("/roadmap")) return "roadmap";
  if (path.startsWith("/finance")) return "finance";
  if (path.startsWith("/calendar")) return "dashboard";
  if (path.startsWith("/settings")) return "dashboard";
  if (path.startsWith("/profile")) return "dashboard";
  if (path.startsWith("/documents")) return "notes";
  if (path.startsWith("/mindmaps")) return "notes";
  if (path.startsWith("/marketing")) return "dashboard";
  if (path.startsWith("/commercial")) return "crm";
  if (path.startsWith("/legal")) return "dashboard";
  return undefined;
}
