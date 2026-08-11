export interface Project {
  id: string;
  name: string;
  code: string;
  color: string;
  archived: boolean;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
  code?: string;
  color?: string;
}

export type UpdateProjectInput = Partial<
  Pick<Project, 'name' | 'code' | 'color' | 'archived'>
>;

export interface WorkBlock {
  id: string;
  projectId: string;
  projectName: string;
  taskLabel: string;
  workContent: string;
  status: string;
  statusDetail: string;
  progressPercent?: number;
  startTime: string;
  endTime: string;
  note: string;
}

export interface Report {
  date: string;
  blocks: WorkBlock[];
  comment: string;
  updatedAt: string;
}

export interface ProjectsDocument {
  projects: Project[];
}
