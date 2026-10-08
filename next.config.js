/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: { root: __dirname },
  outputFileTracingIncludes: {
    "/api/arc-items": [
      "./node_modules/arcraiders-data/items/**",
      "./data/arc-overrides/items/**",
    ],
    "/api/arc-items/image": [
      "./node_modules/arcraiders-data/images/items/**",
      "./node_modules/arcraiders-data/images/items_upscaled/**",
      "./data/arc-overrides/images/items/**",
    ],
    "/api/projects": [
      "./node_modules/arcraiders-data/projects.json",
      "./node_modules/arcraiders-data/hideout/**",
      "./data/arc-overrides/projects.json",
      "./data/arc-overrides/hideout/**",
    ],
  },
};

module.exports = nextConfig;
