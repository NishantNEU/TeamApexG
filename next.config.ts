import withMdkCheckout from "@moneydevkit/nextjs/next-plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["swagger-ui-react"],
};

export default withMdkCheckout(nextConfig as any);
