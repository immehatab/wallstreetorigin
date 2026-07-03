/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // avoid double-invoking the ingestion scheduler in dev
  // better-sqlite3 is a native module — keep it out of the bundler.
  serverExternalPackages: ["better-sqlite3"],
  // Production build hygiene: don't fail the build on lint (no eslint config
  // in this project); types are already checked separately and are clean.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
