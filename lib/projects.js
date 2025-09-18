import fs from "fs";
import path from "path";

/**
 * 加载指定 projID 的所有项目文件
 * @param {string} projID - 项目 ID，例如 "project1" 或 "project2"
 * @returns {Array} - 包含文件名和正文内容的项目文件数组
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

      return {
        filename: filename.replace(/\.md$/, ""), // 去掉文件扩展名
        content: fileContent,
      };
    });
  }

  return projects;
}