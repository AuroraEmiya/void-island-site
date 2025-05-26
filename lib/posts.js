import fs from "fs";
import path from "path";
import matter from "gray-matter";


import { execSync } from "child_process";

// vercel不记录本地文件修改时间，所以只能以git log时间作为提交时间
function getGitLastModifiedTime(filePath) {
	try {
		// Git 必须使用相对路径（相对于 repo 根目录）
		const relativePath = path.relative(process.cwd(), filePath)
		const stdout = execSync(
			`git log -1 --format="%cI" -- "${relativePath}"`,
			{ cwd: process.cwd() }
		)
		return stdout.toString().trim()
	} catch (e) {
		console.warn("获取 Git 修改时间失败，使用当前时间代替", filePath)
		return new Date().toISOString()
	}
}

/**
 * 加载指定 section 的所有 posts
 * @param {string} sectionName - 文件夹名，例如 "poetry" 或 "essay"
 * @returns {Array} - 包含 metadata 和正文内容的 posts
 */
export function getPostsBySection(sectionName) {
	const sectionDir = path.join(process.cwd(), "blog", sectionName);
	let posts = [];

	if (fs.existsSync(sectionDir)) {
		const files = fs
			.readdirSync(sectionDir)
			.filter((f) => f.endsWith(".md"));

		posts = files.map((filename) => {
			const filePath = path.join(sectionDir, filename);
			const fileContent = fs.readFileSync(filePath, "utf-8");
			const { data, content } = matter(fileContent);

			// 获取文件的最后修改时间
			const stats = fs.statSync(filePath);
			const lastModified = getGitLastModifiedTime(filePath);

			let dateStr = data.date
				? String(data.date)
				: filename.split("-").slice(0, 3).join("-");

			return {
				title: data.title || filename.replace(/\.md$/, ""),
				excerpt: data.excerpt,
				date: dateStr,
				slug: filename.replace(/\.md$/, ""),
				tags: data.tags || [],
				section: sectionName,
				lastModified,
				top: data.top, // ✅ 新增：处理 top 字段
				content,
			};
		});
	}

	return posts;
}
