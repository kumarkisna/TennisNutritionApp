---
name: Open Food Facts text search
description: Why product-name discovery uses the classic Open Food Facts search API rather than v2 search.
---

For free-text product lookup, use Open Food Facts' classic search API, not the v2 search endpoint with `search_terms`.

**Why:** A live v2 request with `search_terms=oats` returned the total catalog count and unrelated products, while the classic search request returned oat-related products. The v2 endpoint's documented filters are tag-based; accepting the parameter does not mean it applied the text query.

**How to apply:** Keep searches explicit rather than search-as-you-type. Open Food Facts documents a 10-searches-per-minute-per-IP limit, so cache and throttle requests, identify the application with a User-Agent, and attribute imported data.