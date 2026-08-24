const configuredBackendUrl = process.env.BACKEND_API_URL?.trim();

if (!configuredBackendUrl) {
  throw new Error(
    "BACKEND_API_URL is required. Set it to the FastAPI service URL.",
  );
}

const backendUrl = configuredBackendUrl.replace(/\/$/, "");

const nextConfig = {
  // Keep a running production build intact while local development compiles.
  // Sharing `.next` makes the production HTML reference chunks that `next dev`
  // can replace or remove, leaving an already-open browser with stale code.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
