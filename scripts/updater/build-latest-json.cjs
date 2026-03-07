const fs = require('node:fs');
const path = require('node:path');

/**
 * @typedef {Object} UpdaterAsset
 * @property {string} platform
 * @property {string} fileName
 * @property {string} signature
 */

/**
 * @typedef {{ signature: string, url: string }} UpdaterPlatformManifest
 */

/**
 * @typedef {Record<string, UpdaterPlatformManifest>} UpdaterPlatforms
 */

/**
 * @typedef {Object} LatestManifest
 * @property {string} version
 * @property {string} notes
 * @property {string} pub_date
 * @property {UpdaterPlatforms} platforms
 */

/**
 * @typedef {Object} BuildLatestManifestInput
 * @property {string} version
 * @property {string} pubDate
 * @property {string} notes
 * @property {string} repository
 * @property {string} tag
 * @property {UpdaterAsset[]} assets
 */

function walkFiles(rootDir) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
      continue;
    }
    files.push(entryPath);
  }

  return files;
}

function findUpdaterPlatform(filePath, rootDir) {
  const segments = path.relative(rootDir, filePath).split(/[\\/]+/);
  const platformSegment = segments.find((segment) => segment.startsWith('updater-'));

  if (!platformSegment) {
    throw new Error(`Unable to determine updater platform for ${filePath}`);
  }

  return platformSegment.slice('updater-'.length);
}

function collectUpdaterArtifacts(rootDir) {
  if (!fs.existsSync(rootDir)) {
    throw new Error(`Artifacts directory does not exist: ${rootDir}`);
  }

  return walkFiles(rootDir)
    .filter((filePath) => filePath.endsWith('.sig'))
    .map((signaturePath) => {
      const payloadPath = signaturePath.slice(0, -4);
      if (!fs.existsSync(payloadPath)) {
        throw new Error(`Missing updater payload for signature file: ${signaturePath}`);
      }

      return {
        platform: findUpdaterPlatform(signaturePath, rootDir),
        fileName: path.basename(payloadPath),
        signature: fs.readFileSync(signaturePath, 'utf8').trim(),
      };
    })
    .sort((left, right) => left.platform.localeCompare(right.platform));
}

function extractVersionNotes(changelogContents, version) {
  const lines = changelogContents.split(/\r?\n/);
  const heading = `## [${version}]`;
  const startIndex = lines.findIndex((line) => line.startsWith(heading));

  if (startIndex === -1) {
    throw new Error(`Could not find version ${version} in CHANGELOG.md`);
  }

  const sectionLines = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('## [')) {
      break;
    }
    sectionLines.push(line);
  }

  const notes = sectionLines.join('\n').trim();
  if (!notes) {
    throw new Error(`Version ${version} does not contain release notes in CHANGELOG.md`);
  }

  return notes;
}

/**
 * @param {BuildLatestManifestInput} input
 * @returns {LatestManifest}
 */
function buildLatestManifest({ version, pubDate, notes, repository, tag, assets }) {
  if (!assets.length) {
    throw new Error('No updater artifacts were found to build latest.json');
  }

  /** @type {UpdaterPlatforms} */
  const platforms = {};
  for (const asset of assets) {
    platforms[asset.platform] = {
      signature: asset.signature,
      url: `https://github.com/${repository}/releases/download/${tag}/${asset.fileName}`,
    };
  }

  return {
    version,
    notes,
    pub_date: pubDate,
    platforms,
  };
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value) {
      throw new Error(`Invalid argument pair: ${key ?? '<missing>'}`);
    }
    options[key.slice(2)] = value;
  }

  return options;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const repository = options.repo;
  const tag = options.tag;
  const artifactsDir = options.artifacts;
  const changelogPath = options.changelog;
  const outputPath = options.output;
  const version = options.version ?? tag?.replace(/^v/, '');

  if (!repository || !tag || !artifactsDir || !changelogPath || !outputPath || !version) {
    throw new Error('Usage: node scripts/updater/build-latest-json.cjs --repo <owner/repo> --tag <vX.Y.Z> --artifacts <dir> --changelog <path> --output <path> [--version <X.Y.Z>]');
  }

  const changelogContents = fs.readFileSync(changelogPath, 'utf8');
  const notes = extractVersionNotes(changelogContents, version);
  const assets = collectUpdaterArtifacts(artifactsDir);
  const manifest = buildLatestManifest({
    version,
    pubDate: new Date().toISOString(),
    notes,
    repository,
    tag,
    assets,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

module.exports = {
  buildLatestManifest,
  collectUpdaterArtifacts,
  extractVersionNotes,
  main,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
