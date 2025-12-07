import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "../components/ui/button";
import { ThemeToggle } from "../components/ui/theme-toggle";
import { 
  ArrowRight, 
  Shield, 
  Cpu, 
  Sparkles, 
  MessageSquare, 
  Image as ImageIcon,
  FileText,
  Zap
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between p-6">
        <div className="flex items-center gap-2">
          <Image 
            src="/LocAI_logo_v0.2.svg" 
            alt="LocAI" 
            width={32} 
            height={32} 
          />
          <span className="font-semibold text-lg">LocAI</span>
        </div>
        <ThemeToggle />
      </header>
      
      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-screen px-4 pt-20 pb-12">
        <div className="text-center max-w-4xl mx-auto">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl scale-150" />
              <Image 
                src="/LocAI_logo_v0.2.svg" 
                alt="LocAI Logo" 
                width={180} 
                height={180} 
                priority
                className="relative z-10"
              />
            </div>
          </div>
          
          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-emerald-500">
              LocAI
            </span>
          </h1>
          
          {/* Tagline */}
          <p className="text-xl md:text-2xl text-muted-foreground mb-3 font-light">
            Your AI, Locked and Loaded
          </p>
          <p className="text-base text-muted-foreground/70 mb-10">
            Privacy-first AI assistant running on your hardware
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/chat">
              <Button size="lg" className="group text-base px-8 h-12">
                <MessageSquare className="mr-2 h-5 w-5" />
                Start Chatting
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/gallery">
              <Button variant="outline" size="lg" className="text-base px-8 h-12">
                <ImageIcon className="mr-2 h-5 w-5" />
                Image Gallery
              </Button>
            </Link>
          </div>
          
          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
            <div className="group p-5 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:bg-card/80 transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">100% Private</h3>
              <p className="text-sm text-muted-foreground">All data stays local on your machine</p>
            </div>
            
            <div className="group p-5 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:bg-card/80 transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Cpu className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Local Hardware</h3>
              <p className="text-sm text-muted-foreground">Runs models on your GPU</p>
            </div>
            
            <div className="group p-5 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:bg-card/80 transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">ComfyUI</h3>
              <p className="text-sm text-muted-foreground">Integrated image generation</p>
            </div>
            
            <div className="group p-5 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:bg-card/80 transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Smart Notes</h3>
              <p className="text-sm text-muted-foreground">AI-powered knowledge base</p>
            </div>
          </div>
          
          {/* Tech Stack */}
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground/60 mb-8">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>Powered by Ollama</span>
            </div>
            <span>•</span>
            <span>Next.js 15</span>
            <span>•</span>
            <span>React 19</span>
          </div>
          
          {/* Footer Note */}
          <p className="text-sm text-muted-foreground">
            Make sure{" "}
            <a 
              href="https://ollama.ai/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary hover:underline"
            >
              Ollama
            </a>
            {" "}is running with your preferred models installed.
          </p>
        </div>
      </div>
    </main>
  );
} 