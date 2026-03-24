import fs from "fs";
import path from "path";
import matter from "gray-matter"; // 新增导入 gray-matter

/**
 * 加载指定 projID 的所有项目文件
 * @param {string} projID - 项目 ID，例如 "project1" 或 "project2"
 * @returns {Array} - 包含文件名、标题和正文内容的项目文件数组
 */
export function getProjectByID(projID) {
  const projDir = path.join(process.cwd(), "project", projID);
  let projects = [];

  if (fs.existsSync(projDir)) {
    const files = fs
      .readdirSync(projDir)
      .filter((f) => f.endsWith(".md"));

    projects = files.map((filename) => {
      const filePath = path.join(projDir, filename);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(fileContent); // 使用 gray-matter 解析元信息

      return {
        filename: filename.replace(/\.md$/, ""), // 去掉文件扩展名
        title: data.title || filename.replace(/\.md$/, ""), // 提取 title 元信息
        content,
      };
    });
  }

  return projects;
}