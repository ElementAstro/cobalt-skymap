import type { NextConfig } from "next";
import packageJson from './package.json';

process.env.BROWSERSLIST_IGNORE_OLD_DATA ??= 'true';
process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA ??= 'true';

const isProd = process.env.NODE_ENV === "production";

const internalHost = process.env.TAURI_DEV_HOST || "localhost";
const devPort = process.env.PORT || "1420";

// Enable static export for Tauri production builds.
// This makes `pnpm build` generate the `out/` directory that Tauri loads from `src-tauri/tauri.conf.json` (frontendDist: "../out").
const nextConfig: NextConfig = {
  output: isProd ? "export" : undefined,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().split('T')[0],
  },
  // Note: This feature is required to use the Next.js Image component in SSG mode.
  // See https://nextjs.org/docs/messages/export-image-api for different workarounds.
  images: {
    unoptimized: true,
  },
  // Configure assetPrefix or else the server won't properly resolve your assets.
  assetPrefix: isProd ? undefined : `http://${internalHost}:${devPort}`,
  
  // Empty turbopack config to silence webpack warning (Next.js 16 uses Turbopack by default)
  turbopack: {},
  
  // Rewrites for development - proxy Stellarium data requests to bypass CORS
  // Note: These only work in dev mode, not with static export
  ...(isProd ? {} : {
    async rewrites() {
      return [
        {
          source: '/stellarium-proxy/:path*',
          destination: 'https://data.stellarium-web.org/:path*',
        },
        {
          source: '/cds-proxy/:path*',
          destination: 'https://alasky.cds.unistra.fr/:path*',
        },
      ];
    },
  }),
};

export default nextConfig;
