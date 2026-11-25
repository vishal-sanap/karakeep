import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local embeddings (search) load native ONNX binaries; keep them out of the bundle.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
};

export default nextConfig;
