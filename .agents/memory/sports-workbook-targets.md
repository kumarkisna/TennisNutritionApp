---
name: Sports workbook target integrity
description: Avoid inventing medical targets when the supplied sports workbook contains invalid iron values.
---

Do not convert the supplied sports-nutrition workbook's iron reference cells into daily iron targets.

**Why:** Several cells under "Iron mg/day" contain Excel date serials rather than plausible milligram values. The workbook also separates fat needs by person group and gives no quantitative carbohydrate reference for basic or strength-only days. Guessing missing or corrupted values could mislead people planning food, especially for adolescents.

**How to apply:** Show the valid weight-based carbohydrate/protein and age-group calcium figures as labeled workbook references, with gaps shown explicitly. For additional targets, use independently verified guidance or a user-provided goal rather than deriving a number from malformed cells.
