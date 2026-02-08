"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
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
  Zap,
} from "lucide-react";

const ParticleField = dynamic(
  () => import("../components/landing/ParticleField"),
  { ssr: false }
);
const AnimatedLogo = dynamic(
  () => import("../components/landing/AnimatedLogo"),
  { ssr: false }
);

/* ── Animation variants ──────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

/* ── Feature data ────────────────────────────────────────── */

const features = [
  {
    icon: Shield,
    title: "100% Private",
    desc: "All data stays local on your machine",
  },
  {
    icon: Cpu,
    title: "Local Hardware",
    desc: "Runs models on your GPU",
  },
  {
    icon: Sparkles,
    title: "ComfyUI",
    desc: "Integrated image generation",
  },
  {
    icon: FileText,
    title: "Smart Notes",
    desc: "AI-powered knowledge base",
  },
];

/* ── Page ────────────────────────────────────────────────── */

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 relative overflow-hidden">
      {/* Three.js particle background */}
      <Suspense fallback={null}>
        <ParticleField />
      </Suspense>

      {/* Soft radial ambient light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <motion.header
        className="absolute top-0 left-0 right-0 flex items-center justify-between p-6 z-20"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
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
      </motion.header>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-screen px-4 pt-20 pb-12 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          {/* Animated Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
          >
            <Suspense
              fallback={
                <div className="flex items-center justify-center mb-8">
                  <Image
                    src="/LocAI_logo_v0.2.svg"
                    alt="LocAI Logo"
                    width={180}
                    height={180}
                    priority
                  />
                </div>
              }
            >
              <AnimatedLogo />
            </Suspense>
          </motion.div>

          {/* Title */}
          <motion.h1
            className="text-5xl md:text-7xl font-bold tracking-tight mb-4"
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-emerald-400 to-primary bg-[length:200%_auto] animate-gradient-x">
              LocAI
            </span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            className="text-xl md:text-2xl text-muted-foreground mb-3 font-light"
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            Your AI, Locked and Loaded
          </motion.p>
          <motion.p
            className="text-base text-muted-foreground/70 mb-10"
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            Privacy-first AI assistant running on your hardware
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            custom={4}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <Link href="/chat">
              <Button
                size="lg"
                className="group text-base px-8 h-12 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow"
              >
                <MessageSquare className="mr-2 h-5 w-5" />
                Start Chatting
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/gallery">
              <Button
                variant="outline"
                size="lg"
                className="text-base px-8 h-12 backdrop-blur-sm border-border/60 hover:border-primary/40 transition-colors"
              >
                <ImageIcon className="mr-2 h-5 w-5" />
                Image Gallery
              </Button>
            </Link>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                className="group p-5 rounded-xl border border-border/40 bg-card/30 backdrop-blur-md hover:border-primary/30 hover:bg-card/60 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
                variants={cardVariant}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-primary/20 transition-all">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Tech Stack */}
          <motion.div
            className="flex items-center justify-center gap-6 text-sm text-muted-foreground/60 mb-8"
            custom={6}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>Powered by Ollama</span>
            </div>
            <span>•</span>
            <span>Next.js 15</span>
            <span>•</span>
            <span>React 19</span>
          </motion.div>

          {/* Footer */}
          <motion.p
            className="text-sm text-muted-foreground"
            custom={7}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            Make sure{" "}
            <a
              href="https://ollama.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Ollama
            </a>{" "}
            is running with your preferred models installed.
          </motion.p>
        </div>
      </div>
    </main>
  );
}
