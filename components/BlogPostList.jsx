import { useTheme } from "@/lib/theme";

export default function BlogPostList({
	posts,
	selectedTag,
	setSelectedTag,
	setModalSlug,
	postBackground // 👈 新增参数
}) {
	const { isDarkMode } = useTheme();
	const sortedPosts = posts
	.slice()
	.sort((a, b) => {
	  const aTop = typeof a.top === 'number' ? a.top : -Infinity;
	  const bTop = typeof b.top === 'number' ? b.top : -Infinity;
  
	  if (aTop !== bTop) {
		// top 数值越大排越前
		return bTop - aTop;
	  }
	  // top 相等或者都没有，按日期倒序
	  return new Date(b.date) - new Date(a.date);
	});

	return (
		<div className="flex flex-col gap-6 max-w-3xl mx-auto relative z-2">
		{sortedPosts.map((post) => (
		  <div
			key={post.slug}
			className="p-4 border border-gray-600 rounded shadow-xl hover:shadow-2xl hover:scale-103 transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
			style={{
				background: isDarkMode ? `#1f2937` : postBackground,
			}}
			onClick={() => setModalSlug(post.slug)}
			tabIndex={0}
			role="button"
		  >
			<h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
			{post.title}
			{post.top && (
				<span
				className={`text-xs px-2 py-0.5 rounded transition-colors duration-300 ${
					isDarkMode
					? "bg-gray-600 text-white"
					: "bg-yellow-400 text-black"
				}`}
				>
				📌 置顶
				</span>
			)}
			</h3>

			<p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-200"} mb-2`}>
				{new Date(post.date).toISOString().split("T")[0]}
				{post.lastModified && (
					<span className="ml-4 italic text-sm">
						（最后编辑于 {new Date(post.lastModified).toLocaleString("zh-CN", {
							year: "numeric",
							month: "2-digit",
							day: "2-digit",
							hour: "2-digit",
							minute: "2-digit",
							second: "2-digit",
							hour12: false
						})}）
					</span>
				)}
			</p>
			<p className="text-base text-white line-clamp-3 mb-2">
				{post.excerpt}
			</p>
			<div className="flex flex-wrap gap-2 mb-2">
				{post.tags.map((kw, idx) => (
					<button
						key={idx}
						onClick={(e) => {
							e.stopPropagation();
							setSelectedTag(kw === selectedTag ? null : kw);
						}}
						className={`text-sm font-bold px-2 py-1 rounded border ${
							kw === selectedTag
								? "bg-white text-black"
								: "bg-gray-700 border-white text-white"
						} hover:bg-gray-200 transition`}
					>
						{kw}
					</button>
				))}
			</div>
		</div>
			))}
			<div className="text-center text-gray-400 text-sm mt-6">—— 到底了 ——</div>
		</div>
	);
}
