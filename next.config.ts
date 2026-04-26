import withMdkCheckout from "@moneydevkit/nextjs/next-plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withMdkCheckout(nextConfig as any);
