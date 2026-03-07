/**
 * @jest-environment node
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as updaterManifestBuilder from '../build-latest-json.cjs';

const {
  buildLatestManifest,
  collectUpdaterArtifacts,
  extractVersionNotes,
} = updaterManifestBuilder;

describe('build-latest-json', () => {
  it('builds a static updater manifest for GitHub Releases', () => {
    const manifest = buildLatestManifest({
      version: '0.2.0',
      pubDate: '2026-03-06T00:00:00Z',
      notes: '### Added\n- GitHub updater support',
      repository: 'AstroAir/skymap-test',
      tag: 'v0.2.0',
      assets: [
        {
          platform: 'windows-x86_64',
          fileName: 'SkyMap_0.2.0_x64_en-US.zip',
          signature: 'windows-signature',
        },
        {
          platform: 'darwin-aarch64',
          fileName: 'SkyMap.app.tar.gz',
          signature: 'mac-signature',
        },
      ],
    });

    expect(manifest.version).toBe('0.2.0');
    expect(manifest.notes).toContain('GitHub updater support');
    expect(manifest.platforms['windows-x86_64'].url).toContain('/download/v0.2.0/SkyMap_0.2.0_x64_en-US.zip');
    expect(manifest.platforms['windows-x86_64'].signature).toBe('windows-signature');
    expect(manifest.platforms['darwin-aarch64'].signature).toBe('mac-signature');
  });

  it('extracts release notes for a specific version from CHANGELOG content', () => {
    const notes = extractVersionNotes(
      [
        '# Changelog',
        '',
        '## [0.2.0] - 2026-03-06',
        '',
        '### Added',
        '',
        '- GitHub updater support',
        '',
        '## [0.1.0] - 2025-01-04',
        '',
        '- Initial release',
      ].join('\n'),
      '0.2.0',
    );

    expect(notes).toContain('### Added');
    expect(notes).toContain('GitHub updater support');
    expect(notes).not.toContain('Initial release');
  });

  it('fails when CHANGELOG content does not contain the requested version section', () => {
    expect(() =>
      extractVersionNotes('# Changelog\n\n## [0.1.0] - 2025-01-04', '0.2.0'),
    ).toThrow(/0.2.0/);
  });

  it('collects updater artifacts and signatures from downloaded artifact directories', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skymap-updater-'));

    try {
      const windowsDir = path.join(tempRoot, 'updater-windows-x86_64');
      const macDir = path.join(tempRoot, 'updater-darwin-aarch64');

      fs.mkdirSync(windowsDir, { recursive: true });
      fs.mkdirSync(macDir, { recursive: true });

      fs.writeFileSync(path.join(windowsDir, 'SkyMap_0.2.0_x64_en-US.zip'), 'zip-bytes');
      fs.writeFileSync(path.join(windowsDir, 'SkyMap_0.2.0_x64_en-US.zip.sig'), 'windows-signature\n');
      fs.writeFileSync(path.join(macDir, 'SkyMap.app.tar.gz'), 'tar-bytes');
      fs.writeFileSync(path.join(macDir, 'SkyMap.app.tar.gz.sig'), 'mac-signature\n');

      const assets = collectUpdaterArtifacts(tempRoot);

      expect(assets).toEqual([
        {
          platform: 'darwin-aarch64',
          fileName: 'SkyMap.app.tar.gz',
          signature: 'mac-signature',
        },
        {
          platform: 'windows-x86_64',
          fileName: 'SkyMap_0.2.0_x64_en-US.zip',
          signature: 'windows-signature',
        },
      ]);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
