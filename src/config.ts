// Default values for environment variables
const DEFAULT_URL = "https://unduck.thismodern.dev";

// Environment variables are injected by Vite during build time
const config = {
  baseUrl: import.meta.env.VITE_BASE_URL || DEFAULT_URL,
};

export default config;