import MainProjectPage from "./MainProjectPage";
import { getProjectByID } from "@/lib/projects";

export default async function ProjectPage() {
  const projects = getProjectByID("Celis");

  return <MainProjectPage projects={projects} />;
}