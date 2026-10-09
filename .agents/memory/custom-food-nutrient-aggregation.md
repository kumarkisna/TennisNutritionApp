---
name: Custom-food nutrient aggregation
description: Product rule for calculating per-100 g nutrition from custom-food ingredients.
---

For custom foods calculated from ingredient rows, calculate each nutrient as the sum of `(ingredient grams × that ingredient's per-100 g nutrient value)` divided by total ingredient grams. If calcium or iron is unknown for any ingredient, keep that resulting nutrient unknown; use zero only when the user knows it is absent.

**Why:** Equal averaging misrepresents recipes with different ingredient amounts, and treating unknown nutrient values as zero silently understates the result.

**How to apply:** Keep mass weighting and unknown preservation consistent in custom-food editing, storage validation, backups, food-library transfers, and any future nutrients added to the calculator.
