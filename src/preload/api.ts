import type { CreateProjectInput, Project, UpdateProjectInput } from '../domain/models.js';

export interface ProjectApi {
  list: () => Promise<Project[]>;
  create: (input: CreateProjectInput) => Promise<Project>;
  update: (id: string, input: UpdateProjectInput) => Promise<Project>;
  delete: (id: string) => Promise<boolean>;
}

export interface DailyReportApi {
  projects: ProjectApi;
}

declare global {
  interface Window {
    dailyReport: DailyReportApi;
  }
}
