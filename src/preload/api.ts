import type { CreateProjectInput, Project, Report, UpdateProjectInput } from '../domain/models.js';

export interface ProjectApi {
  list: () => Promise<Project[]>;
  create: (input: CreateProjectInput) => Promise<Project>;
  update: (id: string, input: UpdateProjectInput) => Promise<Project>;
  delete: (id: string) => Promise<boolean>;
}

export interface ReportApi {
  listDates: () => Promise<string[]>;
  load: (date: string) => Promise<Report | undefined>;
  save: (report: Report) => Promise<void>;
}

export interface ClipboardApi {
  writeReport: (text: string) => Promise<void>;
}

export interface DailyReportApi {
  projects: ProjectApi;
  reports: ReportApi;
  clipboard: ClipboardApi;
}

declare global {
  interface Window {
    dailyReport: DailyReportApi;
  }
}
