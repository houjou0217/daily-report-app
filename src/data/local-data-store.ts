import { randomUUID } from 'node:crypto';

import {
  DataReadError,
  DataValidationError,
  EntityNotFoundError,
} from '../domain/errors.js';
import type {
  CreateProjectInput,
  Project,
  ProjectsDocument,
  Report,
  UpdateProjectInput,
} from '../domain/models.js';
import {
  assertProject,
  assertProjectsDocument,
  assertReport,
  assertReportDate,
} from '../domain/validation.js';
import { JsonFileStore, type FileSystem } from './json-file-store.js';

const PROJECTS_FILE = 'projects.json';
const REPORTS_DIRECTORY = 'reports';
const PROJECT_COLORS = ['#2f746d', '#3267b8', '#8c5f27', '#7f4a8e'] as const;

const reportFileName = (date: string): string => `${REPORTS_DIRECTORY}/${date}.json`;

export class LocalDataStore {
  private readonly files: JsonFileStore;

  public constructor(rootDirectory: string, fileSystem?: FileSystem) {
    this.files = new JsonFileStore(rootDirectory, fileSystem);
  }

  public async listProjects(): Promise<Project[]> {
    const document = await this.readProjectsDocument();
    return document.projects.map((project) => ({ ...project }));
  }

  public async getProject(id: string): Promise<Project | undefined> {
    const document = await this.readProjectsDocument();
    const project = document.projects.find((candidate) => candidate.id === id);
    return project === undefined ? undefined : { ...project };
  }

  public async createProject(input: CreateProjectInput): Promise<Project> {
    const document = await this.readProjectsDocument();
    const color = input.color ?? PROJECT_COLORS[document.projects.length % PROJECT_COLORS.length] ?? '#2f746d';
    const project: Project = {
      id: `proj-${randomUUID()}`,
      name: input.name.trim(),
      code: input.code?.trim() ?? '',
      color,
      archived: false,
      createdAt: new Date().toISOString(),
    };

    assertProject(project);
    document.projects.push(project);
    await this.files.write(PROJECTS_FILE, document);
    return { ...project };
  }

  public async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    const document = await this.readProjectsDocument();
    const index = document.projects.findIndex((project) => project.id === id);
    const existing = document.projects[index];

    if (index === -1 || existing === undefined) {
      throw new EntityNotFoundError('Project was not found.');
    }

    const project: Project = {
      ...existing,
      ...input,
      name: input.name === undefined ? existing.name : input.name.trim(),
      code: input.code === undefined ? existing.code : input.code.trim(),
      id: existing.id,
      createdAt: existing.createdAt,
    };

    assertProject(project);
    document.projects[index] = project;
    await this.files.write(PROJECTS_FILE, document);
    return { ...project };
  }

  public async deleteProject(id: string): Promise<boolean> {
    const document = await this.readProjectsDocument();
    const remainingProjects = document.projects.filter((project) => project.id !== id);

    if (remainingProjects.length === document.projects.length) {
      return false;
    }

    await this.files.write(PROJECTS_FILE, { projects: remainingProjects });
    return true;
  }

  public async saveReport(report: Report): Promise<void> {
    assertReport(report);
    await this.files.write(reportFileName(report.date), report);
  }

  public async loadReport(date: string): Promise<Report | undefined> {
    assertReportDate(date);
    const report = await this.files.read<unknown>(reportFileName(date));

    if (report === undefined) {
      return undefined;
    }

    try {
      assertReport(report);
      return structuredClone(report);
    } catch (error) {
      if (error instanceof DataValidationError) {
        throw new DataReadError('Local report data is invalid.', { cause: error });
      }
      throw error;
    }
  }

  public async deleteReport(date: string): Promise<boolean> {
    assertReportDate(date);
    return this.files.remove(reportFileName(date));
  }

  public async listReportDates(): Promise<string[]> {
    const fileNames = await this.files.list(REPORTS_DIRECTORY);
    return fileNames
      .filter((fileName) => /^\d{4}-\d{2}-\d{2}\.json$/u.test(fileName))
      .map((fileName) => fileName.slice(0, -'.json'.length))
      .filter((date) => {
        try {
          assertReportDate(date);
          return true;
        } catch {
          return false;
        }
      })
      .sort((left, right) => right.localeCompare(left));
  }

  private async readProjectsDocument(): Promise<ProjectsDocument> {
    const document = await this.files.read<unknown>(PROJECTS_FILE);

    if (document === undefined) {
      return { projects: [] };
    }

    try {
      assertProjectsDocument(document);
      return document;
    } catch (error) {
      if (error instanceof DataValidationError) {
        throw new DataReadError('Local project data is invalid.', { cause: error });
      }
      throw error;
    }
  }
}
