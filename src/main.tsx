import React, { Suspense, lazy } from "react";
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

function App() {
  return (
    <BrowserRouter>
      <div className="site-shell">
        <Header />
        <main id="main-content">
          <Suspense fallback={<div className="page-loading" aria-hidden="true">Loading…</div>}>
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
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(<App />);