# Decision 0001: Stria Systems And Trace Boundaries

## Decision

Stria Systems is the company-level intelligence infrastructure architecture. Trace is the first commercial product housed within Stria Systems.

## Why

The company needs room to develop future products without forcing Trace to become the entire platform identity. Trace should benefit from Stria's trust, ontology, and enterprise posture while remaining a concrete product with a clear user journey.

## Alternatives Considered

- Make Trace the platform brand.
- Create separate company and product repositories immediately.
- Ship only the Trace app with no company surface.

## Future Implications

Shared concepts such as organizations, evidence, policies, evaluations, and audit records should be designed as Stria-level primitives. Runtime experiences, product navigation, and product-specific workflows should remain Trace-owned until reuse pressure is real.

## Risks

The boundary requires naming discipline. Overusing `stria` for product-specific code will create premature platform abstractions. Overusing `trace` for company-level concepts will make future products awkward.
