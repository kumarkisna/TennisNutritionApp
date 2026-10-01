---
name: SVG preview event verification
description: Why native SVG event behavior needs a real DOM interaction check in Expo web previews.
---

Verify a real click on the rendered SVG element, not only the presence of a callback in React component props.

**Why:** Native-to-web SVG event normalization can silently discard a DOM callback while the React component still exposes it. Prop inspection can therefore report an apparently interactive point that does not respond, and native responder properties may also produce browser warnings.

**How to apply:** When changing native SVG event adapters, use a focused rendered-element interaction check and confirm the selected detail changes. Keep native and web event behavior separate; do not repeat unrelated persistence or navigation tests for a small event-adapter correction.