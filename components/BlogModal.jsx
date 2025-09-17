"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
// 1. 导入新的语法高亮插件
import rehypePrettyCode from "rehype-pretty-code";
import { useTheme } from "@/lib/theme";

export default function BlogModal({ title, excerpt, content, onClose, isMobile }) {
  const modalRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState(content || "");

  function handleMaskClick(e) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  const [height, setHeight] = useState(0);
  const { isDarkMode } = useTheme();
  useEffect(() => {
    const updateHeight = () => {
      const fullHeight = window.innerHeight;
      const calcHeight = fullHeight - 140;
      setHeight(calcHeight);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center items-center px-4 backdrop-blur-sm bg-black/40"
      onClick={handleMaskClick}
      ref={modalRef}
    >
      <div
        className="relative bg-white rounded shadow-lg"
        style={{
          width: isMobile ? "90%" : "700px",
          height: `${height}px`,
          marginTop: "40px",
          marginBottom: "100px",
          overflow: "hidden",
          border: "5px solid gray",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 ${isDarkMode? "border-white text-white hover:bg-gray-600" : "border-black text-black hover:bg-gray-200"} font-bold transition`}
        >
          X
        </button>

        <div className={`${isDarkMode? "bg-black text-white darkTheme-scrollbar" : "bg-white text-black"} p-6 overflow-y-auto h-full`}>
          <div className="mb-6">
            {title && <h1 className="text-3xl font-bold text-center">{title}</h1>}
            {excerpt && (
              <p className={`text-xl italic text-center ${isDarkMode ? "text-gray-400" : "text-gray-600"} mt-2`}>{excerpt}</p>
            )}
          </div>

          {loading ? (
            <p className="text-center">加载中...</p>
          ) : (
            <ReactMarkdown
              // 2. 将插件添加到 rehypePlugins 数组中
              rehypePlugins={[
                rehypeRaw,
                [rehypePrettyCode, { theme: 'github-dark' }]
              ]}
              components={{
                // 3. 移除自定义的 pre 和 code 组件，让插件接管它们
                h1: ({ children }) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-semibold mb-2">{children}</h3>,
                // ... (other components like p, ul, ol, etc. remain the same)
                p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc ml-5 mb-3">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal ml-5 mb-3">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className={`border-l-4 border-gray-400 pl-4 italic ${isDarkMode ? "text-gray-300" : "text-gray-700"} mb-3`}>
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {children}
                  </a>
                ),
                font: ({ color, children }) => <span style={{ color }}>{children}</span>,
              }}
            >
              {markdown}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}