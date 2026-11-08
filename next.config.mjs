/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Static export: `next build` writes a plain `out/` folder that any static
   * host can serve (Cloudflare Pages, S3, even a USB stick). The app has no
   * server components, API routes, or image optimisation — every record lives
   * in the browser — so nothing is lost by dropping the Node server.
   */
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
