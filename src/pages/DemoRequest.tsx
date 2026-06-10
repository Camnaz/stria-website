import { ArrowRight } from "lucide-react";
import { Band, ClosingCTA, Hero, SectionHeading } from "./components";
import { SystemBackdrop } from "../components/visual";
import { Button } from "../components/ui";
import { navigate, routes } from "../utils/navigation";
import { useState, FormEvent } from "react";
import styles from "./DemoRequest.module.css";

export function DemoRequest() {
  const [formData, setFormData] = useState({
    email: "",
    organization: "",
    workflow: "",
    priority: "Interaction observability",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log("Demo request:", formData);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main className={`${styles.page} ${styles.success}`}>
        <Hero
          className={styles.hero}
          badge={{
            label: "REQUEST SUBMITTED",
            title: "Thanks for your interest",
          }}
          title="Thanks. We'll be in touch within 24 hours."
          text="Your demo request has been queued for review. A solutions engineer will reach out to scope a controlled Trace walkthrough around your workflow."
          actions={[
            <Button key="home" variant="primary" onClick={() => navigate(routes.company)}>
              Back to home <ArrowRight size={18} />
            </Button>,
          ]}
        >
          <SystemBackdrop />
        </Hero>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Hero
        className={styles.hero}
        badge={{
          label: "REQUEST DEMO",
          title: "Controlled Trace walkthrough",
        }}
        title="Bring Stria a workflow where AI needs a better record."
        text="This demo request collects the information needed to scope a controlled Trace walkthrough around a real AI workflow. No tenant is provisioned automatically."
        bullets={[
          "One target workflow with meaningful AI usage",
          "Known policy, review, or audit pressure",
          "A technical owner and an operational owner",
        ]}
      >
        <SystemBackdrop />
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email">WORK EMAIL</label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="you@company.com"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="organization">ORGANIZATION</label>
            <input
              id="organization"
              type="text"
              value={formData.organization}
              onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
              required
              placeholder="Acme Corporation"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="workflow">WORKFLOW TO EVALUATE</label>
            <input
              id="workflow"
              type="text"
              value={formData.workflow}
              onChange={(e) => setFormData({ ...formData, workflow: e.target.value })}
              required
              placeholder="e.g., Customer support AI agent"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="priority">CURRENT PRIORITY</label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            >
              <option value="Interaction observability">Interaction observability</option>
              <option value="Evidence and audit readiness">Evidence and audit readiness</option>
              <option value="Policy review and controls">Policy review and controls</option>
            </select>
          </div>
          <Button type="submit" variant="primary" className={styles.submitButton} fullWidth>
            Prepare demo request <ArrowRight size={18} />
          </Button>
          <p className={styles.formNote}>Demo requests are prepared for review before onboarding.</p>
        </form>
      </Hero>
    </main>
  );
}