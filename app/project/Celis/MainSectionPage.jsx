"use client";

import { useEffect, useRef } from "react";
import ReturnMenus from "@/components/ReturnMenus";

// === 粒子效果的可自定义参数 ===
const PARTICLE_COUNT = 150;
const PARTICLE_COLOR = "#FFFFFF";
const MIN_SPEED = 0.2;
const MAX_SPEED = 1.0;
const MIN_RADIUS = 0.5;
const MAX_RADIUS = 2;
// ==========================

export default function ProjectItemPage() {
  const canvasRef = useRef(null);

  // 这部分纯手写粒子的 JS 逻辑保持不变
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles = [];
    let animationFrameId;

    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          speed: MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED),
          radius: MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS),
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.y -= p.speed;
        if (p.y < 0) {
          p.y = canvas.height;
          p.x = Math.random() * canvas.width;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = PARTICLE_COLOR;
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    setCanvasSize();
    initParticles();
    animate();

    const handleResize = () => {
      setCanvasSize();
      initParticles();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    // 我们恢复使用您原来的 JSX 结构和 Tailwind 类名
    <main className="p-6 min-h-screen flex items-center justify-center text-white relative overflow-hidden">
      {/* 背景层 1：您原来的渐变动画 div */}
      <div className="absolute inset-0 animate-gradient"></div>

      {/* 背景层 2：我们的纯手写粒子画布 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0"
      />

      {/* 内容层 */}
      <div className="relative z-10 text-center">
        <ReturnMenus />
        <h1 className="text-4xl font-bold">项目主页未建立</h1>
      </div>

      {/* 这里是我们继承过来的、您原来的渐变背景波浪逻辑 */}
      <style jsx>{`
        @keyframes gradientFlow {
          0% {
            background-position: 20% 20%;
          }
          50% {
            background-position: 80% 80%;
          }
          100% {
            background-position: 20% 20%;
          }
        }
        .animate-gradient {
          background: linear-gradient(
            140deg,
            #D85D5D 0%,
            #3A325A 100%
          );
          background-size: 200% 200%;
          animation: gradientFlow 12s ease infinite;
        }
      `}</style>
    </main>
  );
}