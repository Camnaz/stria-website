import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import './styles.css';
import './styles/animations.css';
import { scrollToTop } from './hooks/useScrollAnimation';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { CompanyHome } from './pages/CompanyHome';
import { PlatformDashboard } from './pages/PlatformDashboard';
import { TraceProduct } from './pages/TraceProduct';
import { ForgeProduct } from './pages/ForgeProduct';
import { ArchitectureOverview } from './pages/ArchitectureOverview';
import { TraceDocumentation } from './pages/TraceDocumentation';
import { DemoRequest } from './pages/DemoRequest';
import { LegalPage } from './pages/LegalPage';

type Surface = 'company' | 'platform' | 'trace' | 'forge' | 'architecture' | 'traceDocs' | 'demo' | 'legal' | 'privacy';

const routes: Record<Surface, string> = {
  company: '/',
  platform: '/platform',
  trace: '/trace',
  forge: '/forge',
  architecture: '/architecture',
  traceDocs: '/trace/documentation',
  demo: '/demo',
  legal: '/legal',
  privacy: '/privacy',
};

const getSurface = (): Surface => {
  const path = window.location.pathname;

  if (path === '/docs') return 'traceDocs';
  if (path === '/platform') return 'platform';
  if (path === '/architecture') return 'architecture';
  if (path === '/forge' || path.startsWith('/forge/')) return 'forge';
  if (path === '/trace/documentation' || path === '/trace/docs') return 'traceDocs';
  if (path === '/trace' || path.startsWith('/trace/')) return 'trace';
  if (path === '/demo' || path.startsWith('/demo/')) return 'demo';
  if (path === '/legal' || path.startsWith('/legal/')) return 'legal';
  if (path === '/privacy' || path.startsWith('/privacy/')) return 'privacy';

  return 'company';
};

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const surface = React.useMemo(() => getSurface(), [location.pathname]);

  React.useEffect(() => {
    if (window.location.pathname === '/trace/docs' || window.location.pathname === '/docs') {
      navigate(routes.traceDocs, { replace: true });
    }
  }, [location.pathname, navigate]);

  React.useEffect(() => {
    const metadata: Record<Surface, { title: string; description: string }> = {
      company: {
        title: 'Stria Systems | Trustworthy Infrastructure for Enterprise AI',
        description: 'Stria Systems builds Trace and Forge: enterprise AI infrastructure for LLM observability, auditability, deterministic execution, and verified automation.',
      },
      platform: {
        title: 'Stria Platform | Trace and Forge',
        description: 'Explore the shared Stria platform flow from LLM usage telemetry to workflow clustering, Forge recommendations, verified primitives, and monitored deployment.',
      },
      trace: {
        title: 'Stria Trace | AI Observability and Audit Layer',
        description: 'Observe, attribute, and audit how your organization uses LLMs with prompt, output, tool-call, cost, latency, failure, and compliance telemetry.',
      },
      forge: {
        title: 'Stria Forge | Verified Execution Primitives',
        description: 'Turn repeated AI workflows into verified, optimized execution primitives with sandboxed tests, scoring, versioning, and deployment metadata.',
      },
      architecture: {
        title: 'Architecture | Stria Systems',
        description: 'Explore the Trace data plane, control plane, and trust plane architecture for accountable AI execution.',
      },
      traceDocs: {
        title: 'Trace Developer Docs | Stria Systems',
        description: 'Run the Trace local prototype, replay agent-event fixtures, post custom actions, and inspect schema-valid AI evidence records.',
      },
      demo: {
        title: 'Request Demo | Stria Systems',
        description: 'Request a Trace demo for enterprise AI workflows that need identity, policy evaluation, evidence records, and operational intelligence.',
      },
      legal: {
        title: 'Legal | Stria Systems',
        description: 'Review Stria Systems legal notices, acceptable website use, intellectual property notices, and liability limitations.',
      },
      privacy: {
        title: 'Privacy Policy | Stria Systems',
        description: 'Review how Stria Systems handles website inquiry information, demo requests, analytics, and communications.',
      },
    };

    document.title = metadata[surface].title;
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    description.content = metadata[surface].description;
  }, [surface]);

  // Cursor position for CSS variables
  React.useEffect(() => {
    let frame = 0;
    const updateCursorField = (event: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--cursor-x', `${event.clientX}px`);
        document.documentElement.style.setProperty('--cursor-y', `${event.clientY}px`);
        frame = 0;
      });
    };

    window.addEventListener('pointermove', updateCursorField, { passive: true });
    return () => {
      window.removeEventListener('pointermove', updateCursorField);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  React.useEffect(() => {
    scrollToTop(true);
  }, [surface]);

  return (
    <div className={`site-shell surface-${surface}`} data-surface={surface}>
      <Header surface={surface} />
      {surface === 'company' && <CompanyHome />}
      {surface === 'platform' && <PlatformDashboard />}
      {surface === 'trace' && <TraceProduct />}
      {surface === 'forge' && <ForgeProduct />}
      {surface === 'architecture' && <ArchitectureOverview />}
      {surface === 'traceDocs' && <TraceDocumentation />}
      {surface === 'demo' && <DemoRequest />}
      {surface === 'legal' && <LegalPage variant="legal" />}
      {surface === 'privacy' && <LegalPage variant="privacy" />}
      <Footer />
    </div>
  );
}

if (typeof window !== 'undefined') {
  const rootElement = document.getElementById('root')!;
  const reusableRoot = rootElement as typeof rootElement & {
    __striaReactRoot?: ReturnType<typeof createRoot>;
  };

  reusableRoot.__striaReactRoot ??= createRoot(rootElement);
  reusableRoot.__striaReactRoot.render(<App />);
}
