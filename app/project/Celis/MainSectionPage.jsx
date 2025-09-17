"use client";

import { useCallback } from "react";
import Particles from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import ReturnMenus from "@/components/ReturnMenus";

export default function ProjectItemPage({}) {

  // tsParticles 初始化函数，只在需要时加载引擎
  const particlesInit = useCallback(async (engine) => {
    // console.log(engine);
    // 这里可以加载更多的形状或者预设，但我们为了最小化，只加载 slim 引擎
    await loadSlim(engine);
  }, []);

  // 粒子加载完成后的回调函数（可选）
  const particlesLoaded = useCallback(async (container) => {
    // await console.log(container);
  }, []);

  return (
    <main className="p-6 min-h-screen flex items-center justify-center text-white relative overflow-hidden">
      {/* 背景层 1：上下渐变 + 流动 */}
      <div className="absolute inset-0 animate-gradient"></div>

      {/* 背景层 2：粒子效果 */}
      <Particles
        id="tsparticles"
        init={particlesInit}
        loaded={particlesLoaded}
        className="absolute inset-0 z-0"
        options={{
          // --- 从这里开始替换 ---
          background: {
            color: {
              value: "transparent",
            },
          },
          fpsLimit: 120,
          particles: {
            color: {
              value: "#ffffff", // 粒子颜色
            },
            // 移除了粒子连接线，使效果更干净、更像星空或数据点
            links: {
              enable: false,
            },
            move: {
              direction: "top", // 粒子全部向上移动
              enable: true,
              outModes: {
                default: "out", // 粒子移出画布后会从底部重新出现
              },
              random: false,
              speed: 1.5, // 速度可以稍微调整
              straight: true, // 粒子直线移动
            },
            number: {
              density: {
                enable: true,
                area: 800,
              },
              value: 160, // 增加了粒子数量，使其更密集
            },
            opacity: {
              value: { min: 0.3, max: 0.8 }, // 透明度随机，营造闪烁感
            },
            shape: {
              type: "circle", // 仍然用圆形，模仿星点或数据点
            },
            size: {
              value: { min: 0.5, max: 2 }, // 粒子大小随机，有远近感
            },
            // 新增闪烁效果
            twinkle: {
              particles: {
                enable: true,
                frequency: 0.05,
                opacity: 1,
              },
            },
          },
          detectRetina: true,
          // --- 到这里结束替换 ---
        }}
      />

      {/* 内容层 */}
      <div className="relative z-10 text-center">
        <ReturnMenus />
        <h1 className="text-4xl font-bold">项目主页未建立</h1>
      </div>

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
            #D85D5D 0%, /* 上粉色 (lightpink) */
            #3A325A 100% /* 下紫色 (blueviolet) */
          );
          background-size: 200% 200%;
          animation: gradientFlow 12s ease infinite;
        }
      `}</style>
    </main>
  );
}