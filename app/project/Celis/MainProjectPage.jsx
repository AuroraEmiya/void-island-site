"use client";

import { useRef, useEffect } from "react";
import ReturnMenus from "@/components/ReturnMenus";
import ProjectContent from "@/components/ProjectContent";
import { useTheme } from "@/lib/theme";

// === 可自定义的参数 ===
const PARTICLE_COUNT = 150;
const PARTICLE_SPEED_MIN = 0.2;
const PARTICLE_SPEED_MAX = 0.8;
const PARTICLE_RADIUS_MIN = 0.5;
const PARTICLE_RADIUS_MAX = 1.5;
// =====================

export default function MainProjectPage({ projects }) {
  const canvasRef = useRef(null);
  const { isDarkMode } = useTheme();

  const descriptionFile = projects.find((file) => file.filename === "description");
  const projectDescription = descriptionFile ? descriptionFile.content : "未找到项目描述文件。";

  // 粒子效果的逻辑保持不变
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const particleColor = isDarkMode ? "rgba(255, 255, 255, 0.7)" : "#FFFFFF";
    
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
          speed: PARTICLE_SPEED_MIN + Math.random() * (PARTICLE_SPEED_MAX - PARTICLE_SPEED_MIN),
          radius: PARTICLE_RADIUS_MIN + Math.random() * (PARTICLE_RADIUS_MAX - PARTICLE_RADIUS_MIN),
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.y -= p.speed;
        if (p.y < 0) {
          p.y = canvas.height;
          p.x = Math.random() * canvas.width;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = particleColor;
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
  }, [isDarkMode]);

  return (
    // 我们不再在 main 元素上添加 dark-mode 类
    <main className="md:p-6 min-h-screen flex items-center text-white relative">
      
      {/* 1. 背景层容器 */}
      <div className="fixed inset-0 z-[-1]"> {/* 将背景整体置于最底层 */}
        {/* 日间模式背景 */}
        <div
          className="day-gradient absolute inset-0 animate-gradient"
          // 通过 style 控制透明度，实现淡入淡出
          style={{ opacity: isDarkMode ? 0 : 1, transition: 'opacity 1s ease-in-out' }}
        />
        {/* 夜间模式背景 */}
        <div
          className="night-gradient absolute inset-0 animate-gradient"
          style={{ opacity: isDarkMode ? 1 : 0, transition: 'opacity 1s ease-in-out' }}
        />
      </div>

      {/* 粒子画布 */}
      {/* 确保 z-index 比背景高，比内容低 */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0" />

      {/* 内容层 */}
      <div
        className="relative z-10 flex flex-col items-center w-full"
        style={{
          maxWidth: "1200px",
          padding: "40px",
        }}
      >
        <ReturnMenus />
        <ProjectContent content={projectDescription} />
      </div>

      {/* 2. 更新 style 块，为两个独立的背景层定义样式 */}
      <style jsx>{`
        @keyframes gradientFlow {
          0% {
            background-position: 10% 10%;
          }
          50% {
            background-position: 80% 80%;
          }
          100% {
            background-position: 10% 10%;
          }
        }
        
        /* 移除 .animate-gradient 的定义，因为它不再需要 */

        .day-gradient {
          background: linear-gradient(140deg, #d85d5d 0%, #3a325a 100%);
          /* VVV 将动画属性移动到这里 VVV */
          background-size: 200% 200%;
          animation: gradientFlow 15s ease infinite;
        }
        
        .night-gradient {
          background: linear-gradient(140deg, #0b192f 0%, #020c1b 100%);
          /* VVV 动画属性也需要加到这里 VVV */
          background-size: 200% 200%;
          animation: gradientFlow 15s ease infinite;
        }
      `}</style>
    </main>
  );
}