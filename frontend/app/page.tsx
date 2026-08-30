"use client";

import { useEffect, useState } from "react";
import { checkBackendHealth } from "@/lib/api";

export default function Home() {
  const [message, setMessage] = useState("Checking backend...");

  useEffect(() => {
    checkBackendHealth()
      .then((data) => {
        setMessage(data.message);
      })
      .catch(() => {
        setMessage("Backend connection failed");
      });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">{message}</h1>
    </main>
  );
}