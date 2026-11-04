export type AboutGuide = {
  id: string;
  title: string;
  summary: string;
  steps: { title: string; body: string }[];
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]!);
}

export function buildAboutInstructionsHtml({
  appName,
  copyrightNotice,
  guides,
}: {
  appName: string;
  copyrightNotice: string;
  guides: AboutGuide[];
}): string {
  const contents = guides.map((guide, index) =>
    `<li><a href="#${escapeHtml(guide.id)}">${String(index + 1).padStart(2, '0')} · ${escapeHtml(guide.title)}</a></li>`,
  ).join('');
  const sections = guides.map((guide, index) => `
    <section id="${escapeHtml(guide.id)}">
      <h2>${String(index + 1).padStart(2, '0')} · ${escapeHtml(guide.title)}</h2>
      <p class="summary">${escapeHtml(guide.summary)}</p>
      ${guide.steps.map((step, stepIndex) => `
        <article class="step">
          <h3>${String(stepIndex + 1).padStart(2, '0')} · ${escapeHtml(step.title)}</h3>
          <p>${escapeHtml(step.body)}</p>
        </article>
      `).join('')}
    </section>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>How to use ${escapeHtml(appName)}</title>
    <style>
      @page { size: portrait; margin: 18mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #183542; font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.55; }
      h1 { margin: 0 0 6px; font-size: 23pt; line-height: 1.2; }
      h2 { margin: 24px 0 4px; padding-bottom: 5px; border-bottom: 1px solid #cbd7d1; font-size: 16pt; break-after: avoid; }
      h3 { margin: 12px 0 2px; font-size: 11pt; break-after: avoid; }
      p { margin: 3px 0 10px; }
      .copyright { margin: 0 0 22px; color: #52635f; font-size: 9pt; }
      .contents { margin: 0 0 22px; padding: 14px 18px; background: #f1f5f2; border-radius: 8px; }
      .contents h2 { margin: 0 0 8px; padding: 0; border: 0; font-size: 13pt; }
      .contents ol { margin: 0; padding-left: 22px; }
      a { color: #176d61; }
      .summary { margin-bottom: 12px; color: #52635f; }
      .step { margin: 0 0 10px 12px; break-inside: avoid; }
      section { break-inside: auto; }
    </style>
  </head>
  <body>
    <header>
      <h1>How to use ${escapeHtml(appName)}</h1>
      <p class="copyright">${escapeHtml(copyrightNotice)}</p>
    </header>
    <nav class="contents" aria-label="Guide contents">
      <h2>Contents</h2>
      <ol>${contents}</ol>
    </nav>
    ${sections}
  </body>
</html>`;
}
