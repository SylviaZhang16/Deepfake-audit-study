/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  webpack: (config, { isServer }) => {
      if (isServer) {
        config.externals = config.externals.concat([
          /venv/,
        ]);
      }
      return config;
    },
  };
  
  export default nextConfig;
  