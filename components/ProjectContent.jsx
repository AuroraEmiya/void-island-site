"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { useTheme } from "@/lib/theme";

// 1. 数据转换函数：将扁平的标题数组转换成树状结构
function buildTree(headings) {
  // 我们只处理 h2 及以下的标题
  const relevantHeadings = headings.filter(h => h.level > 1);
  if (relevantHeadings.length === 0) return [];

  const root = { children: [] };
  const stack = [{ ...root, level: 1 }]; // 把 h1 当作虚拟的第 1 级

  for (const heading of relevantHeadings) {
    let parent = stack[stack.length - 1];
    while (heading.level <= parent.level) {
      stack.pop();
      parent = stack[stack.length - 1];
    }

    const node = { ...heading, children: [] };
    parent.children.push(node);
    stack.push(node);
  }

  return root.children;
}

// 2. 递归组件：用于渲染树状结构的每一个节点
const TocNode = ({ node, isLast, parentPrefix = "" }) => {
  const { isDarkMode } = useTheme();
  
  // 计算当前节点的前缀（└─ 或 ├─）
  const currentPrefix = isLast ? "└─" : "├─";
  const fullPrefix = `${parentPrefix}${currentPrefix}`;

  // 计算传递给下一层子节点的父级前缀（│   或    ）
  const childParentPrefix = `${parentPrefix}${isLast ? "    " : "│   "}`;

  return (
    <li>
      <a
        href={`#${node.id}`}
        className={`transition-colors duration-200 ${isDarkMode ? "text-gray-300 hover:text-white" : "text-gray-800 hover:text-black"}`}
        style={{ fontWeight: 500,textShadow: isDarkMode ? 'none' : '1px 1px 3px rgba(0,0,0,0.15)'}}
        
      >
        {/* 将前缀和标题文本放在一行，并用等宽字体保证对齐 */}
        <span className="prefix" style={{ whiteSpace: 'pre' }}>{fullPrefix}</span>
        {node.text}
      </a>
      {/* 如果有子节点，则递归渲染 */}
      {node.children && node.children.length > 0 && (
        <ul className="toc-list">
          {node.children.map((child, index) => (
            <TocNode
              key={`${child.id}-${index}`}
              node={child}
              isLast={index === node.children.length - 1}
              parentPrefix={childParentPrefix}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

// 3. 主目录组件
const TableOfContents = ({ headings }) => {
  const { isDarkMode } = useTheme();
  
  // 筛选出一级标题和其它标题
  const h1Headings = headings.filter(h => h.level === 1);
  const otherHeadings = headings.filter(h => h.level > 1);
  const headingTree = buildTree(otherHeadings);

  return (
    <nav className="hidden md:block w-64 pr-8 text-sm sticky top-10  sticky self-start"
      style={{ width: '70rem' }}
    >
      <h3 className={`font-bold mb-4 text-lg ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
        目录
      </h3>
      <ul className="toc-list">
        {/* 先渲染所有一级标题 */}
        {h1Headings.map(h1 => (
          <li key={h1.id}>
            <a href={`#${h1.id}`} className={`font-bold transition-colors duration-200 ${isDarkMode ? "text-gray-200 hover:text-white" : "text-gray-800 hover:text-black"}`}>{h1.text}</a>
          </li>
        ))}
        {/* 然后渲染由 h2 及以下组成的树 */}
          <ul className="toc-list">
          {headingTree.map((node, index) => (
            <TocNode
              key={`${node.id}-${index}`} // <--- 在这里添加 index
              node={node}
              isLast={index === headingTree.length - 1}
            />
          ))}
        </ul>
      </ul>
      <style jsx>{`
        .toc-list {
          list-style: none;
          padding-left: 0;
        }
        .toc-list li {
          padding-top: 0.125rem;
          padding-bottom: 0.125rem;
        }
        .prefix {
          font-family: monospace;
          color: ${isDarkMode ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)"};
          margin-right: 0.5rem;
        }
      `}</style>
    </nav>
  );
};


// Main ProjectContent component (no changes here from last time)
export default function ProjectContent({ content }) {
  const { isDarkMode } = useTheme();
  const [headings, setHeadings] = useState([]);

  useEffect(() => {
    if (!content) return;
    const headingRegex = /^(#{1,4})\s+(.*)/gm;
    const matches = Array.from(content.matchAll(headingRegex));
    const extractedHeadings = matches
      .map(match => {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]+/gu, '');
        return { level, text, id };
      })
      .filter(heading => heading.text);
    setHeadings(extractedHeadings);
  }, [content]);

  const headingComponents = {
    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-4" {...props}></h1>,
    h2: ({ node, ...props }) => <h2 className="text-xl font-semibold mb-3" {...props}></h2>,
    h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mb-2" {...props}></h3>,
    h4: ({ node, ...props }) => <h4 className="text-base font-semibold mb-1.5" {...props}></h4>,
    p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="list-disc ml-5 mb-3">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal ml-5 mb-3">{children}</ol>,
    li: ({ children }) => <li className="mb-1">{children}</li>,
    pre: ({ children }) => (<pre className="bg-gray-900 text-white p-4 rounded overflow-x-auto mb-4">{children}</pre>),
    a: ({ href, children }) => (<a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{children}</a>),
  };

  return (
    <div className="flex w-full max-w-6xl px-4 py-8">
      {headings.length > 0 && <TableOfContents headings={headings} />}
      <div
        className="flex-grow markdown-body min-w-0"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div
          className="relative rounded shadow-lg"
          style={{
            width: "100%",
            border: `5px solid ${isDarkMode ? "#4a4a4a" : "#b0b0b0"}`,
            backgroundColor: isDarkMode ? "rgba(30, 30, 30, 0.3)" : "rgba(245, 245, 245, 0.3)",
          }}
        >
          <div className={`${isDarkMode ? "text-white" : "text-black"} p-6`}>
            <ReactMarkdown
              rehypePlugins={[rehypeRaw, rehypeSlug]}
              components={headingComponents}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}