// 文件路径: app/layout.jsx (或者 .js)

"use client";

import { FilterProvider } from "@/components/FilterContext";
import "./globals.css";
import MusicPlayer from "@/components/MusicPlayer";
import { ThemeProvider } from "@/lib/theme";

// 我们不再需要 LayoutContent，可以直接在这里渲染 children
export default function Layout({ children }) {
    return (
        <html lang="en">
            <body>
                <FilterProvider>
                    <ThemeProvider>
                        {/* 这里不再需要额外的 div 包裹和背景 */}
                        {children}
                        <MusicPlayer /> {/* 始终悬浮的播放器组件 */}
                    </ThemeProvider>
                </FilterProvider>
            </body>
        </html>
    );
}