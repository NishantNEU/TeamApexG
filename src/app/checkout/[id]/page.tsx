"use client";

import { Checkout } from "@moneydevkit/nextjs";
import { use } from "react";

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-md">
        <Checkout id={id} />
      </div>
    </div>
  );
}
