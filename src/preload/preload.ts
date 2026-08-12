import { contextBridge, ipcRenderer } from 'electron';

import type { DailyReportApi } from './api.js';

const api: DailyReportApi = {
  projects: {
    list: () => ipcRenderer.invoke('projects:list') as ReturnType<DailyReportApi['projects']['list']>,
    create: (input) =>
      ipcRenderer.invoke('projects:create', input) as ReturnType<DailyReportApi['projects']['create']>,
    update: (id, input) =>
      ipcRenderer.invoke('projects:update', id, input) as ReturnType<DailyReportApi['projects']['update']>,
    delete: (id) =>
      ipcRenderer.invoke('projects:delete', id) as ReturnType<DailyReportApi['projects']['delete']>,
  },
};

contextBridge.exposeInMainWorld('dailyReport', api);
