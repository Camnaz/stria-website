import { ArrowRight } from "lucide-react";
import { Button } from "../components/ui";
import { routes } from "../utils/navigation";
import { useNavigate } from "react-router-dom";
import styles from "./LegalPage.module.css";

interface LegalPageProps {
  variant: "legal" | "privacy";
}

const content = {
  legal: {
    label: "Legal notice",
    title: "Clear terms for using Stria Systems materials.",
    intro:
      "This page provides general website terms and notices for Stria Systems. Customer contracts, data-processing terms, and security commitments are governed by written agreements with Stria Systems.",
    sections: [
      {
        title: "Website use",
        text: "The information on this website is provided for evaluation and informational purposes. Do not misuse the site, attempt unauthorized access, or interfere with service availability.",
      },
      {
        title: "Intellectual property",
        text: "Stria Systems names, product descriptions, interface patterns, logos, diagrams, and written materials are owned by Stria Systems or its licensors unless otherwise stated.",
      },
      {
        title: "No professional advice",
        text: "Website content is not legal, compliance, security, or financial advice. Teams should evaluate controls with qualified internal or external advisors.",
      },
      {
        title: "Limitation",
        text: "The website is provided as-is. Production use of Stria products is subject to mutually executed agreements and applicable order terms.",
      },
    ],
  },
  privacy: {
    label: "Privacy policy",
    title: "How Stria Systems handles website inquiry data.",
    intro:
      "Stria Systems collects limited information needed to respond to demo requests, improve the website, and communicate with prospective customers.",
    sections: [
      {
        title: "Information you provide",
        text: "Demo forms and direct communications may include your name, business email, company, role, and notes about AI governance or infrastructure needs.",
      },
      {
        title: "Website data",
        text: "We may use basic analytics and technical logs to understand page performance, device characteristics, referral source, and aggregate usage patterns.",
      },
      {
        title: "How information is used",
        text: "We use information to respond to inquiries, schedule demos, improve website reliability, and maintain appropriate security records.",
      },
      {
        title: "Contact",
        text: "To request privacy-related updates or deletion for website inquiry data, contact Stria Systems through the demo request channel.",
      },
    ],
  },
} satisfies Record<LegalPageProps["variant"], {
  label: string;
  title: string;
  intro: string;
  sections: Array<{ title: string; text: string }>;
}>;

export function LegalPage({ variant }: LegalPageProps) {
  const navigate = useNavigate();
  const page = content[variant];

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.label}>{page.label}</p>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
        <Button variant="secondary" onClick={() => navigate(routes.demo)}>
          Talk with Stria <ArrowRight size={18} />
        </Button>
      </section>

      <section className={styles.grid} aria-label={`${page.label} sections`}>
        {page.sections.map((section) => (
          <article key={section.title} className={styles.card}>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
