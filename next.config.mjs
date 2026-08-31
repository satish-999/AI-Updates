/** @type {import('next').NextConfig} */
const nextConfig = {
  // The worker pulls in onnxruntime and sharp for local embeddings. Nothing in
  // the app imports them, and this keeps the tracer from walking into them.
  outputFileTracingExcludes: {
    "*": ["./node_modules/@xenova/**", "./node_modules/onnxruntime-*/**", "./node_modules/sharp/**"],
  },
};
export default nextConfig;
