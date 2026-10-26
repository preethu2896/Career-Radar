export type Company = {
  id: string;
  name: string;
  mark: string;
  accent: string;
  category: string;
  city: string;
  status: "Verified" | "Partially verified" | "Unverified" | "Unknown";
  match: number | null;
  reason: string;
  roles: number | null;
  signal: string;
  signalTone: "mint" | "amber" | "neutral";
  source: string;
  lastChecked: string;
  skills: string[];
  description: string;
  website: string;
  demoData?: boolean;
  openingSummary?: string;
  careerUrls?: string[];
};

export type SignalStatus =
  "OBSERVED" | "CONFIRMED_NEW" | "PERSISTENT" | "UNKNOWN";
export type SignalRow = {
  company: string;
  type: string;
  detail: string;
  when: string;
  tone: "mint" | "amber" | "blue";
  status: SignalStatus;
};

export const companies: Company[] = [
  {
    id: "avataar",
    name: "Avataar",
    mark: "A",
    accent: "#ef715f",
    category: "Applied AI",
    city: "Bengaluru",
    status: "Verified",
    match: 92,
    reason:
      "Your computer vision work maps to their new spatial computing team.",
    roles: 8,
    signal: "Role cluster surfaced",
    signalTone: "mint",
    source: "Official careers",
    lastChecked: "12 min ago",
    skills: ["Computer vision", "Python", "3D", "Research"],
    description:
      "A creative technology company building the next interface layer for spatial computing.",
    website: "avataar.ai",
  },
  {
    id: "atomicwork",
    name: "Atomicwork",
    mark: "A",
    accent: "#6f83f4",
    category: "Enterprise software",
    city: "Bengaluru · Remote",
    status: "Verified",
    match: 86,
    reason: "Strong overlap with your platform engineering and API experience.",
    roles: 14,
    signal: "Source checked",
    signalTone: "neutral",
    source: "Greenhouse",
    lastChecked: "34 min ago",
    skills: ["TypeScript", "APIs", "Platform", "SaaS"],
    description:
      "An AI-first service management platform helping teams resolve work faster.",
    website: "atomicwork.com",
  },
  {
    id: "sarvam",
    name: "Sarvam AI",
    mark: "S",
    accent: "#4aa79b",
    category: "Language intelligence",
    city: "Bengaluru",
    status: "Partially verified",
    match: 81,
    reason: "Your NLP projects align with their Indic language model work.",
    roles: 5,
    signal: "Career page changed",
    signalTone: "amber",
    source: "Official careers",
    lastChecked: "2 hrs ago",
    skills: ["NLP", "Python", "ML systems", "Research"],
    description: "Building full-stack intelligence for every Indian language.",
    website: "sarvam.ai",
  },
  {
    id: "fampay",
    name: "FamPay",
    mark: "F",
    accent: "#e6ad4c",
    category: "Consumer fintech",
    city: "Bengaluru",
    status: "Verified",
    match: 74,
    reason: "Your mobile product background fits an expanding consumer team.",
    roles: 11,
    signal: "Source checked",
    signalTone: "mint",
    source: "Lever",
    lastChecked: "Yesterday",
    skills: ["React Native", "Product", "Growth", "SQL"],
    description:
      "A financial platform helping the next generation learn and manage money.",
    website: "fampay.in",
  },
];

export const signalRows: SignalRow[] = [
  {
    company: "Sarvam AI",
    type: "Career page changed",
    detail: "Added 5 roles across research and platform",
    when: "2 hours ago",
    tone: "amber",
    status: "OBSERVED",
  },
  {
    company: "Avataar",
    type: "Role cluster surfaced",
    detail: "Computer vision roles appear in Bengaluru; history is incomplete",
    when: "Today",
    tone: "mint",
    status: "UNKNOWN",
  },
  {
    company: "Atomicwork",
    type: "Source checked",
    detail: "Greenhouse feed verified and refreshed",
    when: "Yesterday",
    tone: "blue",
    status: "OBSERVED",
  },
];
