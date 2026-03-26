export interface PageSEO {
  title: string;
  description: string;
  keywords: string;
}

export type SEOConfig = Record<string, PageSEO>;

const BASE_KEYWORDS = "Declarative Language, Declarative Language tool, Declarative language app, PDA tool, PDA language, PDA help, PDA support, PDA autism tools";

export const SEO_METADATA: SEOConfig = {
  translator: {
    title: "Declarative Language Translator | PDA Tool & Support",
    description: "Use this tool to help communicate with neurodivergent people who respond better to declarative language. Built by the neurodiverse community, for the community.",
    keywords: `${BASE_KEYWORDS}, translate imperative to declarative`,
  },
  learn: {
    title: "Learn Declarative Language | PDA Support & Education",
    description: "Understand Pathological Demand Avoidance (PDA) and how declarative language fosters connection and reduces anxiety for neurodivergent individuals.",
    keywords: `${BASE_KEYWORDS}, what is PDA, learning declarative language`,
  },
  "other-tools": {
    title: "Neurodiversity Tools | PDA Support Resources",
    description: "Explore more tools and resources designed to support PDA individuals and the neurodiverse community.",
    keywords: `${BASE_KEYWORDS}, autism tools, neurodiversity resources`,
  },
  coffee: {
    title: "Support Our Mission | PDA Autism Tools & Resources",
    description: "Support the ongoing development of declarative language tools and resources for the PDA and neurodiverse community.",
    keywords: `${BASE_KEYWORDS}, donate to autism tools`,
  },
  privacy: {
    title: "Privacy Policy | Declarative Language Tool",
    description: "Privacy policy for the Declarative Language Tool.",
    keywords: BASE_KEYWORDS,
  },
  terms: {
    title: "Terms of Service | Declarative Language Tool",
    description: "Terms of service for the Declarative Language Tool.",
    keywords: BASE_KEYWORDS,
  }
};
