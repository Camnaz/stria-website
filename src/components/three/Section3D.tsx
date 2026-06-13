import React from 'react';
import { useScrollProgress, easings } from './hooks/useScrollProgress';

interface Hero3DProps {
  badge: { label: string; title: string };
  title: string;
  text: string;
  bullets: string[];
  actions: React.ReactNode[];
}

export function Hero3D({ badge, title, text, bullets, actions }: Hero3DProps) {
  const scrollProgress = useScrollProgress(0, 0.3, { clamp: true, ease: easings.easeOutCubic });
  const titleProgress = useScrollProgress(0, 0.2, { clamp: true, ease: easings.easeOutExpo });
  const textProgress = useScrollProgress(0.05, 0.25, { clamp: true, ease: easings.easeOutCubic });
  const bulletsProgress = useScrollProgress(0.1, 0.3, { clamp: true, ease: easings.easeOutCubic });
  const actionsProgress = useScrollProgress(0.15, 0.35, { clamp: true, ease: easings.easeOutCubic });

  return (
    <section className="hero-3d" style={{ '--scroll-progress': scrollProgress }}>
      <div className="hero-content-3d">
        {/* Badge */}
        <div
          className="surface-badge-3d"
          style={{
            opacity: titleProgress,
            transform: `translateY(${(1 - titleProgress) * 30}px)`,
          }}
        >
          <span className="badge-label-3d">{badge.label}</span>
          <strong className="badge-title-3d">{badge.title}</strong>
        </div>

        {/* Main Title */}
        <h1
          className="hero-title-3d"
          style={{
            opacity: titleProgress,
            transform: `translateY(${(1 - titleProgress) * 40}px)`,
          }}
        >
          {title}
        </h1>

        {/* Description */}
        <p
          className="hero-text-3d"
          style={{
            opacity: textProgress,
            transform: `translateY(${(1 - textProgress) * 30}px)`,
          }}
        >
          {text}
        </p>

        {/* Bullets */}
        <ul className="hero-bullets-3d" aria-label="Stria capabilities" style={{ opacity: bulletsProgress }}>
          {bullets.map((bullet, i) => (
            <li key={bullet} className="hero-bullet-3d" style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="hero-bullet-icon-3d" aria-hidden="true">▸</span>
              {bullet}
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="hero-actions-3d" style={{ opacity: actionsProgress, transform: `translateY(${(1 - actionsProgress) * 20}px)` }}>
          {actions}
        </div>
      </div>

      {/* 3D Scene indicator */}
      <div className="hero-scene-indicator-3d" aria-hidden="true">
        <div className="scene-badge-3d">
          <span className="scene-badge-icon-3d">◆</span>
          <span className="scene-badge-text-3d">THREE.JS SCENE ACTIVE</span>
        </div>
      </div>
    </section>
  );
}

interface Section3DProps {
  eyebrow: string;
  title: string;
  text?: string;
  children: React.ReactNode;
}

export function Section3D({ eyebrow, title, text, children }: Section3DProps) {
  return (
    <div className="section-3d">
      <div className="section-heading-3d">
        <p className="eyebrow-3d">{eyebrow}</p>
        <h2 className="section-title-3d">{title}</h2>
        {text && <p className="section-text-3d">{text}</p>}
      </div>
      <div className="section-content-3d">{children}</div>
    </div>
  );
}

interface Band3DProps {
  variant?: 'default' | 'callout' | 'compact' | 'cta';
  children: React.ReactNode;
}

export function Band3D({ variant = 'default', children }: Band3DProps) {
  return (
    <section className={`band-3d band-3d--${variant}`}>
      <div className="container-3d">{children}</div>
    </section>
  );
}

interface Button3DProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

export function Button3D({ variant = 'primary', children, className = '', ...props }: Button3DProps) {
  const baseStyles = `
    font-family: var(--font-sans);
    font-size: var(--font-size-sm);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 14px 28px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease-out;
    position: relative;
    overflow: hidden;
  `;

  const variantStyles = {
    primary: `
      color: #030303;
      background: linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-bright) 100%);
      box-shadow: 0 4px 24px rgba(0, 212, 170, 0.4), inset 0 1px 0 rgba(255,255,255,0.2);
    `,
    secondary: `
      color: var(--color-fg);
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-line-strong);
      box-shadow: var(--shadow-sm);
    `,
    ghost: `
      color: var(--color-fg-muted);
      background: transparent;
      border: 1px solid transparent;
    `,
  };

  const hoverStyles = {
    primary: `
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 8px 32px rgba(0, 212, 170, 0.6), inset 0 1px 0 rgba(255,255,255,0.3);
    `,
    secondary: `
      background: var(--color-bg-overlay);
      border-color: var(--color-brand);
      color: var(--color-brand);
    `,
    ghost: `
      color: var(--color-fg);
      background: var(--color-bg-elevated);
    `,
  };

  return (
    <button
      className={`button-3d button-3d--${variant} ${className}`}
      style={{ cssText: baseStyles + variantStyles[variant] } as React.CSSProperties}
      onMouseEnter={(e) => { e.currentTarget.style.cssText += hoverStyles[variant]; }}
      onMouseLeave={(e) => { e.currentTarget.style.cssText = baseStyles + variantStyles[variant]; }}
      {...props}
    >
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
      <span className="button-shine-3d" aria-hidden="true" />
    </button>
  );
}

interface Container3DProps {
  children: React.ReactNode;
}

export function Container3D({ children }: Container3DProps) {
  return <div className="container-3d">{children}</div>;
}