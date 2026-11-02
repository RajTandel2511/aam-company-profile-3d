/**
 * Static export for GitHub Pages. Pages serves a project site from
 * https://<user>.github.io/<repo>/, so the deploy workflow sets BASE_PATH to
 * "/<repo>". Locally BASE_PATH is unset and the site serves from the root.
 */
const basePath = process.env.BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  // Emit folder/index.html so Pages resolves /<repo>/ without a rewrite rule.
  trailingSlash: true,
  // Plain <a href> links (the résumé, the replay link) are not rewritten by
  // Next, so they read the base path from here.
  // The build year is stamped once so server HTML and client JS always agree
  // (a runtime new Date() in the browser would disagree after New Year).
  env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_BUILD_YEAR: String(new Date().getFullYear()) },
};

export default nextConfig;
