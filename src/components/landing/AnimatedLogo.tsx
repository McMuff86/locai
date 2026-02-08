"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

export default function AnimatedLogo() {
  return (
    <div className="relative flex items-center justify-center mb-8">
      {/* Outer pulse ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 260,
          height: 260,
          background:
            "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
          opacity: 0.08,
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.08, 0.03, 0.08],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Inner glow ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 200,
          height: 200,
          background:
            "radial-gradient(circle, var(--primary) 0%, transparent 60%)",
          opacity: 0.15,
        }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.15, 0.08, 0.15],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5,
        }}
      />

      {/* Rotating ring accent */}
      <motion.div
        className="absolute rounded-full border border-primary/10"
        style={{ width: 220, height: 220 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        <div
          className="absolute w-2 h-2 rounded-full bg-primary/40"
          style={{ top: -4, left: "50%", transform: "translateX(-50%)" }}
        />
      </motion.div>

      {/* Logo */}
      <motion.div
        className="relative z-10"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <Image
          src="/LocAI_logo_v0.2.svg"
          alt="LocAI Logo"
          width={180}
          height={180}
          priority
          className="drop-shadow-[0_0_30px_rgba(0,200,168,0.3)]"
        />
      </motion.div>
    </div>
  );
}
