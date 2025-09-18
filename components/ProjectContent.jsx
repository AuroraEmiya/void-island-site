"use client";

import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { useTheme } from "@/lib/theme";

export default function ProjectContent({ excerpt, content }) {
  const { isDarkMode } = useTheme();

  return (
    <div
      className="relative rounded shadow-lg"
      style={{
        width: "100%",
        maxWidth: "700px",
        marginTop: "40px",
        marginBottom: "40px",
        overflow: "hidden",
        border: `5px solid ${isDarkMode ? "#4a4a4a" : "#b0b0b0"}`, // 灰框深浅不同
        backgroundColor: isDarkMode
          ? "rgba(30, 30, 30, 0.8)" // 深色模式：浅黑透明
          : "rgba(245, 245, 245, 0.8)", // 浅色模式：浅灰透明
      }}
    >
      {/* 内容区域 */}
      <div
        className={`${
          isDarkMode ? "text-white" : "text-black"
        } p-6`}
      >

        <ReactMarkdown
          rehypePlugins={[rehypeRaw]}
          components={{
            h1: ({ children }) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
            h2: ({ children }) => <h2 className="text-xl font-semibold mb-3">{children}</h2>,
            h3: ({ children }) => <h3 className="text-lg font-semibold mb-2">{children}</h3>,
            h4: ({ children }) => <h4 className="text-base font-semibold mb-1.5">{children}</h4>,
            h5: ({ children }) => <h5 className="text-sm font-semibold mb-1">{children}</h5>,
            h6: ({ children }) => (
              <h6 className="text-xs font-semibold mb-1 text-gray-600 uppercase tracking-wider">
                {children}
              </h6>
            ),
            p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
            ul: ({ children }) => <ul className="list-disc ml-5 mb-3">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal ml-5 mb-3">{children}</ol>,
            li: ({ children }) => <li className="mb-1">{children}</li>,
            code: ({ children, className }) => {
              const isInline = !className;
              return isInline ? (
                <code className="bg-gray-100 text-black px-1 py-0.5 rounded text-sm font-mono">
                  {children}
                </code>
              ) : (
                <code className={className}>{children}</code>
              );
            },
            pre: ({ children }) => (
              <pre className="bg-gray-900 text-white p-4 rounded overflow-x-auto mb-4">
                {children}
              </pre>
            ),
            blockquote: ({ children }) => (
              <blockquote
                className={`border-l-4 pl-4 italic ${
                  isDarkMode ? "border-gray-600 text-gray-400" : "border-gray-300 text-gray-700"
                } mb-3`}
              >
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
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}