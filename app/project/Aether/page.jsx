import AetherClient from "./AetherClient";
// 假设你的 lib 目录下有读取项目信息的逻辑
import { getProjectByID } from "@/lib/projects"; 

export default async function AetherPage() {
  // 获取 Aether 项目的配置或描述信息
  const projects = getProjectByID("Aether") || [];

  return <AetherClient projects={projects} />;
}