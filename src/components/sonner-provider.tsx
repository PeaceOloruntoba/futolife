"use client";

import { Toaster } from "sonner";

export function SonnerProvider() {
  return <Toaster position="top-right" richColors closeButton theme="dark" duration={4500} visibleToasts={5} toastOptions={{ className: "futo-toast" }} />;
}
