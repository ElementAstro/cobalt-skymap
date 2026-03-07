const fs = require('node:fs');
const path = require('node:path');

const packageEntry = require.resolve('baseline-browser-mapping');
const packageDir = path.dirname(path.dirname(packageEntry));
const nextBrowserslistEntry = require.resolve('next/dist/compiled/browserslist');
const patches = [
  {
    files: [
      packageEntry,
      path.join(packageDir, 'dist', 'index.js'),
    ],
    searchPatterns: [
      'if(n||"undefined"!=typeof process&&process.env&&(process.env.BROWSERSLIST_IGNORE_OLD_DATA||process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA))return;',
      'if(n)return;',
    ],
    replacement: 'return;',
  },
  {
    files: [nextBrowserslistEntry],
    searchPatterns: [
      'console.warn("[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`")',
    ],
    replacement: 'void 0',
  },
];

for (const patch of patches) {
  for (const file of patch.files) {
    if (!fs.existsSync(file)) {
      continue;
    }

    const contents = fs.readFileSync(file, 'utf8');
    if (contents.includes(patch.replacement) && patch.searchPatterns.every((pattern) => !contents.includes(pattern))) {
      continue;
    }

    const matchedPattern = patch.searchPatterns.find((pattern) => contents.includes(pattern));
    if (!matchedPattern) {
      throw new Error(`Unable to find warning pattern in ${file}`);
    }

    fs.writeFileSync(file, contents.replace(matchedPattern, patch.replacement));
  }
}
