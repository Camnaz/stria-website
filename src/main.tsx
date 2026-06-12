import React, { Suspense, lazy, Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles.css";

// Lazy-loaded page components - each becomes a separate chunk
const CompanyHome = lazy(() => import("./pages/CompanyHome").then((m) => ({ default: m.CompanyHome })));
const PlatformDashboard = lazy(() => import("./pages/PlatformDashboard").then((m) => ({ default: m.PlatformDashboard })));
const TraceProduct = lazy(() => import("./pages/TraceProduct").then((m) => ({ default: m.TraceProduct })));
const ForgeProduct = lazy(() => import("./pages/ForgeProduct").then((m) => ({ default: m.ForgeProduct })));
const ArchitectureOverview = lazy(() => import("./pages/ArchitectureOverview").then((m) => ({ default: m.ArchitectureOverview })));
const TraceDocumentation = lazy(() => import("./pages/TraceDocumentation").then((m) => ({ default: m.TraceDocumentation })));
const DemoRequest = lazy(() => import("./pages/DemoRequest").then((m) => ({ default: m.DemoRequest })));

// Layout components (shared across pages, loaded upfront)
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        this.props.fallback || (
          <div style={{ padding: 20, color: "red", background: "#fff", whiteSpace: "pre-wrap" }}>
            <h2>Something went wrong:</h2>
            <pre>{this.state.error?.message}</pre>
            <pre>{this.state.errorInfo?.componentStack}</pre>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <div className="site-shell">
          <Header />
          <main id="main-content">
            <Suspense fallback={<div className="page-loading" aria-hidden="true">Loading</div>}>
              <Routes>
                <Route path="/" element={<CompanyHome />} />
                <Route path="/platform" element={<PlatformDashboard />} />
                <Route path="/trace" element={<TraceProduct />} />
                <Route path="/forge" element={<ForgeProduct />} />
                <Route path="/architecture" element={<ArchitectureOverview />} />
                <Route path="/trace/documentation" element={<TraceDocumentation />} />
                <Route path="/demo" element={<DemoRequest />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
