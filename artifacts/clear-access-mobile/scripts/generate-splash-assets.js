const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const appConfig = require(path.join(projectRoot, 'app.json')).expo;
const appName = appConfig.name?.trim();
const copyrightNotice = appConfig.extra?.copyrightNotice?.trim();

if (!appName || !copyrightNotice) {
  throw new Error('Set expo.name and expo.extra.copyrightNotice in app.json before generating splash artwork.');
}

function escapeXml(value) {
  return value.replace(/[<>&"']/g, character => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[character]);
}

const separator = ' — ';
const separatorIndex = appName.indexOf(separator);
const title = separatorIndex >= 0 ? appName.slice(0, separatorIndex) : appName;
const subtitle = separatorIndex >= 0 ? appName.slice(separatorIndex + separator.length) : '';
const safeTitle = escapeXml(title);
const safeSubtitle = escapeXml(subtitle);
const safeCopyright = escapeXml(copyrightNotice);

function createArtwork({ titleColor, subtitleColor, copyrightColor, accentColor }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="450" viewBox="0 0 1400 450">
  <text x="700" y="145" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="88" font-weight="700" fill="${titleColor}">${safeTitle}</text>
  ${safeSubtitle ? `<text x="700" y="225" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="46" font-weight="500" fill="${subtitleColor}">${safeSubtitle}</text>` : ''}
  <rect x="665" y="268" width="70" height="5" rx="2.5" fill="${accentColor}"/>
  <text x="700" y="335" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="44" font-weight="400" fill="${copyrightColor}">${safeCopyright}</text>
</svg>
`;
}

const variants = [
  {
    name: 'light',
    colors: { titleColor: '#183542', subtitleColor: '#176d61', copyrightColor: '#596863', accentColor: '#8acdb4' },
  },
  {
    name: 'dark',
    colors: { titleColor: '#f5f7fa', subtitleColor: '#9ce5ce', copyrightColor: '#c0cbd4', accentColor: '#9ce5ce' },
  },
];

for (const variant of variants) {
  const svgPath = path.join(projectRoot, 'assets', 'images', `splash-${variant.name}.svg`);
  const pngPath = path.join(projectRoot, 'assets', 'images', `splash-${variant.name}.png`);
  fs.writeFileSync(svgPath, createArtwork(variant.colors));
  const rendered = spawnSync('magick', [
    '-background', 'none', svgPath, '-depth', '8', `PNG32:${pngPath}`,
  ], { encoding: 'utf8' });
  if (rendered.error || rendered.status !== 0) {
    const detail = rendered.error?.message ?? rendered.stderr ?? `exit code ${rendered.status}`;
    throw new Error(`Could not render ${variant.name} splash image: ${detail}`);
  }
}

console.log('Generated light and dark splash artwork from app.json branding.');
