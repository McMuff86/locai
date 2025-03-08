import React from "react";
import Link from "next/link";
import { Button } from "../components/ui/button";
import { ThemeToggle } from "../components/ui/theme-toggle";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col">
        <h1 className="text-4xl font-bold mb-8 text-center">LocAI</h1>
        <p className="text-xl mb-8 text-center">
        Your AI, Locked and Loaded - Future Unleashed on Bare Metal
        </p>
        <Link href="/chat" passHref>
          <Button size="lg">
            Start Chat
          </Button>
        </Link>
      </div>
    </main>
  );
} 