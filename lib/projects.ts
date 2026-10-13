import { randomUUID } from "node:crypto";
import { sqlClient } from "./db";
import type { ProjectInput } from "./project-input";
import type { Timestamp } from "./format";
export type SavedProject = ProjectInput & { id: string; updated_at: Timestamp };
export async function listProjects(userId: string): Promise<SavedProject[]> {
  return await sqlClient()`select id, title, goal, requirements, updated_at from user_projects where user_id = ${userId} order by updated_at desc limit 100` as SavedProject[];
}
export async function saveProject(userId: string, project: ProjectInput): Promise<string | null> {
  const sql = sqlClient();
  // Serialize account writes so concurrent requests cannot exceed the 100-project cap.
  const result = await sql.transaction([
    sql`select id from app_users where id = ${userId} for update`,
    sql`insert into user_projects (id, user_id, title, goal, requirements)
      select ${randomUUID()}, ${userId}, ${project.title}, ${project.goal}, ${JSON.stringify(project.requirements)}::jsonb
      where (select count(*) from user_projects where user_id = ${userId}) < 100 returning id`,
  ]);
  return result[1][0]?.id ?? null;
}
export async function deleteProject(userId: string, id: string): Promise<boolean> {
  const rows = await sqlClient()`delete from user_projects where id = ${id} and user_id = ${userId} returning id`;
  return rows.length > 0;
}
