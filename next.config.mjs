import bundleAnalyzer from '@next/bundle-analyzer';

/** @type {import('next').NextConfig} */
const nextConfig = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})({
  
  
});

export default nextConfig;
