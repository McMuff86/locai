import React from "react";
import Link from "next/link";
import { Button } from "../components/ui/button";
import { ThemeToggle } from "../components/ui/theme-toggle";
import { ArrowRight, Terminal, Shield, Cpu } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-gradient-to-b from-background to-muted/20">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="text-center max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-primary text-primary-foreground">
            <Terminal className="w-10 h-10" />
          </div>
        </div>
        
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">LocAI</span>
        </h1>
        
        <p className="text-xl font-semibold text-muted-foreground mb-6">
          Your AI, Locked and Loaded - Future Unleashed on Bare Metal
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="flex flex-col items-center p-4 rounded-lg border border-border bg-card text-card-foreground">
            <Shield className="w-8 h-8 mb-2 text-primary" />
            <h3 className="font-medium">Private & Secure</h3>
            <p className="text-sm text-muted-foreground">All data stays on your machine</p>
          </div>
          
          <div className="flex flex-col items-center p-4 rounded-lg border border-border bg-card text-card-foreground">
            <Cpu className="w-8 h-8 mb-2 text-primary" />
            <h3 className="font-medium">Locally Powered</h3>
            <p className="text-sm text-muted-foreground">Runs models directly on your hardware</p>
          </div>
          
          <div className="flex flex-col items-center p-4 rounded-lg border border-border bg-card text-card-foreground">
            <Terminal className="w-8 h-8 mb-2 text-primary" />
            <h3 className="font-medium">Full Control</h3>
            <p className="text-sm text-muted-foreground">Choose and customize your AI models</p>
          </div>
        </div>
        
        <Link href="/chat" passHref>
          <Button size="lg" className="group">
            Start Chatting
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </Link>
        
        <p className="mt-6 text-sm text-muted-foreground">
          Make sure <a href="https://ollama.ai/" target="_blank" rel="noopener noreferrer" className="underline">Ollama</a> is running and you have models installed.
        </p>
      </div>
    </main>
  );
} 