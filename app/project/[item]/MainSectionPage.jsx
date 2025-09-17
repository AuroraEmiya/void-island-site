"use client";

import ReturnMenus from "@/components/ReturnMenus";

export default function ProjectItemPage({ item_name }) {
  const { item } = item_name;

  return (
    <main className="p-6 min-h-screen flex items-center justify-center text-white relative overflow-hidden">
      {/* 背景层：上下渐变 + 流动 */}
      <div className="absolute inset-0 animate-gradient"></div>

      {/* 内容层 */}
      <div className="relative z-10 text-center">
        <ReturnMenus />
        <h1 className="text-4xl font-bold">项目主页未建立</h1>
      </div>

      <style jsx>{`
        @keyframes gradientFlow {
          0% {
            background-position: 0% 0%;
          }
          50% {
            background-position: 100% 100%;
          }
          100% {
            background-position: 0% 0%;
          }
        }
        .animate-gradient {
          background: linear-gradient(
            140deg,
            rgba(255, 182, 193, 1) 0%,   /* 上粉色 (lightpink) */
            rgba(138, 43, 226, 1) 100%  /* 下紫色 (blueviolet) */
          );
          background-size: 200% 200%;
          animation: gradientFlow 6s ease infinite;
        }
      `}</style>
    </main>
  );
}
