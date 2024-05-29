/** @type {import('next').NextConfig} */
const nextConfig = {
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
  