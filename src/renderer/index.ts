import type { CreateProjectInput, Project, Report, UpdateProjectInput, WorkBlock } from '../domain/models.js';
import { formatReport, validateReportForPreview } from '../domain/report-formatter.js';
import {
  calculateDuration,
  isEndTimeBeforeStartTime,
  sortWorkBlocksByStartTime,
} from '../domain/time.js';
import type {} from '../preload/api.js';

const getElement = <ElementType extends HTMLElement>(selector: string): ElementType => {
  const element = document.querySelector<ElementType>(selector);
  if (element === null) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element;
};

const addBlockButton = getElement<HTMLButtonElement>('#add-block');
const archiveToggle = getElement<HTMLButtonElement>('#archive-toggle');
const blockList = getElement<HTMLDivElement>('#block-list');
const commentInput = getElement<HTMLTextAreaElement>('#report-comment');
const copyFeedback = getElement<HTMLParagraphElement>('#copy-feedback');
const copyReportButton = getElement<HTMLButtonElement>('#copy-report');
const dateInput = getElement<HTMLInputElement>('#report-date');
const emptyState = getElement<HTMLParagraphElement>('#empty-state');
const projectNotice = getElement<HTMLParagraphElement>('#project-notice');
const historyList = getElement<HTMLDivElement>('#history-list');
const historyPanel = getElement<HTMLElement>('#history-panel');
const historyStatus = getElement<HTMLParagraphElement>('#history-status');
const projectCount = getElement<HTMLParagraphElement>('#project-count');
const projectEmptyState = getElement<HTMLParagraphElement>('#project-empty-state');
const projectForm = getElement<HTMLFormElement>('#project-form');
const projectFormCancel = getElement<HTMLButtonElement>('#form-cancel');
const projectFormMessage = getElement<HTMLParagraphElement>('#form-message');
const projectFormTitle = getElement<HTMLHeadingElement>('#form-title');
const projectIdInput = getElement<HTMLInputElement>('#project-id');
const projectNameInput = getElement<HTMLInputElement>('#project-name');
const projectCodeInput = getElement<HTMLInputElement>('#project-code');
const projectColorInput = getElement<HTMLInputElement>('#project-color');
const projectList = getElement<HTMLDivElement>('#project-list');
const projectPanel = getElement<HTMLElement>('#project-panel');
const projectSubmitButton = getElement<HTMLButtonElement>('#form-submit');
const showProjectFormButton = getElement<HTMLButtonElement>('#show-project-form');
const navProjectsButton = getElement<HTMLButtonElement>('#nav-projects');
const navPreviewButton = getElement<HTMLButtonElement>('#nav-preview');
const navReportButton = getElement<HTMLButtonElement>('#nav-report');
const navHistoryButton = getElement<HTMLButtonElement>('#nav-history');
const previewButton = getElement<HTMLButtonElement>('#show-preview');
const previewPanel = getElement<HTMLElement>('#preview-panel');
const previewProjectLegend = getElement<HTMLDivElement>('#preview-project-legend');
const previewText = getElement<HTMLPreElement>('#preview-text');
const reportPanel = getElement<HTMLElement>('.report-panel');
const reportWeekday = getElement<HTMLSpanElement>('#report-weekday');
const returnToInputButton = getElement<HTMLButtonElement>('#return-to-input');
const returnFromHistoryButton = getElement<HTMLButtonElement>('#return-from-history');
const showHistoryButton = getElement<HTMLButtonElement>('#show-history');
const status = getElement<HTMLParagraphElement>('#app-status');
const taskLabelOptions = getElement<HTMLDataListElement>('#task-label-options');

let activeProjects: Project[] = [];
let projects: Project[] = [];
let report: Report;
let saveTimer: number | undefined;
let loading = false;
let previewIssues = new Map<string, string[]>();
let showArchivedProjects = false;
let projectColorWasChanged = false;
let expandedBlockIds = new Set<string>();

type AppScreen = 'history' | 'preview' | 'projects' | 'report';

const dateToInputValue = (date: Date): string => {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
};

const createEmptyReport = (date: string): Report => ({
  date,
  blocks: [],
  comment: '',
  updatedAt: new Date().toISOString(),
});

const formatWeekday = (date: string): string => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? ''
    : new Intl.DateTimeFormat('ja-JP', { weekday: 'long' }).format(parsed);
};

const updateReportWeekday = (date: string): void => {
  reportWeekday.textContent = formatWeekday(date);
};

const getProjectColor = (projectId: string): string =>
  projects.find((project) => project.id === projectId)?.color ?? '#2f746d';

const renderPreviewProjectLegend = (): void => {
  previewProjectLegend.replaceChildren();
  const projectIds = new Set<string>();
  for (const block of report.blocks) {
    if (projectIds.has(block.projectId)) {
      continue;
    }
    projectIds.add(block.projectId);
    const tag = document.createElement('span');
    tag.className = 'project-tag';
    tag.style.setProperty('--project-color', getProjectColor(block.projectId));
    const dot = document.createElement('span');
    dot.className = 'project-dot';
    dot.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.textContent = block.projectName;
    tag.append(dot, name);
    previewProjectLegend.append(tag);
  }
};

const setActiveScreen = (activeScreen: AppScreen): void => {
  const navigation: ReadonlyArray<readonly [AppScreen, HTMLButtonElement]> = [
    ['report', navReportButton],
    ['projects', navProjectsButton],
    ['preview', navPreviewButton],
    ['history', navHistoryButton],
  ];
  for (const [screen, button] of navigation) {
    const isActive = screen === activeScreen;
    button.classList.toggle('is-active', isActive);
    button.toggleAttribute('aria-current', isActive);
  }
};

const createWorkBlock = (project: Project): WorkBlock => ({
  id: crypto.randomUUID(),
  projectId: project.id,
  projectName: project.name,
  taskLabel: '',
  workContent: '',
  status: '進行中',
  statusDetail: '',
  startTime: '',
  endTime: '',
  note: '',
});

const setStatus = (message: string): void => {
  status.textContent = message;
};

const setCopyFeedback = (message: string | undefined, isError = false): void => {
  copyFeedback.hidden = message === undefined;
  copyFeedback.textContent = message ?? '';
  copyFeedback.classList.toggle('copy-error', isError);
};

const showInput = (): void => {
  previewPanel.hidden = true;
  historyPanel.hidden = true;
  projectPanel.hidden = true;
  reportPanel.hidden = false;
  setActiveScreen('report');
  setCopyFeedback(undefined);
  previewButton.focus();
};

const formatHistoryDate = (date: string): string => {
  const [year, month, day] = date.split('-');
  return `${year}年${month}月${day}日`;
};

const showHistory = async (): Promise<void> => {
  if (saveTimer !== undefined) {
    window.clearTimeout(saveTimer);
    saveTimer = undefined;
    await saveReport(structuredClone(report));
  }
  reportPanel.hidden = true;
  previewPanel.hidden = true;
  historyPanel.hidden = false;
  setActiveScreen('history');
  historyList.replaceChildren();
  historyStatus.textContent = '読み込み中…';
  try {
    const dates = await window.dailyReport.reports.listDates();
    if (dates.length === 0) {
      historyStatus.textContent = '保存済みの日報はありません。';
      return;
    }
    historyStatus.textContent = `${dates.length}件の日報`;
    for (const date of dates) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'history-item';
      const dateLabel = document.createElement('span');
      dateLabel.className = 'history-date';
      dateLabel.textContent = formatHistoryDate(date);
      const tags = document.createElement('span');
      tags.className = 'history-tags';
      try {
        const savedReport = await window.dailyReport.reports.load(date);
        const projectIds = new Set<string>();
        for (const block of savedReport?.blocks ?? []) {
          if (projectIds.has(block.projectId)) {
            continue;
          }
          projectIds.add(block.projectId);
          const tag = document.createElement('span');
          tag.className = 'project-tag';
          tag.style.setProperty('--project-color', getProjectColor(block.projectId));
          tag.textContent = block.projectName;
          tags.append(tag);
        }
      } catch {
        // The date remains selectable even when its summary cannot be read.
      }
      const arrow = document.createElement('span');
      arrow.className = 'history-arrow';
      arrow.textContent = '›';
      arrow.setAttribute('aria-hidden', 'true');
      button.append(dateLabel, tags, arrow);
      button.addEventListener('click', async () => {
        dateInput.value = date;
        await loadReport(date);
        showInput();
        setStatus('過去の日報を読み込みました');
      });
      historyList.append(button);
    }
  } catch {
    historyStatus.textContent = '過去日報一覧を読み込めませんでした。';
  }
};

const setProjectFormMessage = (message: string | undefined): void => {
  projectFormMessage.hidden = message === undefined;
  projectFormMessage.textContent = message ?? '';
};

const setProjectBusy = (busy: boolean): void => {
  projectSubmitButton.disabled = busy;
  archiveToggle.disabled = busy;
};

const resetProjectForm = (): void => {
  projectForm.reset();
  projectIdInput.value = '';
  projectColorInput.value = '#2f746d';
  projectColorWasChanged = false;
  projectFormTitle.textContent = '新規案件を登録';
  projectSubmitButton.textContent = '登録する';
  projectFormCancel.hidden = true;
  setProjectFormMessage(undefined);
  projectForm.hidden = true;
  showProjectFormButton.hidden = false;
};

const showNewProjectForm = (): void => {
  projectForm.hidden = false;
  showProjectFormButton.hidden = true;
  projectFormTitle.textContent = '新規案件を登録';
  projectSubmitButton.textContent = '登録する';
  projectNameInput.focus();
};

const startProjectEditing = (project: Project): void => {
  projectIdInput.value = project.id;
  projectNameInput.value = project.name;
  projectCodeInput.value = project.code;
  projectColorInput.value = project.color;
  projectColorWasChanged = true;
  projectFormTitle.textContent = '案件を編集';
  projectSubmitButton.textContent = '変更を保存';
  projectFormCancel.hidden = false;
  setProjectFormMessage(undefined);
  projectForm.hidden = false;
  showProjectFormButton.hidden = true;
  projectNameInput.focus();
};

const formatProjectDate = (dateTime: string): string => {
  const date = new Date(dateTime);
  return Number.isNaN(date.getTime())
    ? '登録日: 不明'
    : `登録日: ${new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' }).format(date)}`;
};

const renderProjects = (): void => {
  const visibleProjects = projects.filter((project) => project.archived === showArchivedProjects);
  projectList.replaceChildren();
  projectEmptyState.hidden = visibleProjects.length > 0;
  projectCount.textContent = showArchivedProjects
    ? `アーカイブ済み ${visibleProjects.length}件`
    : `利用中 ${visibleProjects.length}件`;
  archiveToggle.textContent = showArchivedProjects ? '利用中の案件を表示' : 'アーカイブを表示';
  archiveToggle.setAttribute('aria-pressed', String(showArchivedProjects));

  for (const project of visibleProjects) {
    const row = document.createElement('article');
    row.className = 'project-row';
    const details = document.createElement('div');
    details.className = 'project-details';
    const colorBar = document.createElement('span');
    colorBar.className = 'project-color';
    colorBar.style.backgroundColor = project.color;
    colorBar.setAttribute('aria-hidden', 'true');
    const name = document.createElement('h3');
    name.textContent = project.name;
    const meta = document.createElement('p');
    meta.textContent = [project.code, formatProjectDate(project.createdAt)].filter(Boolean).join(' ・ ');
    details.append(colorBar, name, meta);

    const actions = document.createElement('div');
    actions.className = 'project-actions';
    const addAction = (label: string, onClick: () => void): void => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'icon-button';
      button.textContent = label;
      button.addEventListener('click', onClick);
      actions.append(button);
    };
    addAction('編集', () => startProjectEditing(project));
    addAction(project.archived ? '復元' : '保管', () => {
      void saveProjectChange(project, { archived: !project.archived });
    });
    addAction('削除', () => {
      if (window.confirm(`「${project.name}」を削除しますか？`)) {
        void deleteProject(project);
      }
    });
    row.append(details, actions);
    projectList.append(row);
  }
};

const refreshProjects = async (): Promise<void> => {
  setProjectBusy(true);
  try {
    projects = await window.dailyReport.projects.list();
    activeProjects = projects.filter((project) => !project.archived);
    renderProjects();
    renderBlocks();
  } catch {
    setStatus('案件一覧を読み込めませんでした');
  } finally {
    setProjectBusy(false);
  }
};

const saveProjectChange = async (project: Project, input: UpdateProjectInput): Promise<void> => {
  setProjectBusy(true);
  try {
    await window.dailyReport.projects.update(project.id, input);
    setStatus(project.archived ? '案件を復元しました' : '案件をアーカイブしました');
    await refreshProjects();
  } catch {
    setProjectFormMessage('案件を保存できませんでした。入力内容を確認してください。');
  } finally {
    setProjectBusy(false);
  }
};

const deleteProject = async (project: Project): Promise<void> => {
  setProjectBusy(true);
  try {
    await window.dailyReport.projects.delete(project.id);
    if (projectIdInput.value === project.id) {
      resetProjectForm();
    }
    setStatus('案件を削除しました');
    await refreshProjects();
  } catch {
    setProjectFormMessage('案件を削除できませんでした。');
  } finally {
    setProjectBusy(false);
  }
};

const showProjectManagement = async (): Promise<void> => {
  reportPanel.hidden = true;
  previewPanel.hidden = true;
  historyPanel.hidden = true;
  projectPanel.hidden = false;
  setActiveScreen('projects');
  await refreshProjects();
};

const showPreview = (): void => {
  const issues = validateReportForPreview(report);
  previewIssues = new Map();
  for (const issue of issues) {
    const messages = previewIssues.get(issue.blockId) ?? [];
    messages.push(issue.message);
    previewIssues.set(issue.blockId, messages);
  }
  if (issues.length > 0) {
    for (const issue of issues) {
      expandedBlockIds.add(issue.blockId);
    }
    renderBlocks();
    setStatus('必須項目または時刻を確認してください。');
    document.querySelector<HTMLElement>('.block-validation')?.focus();
    return;
  }

  previewText.textContent = formatReport(report);
  renderPreviewProjectLegend();
  setCopyFeedback(undefined);
  reportPanel.hidden = true;
  previewPanel.hidden = false;
  setActiveScreen('preview');
  previewText.focus();
};

const scheduleSave = (): void => {
  if (loading) {
    return;
  }
  if (saveTimer !== undefined) {
    window.clearTimeout(saveTimer);
  }
  const reportToSave = structuredClone(report);
  setStatus('保存中…');
  saveTimer = window.setTimeout(() => {
    void saveReport(reportToSave);
  }, 400);
};

const saveReport = async (reportToSave: Report = report): Promise<void> => {
  saveTimer = undefined;
  reportToSave.updatedAt = new Date().toISOString();
  try {
    await window.dailyReport.reports.save(reportToSave);
    setStatus('ローカルに保存しました');
  } catch {
    setStatus('保存できませんでした。保存先の権限を確認してください。');
  }
};

const updateBlock = (id: string, change: Partial<WorkBlock>, rerender = false): void => {
  const block = report.blocks.find((candidate) => candidate.id === id);
  if (block === undefined) {
    return;
  }
  Object.assign(block, change);
  previewIssues.delete(id);
  if (rerender) {
    report.blocks = sortWorkBlocksByStartTime(report.blocks);
    renderBlocks();
  }
  scheduleSave();
};

const createTimeSelect = (options: readonly string[], value: string): HTMLSelectElement => {
  const select = document.createElement('select');
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '--';
  emptyOption.selected = value.length === 0;
  select.append(emptyOption);
  for (const optionValue of options) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    option.selected = optionValue === value;
    select.append(option);
  }
  return select;
};

const addTimeField = (
  body: HTMLElement,
  labelText: string,
  time: string,
  onChange: (nextTime: string) => void,
): void => {
  const [initialHour = '', initialMinute = ''] = time.split(':');
  const label = document.createElement('label');
  label.className = 'block-field time-field';
  const caption = document.createElement('span');
  caption.textContent = labelText;
  const selects = document.createElement('div');
  selects.className = 'time-selects';
  const hourSelect = createTimeSelect(
    Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')),
    initialHour,
  );
  const separator = document.createElement('span');
  separator.textContent = ':';
  separator.setAttribute('aria-hidden', 'true');
  const minuteSelect = createTimeSelect(
    Array.from({ length: 12 }, (_, minute) => String(minute * 5).padStart(2, '0')),
    initialMinute,
  );
  const updateTime = (): void => {
    onChange(
      hourSelect.value.length === 0 || minuteSelect.value.length === 0
        ? ''
        : `${hourSelect.value}:${minuteSelect.value}`,
    );
  };
  hourSelect.addEventListener('change', updateTime);
  minuteSelect.addEventListener('change', updateTime);
  selects.append(hourSelect, separator, minuteSelect);
  label.append(caption, selects);
  body.append(label);
};

const addTextField = (
  body: HTMLElement,
  labelText: string,
  value: string,
  placeholder: string,
  onInput: (nextValue: string) => void,
  listId?: string,
): void => {
  const label = document.createElement('label');
  label.className = 'block-field';
  const caption = document.createElement('span');
  caption.textContent = labelText;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.placeholder = placeholder;
  input.maxLength = 500;
  if (listId !== undefined) {
    input.setAttribute('list', listId);
  }
  input.addEventListener('input', () => onInput(input.value));
  label.append(caption, input);
  body.append(label);
};

const addTextArea = (
  body: HTMLElement,
  labelText: string,
  value: string,
  placeholder: string,
  onInput: (nextValue: string) => void,
): void => {
  const label = document.createElement('label');
  label.className = 'block-field block-field-wide';
  const caption = document.createElement('span');
  caption.textContent = labelText;
  const input = document.createElement('textarea');
  input.rows = 3;
  input.value = value;
  input.placeholder = placeholder;
  input.maxLength = 2000;
  input.addEventListener('input', () => onInput(input.value));
  label.append(caption, input);
  body.append(label);
};

const renderBlocks = (): void => {
  blockList.replaceChildren();
  taskLabelOptions.replaceChildren();
  for (const label of new Set(report.blocks.map((block) => block.taskLabel.trim()).filter(Boolean))) {
    const option = document.createElement('option');
    option.value = label;
    taskLabelOptions.append(option);
  }
  emptyState.hidden = report.blocks.length > 0;
  addBlockButton.disabled = activeProjects.length === 0;
  projectNotice.hidden = activeProjects.length > 0;

  for (const [index, block] of report.blocks.entries()) {
    const card = document.createElement('article');
    card.className = 'block-card';
    card.style.setProperty('--project-color', getProjectColor(block.projectId));

    const issues = previewIssues.get(block.id);
    if (issues !== undefined) {
      card.classList.add('block-card-invalid');
    }

    const header = document.createElement('header');
    header.className = 'block-header';
    const time = document.createElement('span');
    time.className = 'block-time';
    time.textContent = block.startTime.length === 0
      ? `ブロック ${index + 1}`
      : `${block.startTime}–${block.endTime || '--:--'}`;
    const projectDot = document.createElement('span');
    projectDot.className = 'project-dot';
    projectDot.setAttribute('aria-hidden', 'true');
    const projectName = document.createElement('h3');
    projectName.className = 'block-project-name';
    projectName.textContent = block.projectName;
    const taskLabel = document.createElement('span');
    taskLabel.className = 'task-label';
    taskLabel.hidden = block.taskLabel.trim().length === 0;
    taskLabel.textContent = block.taskLabel;
    const statusBadge = document.createElement('span');
    statusBadge.className = 'block-status';
    statusBadge.classList.toggle('is-complete', block.status === '完了');
    statusBadge.classList.toggle('is-on-hold', block.status === '保留');
    statusBadge.textContent = block.status;
    const actions = document.createElement('div');
    actions.className = 'block-actions';
    const isExpanded = expandedBlockIds.has(block.id) || issues !== undefined || block.workContent.trim().length === 0;

    const moveBlock = (offset: number): void => {
      const nextIndex = index + offset;
      if (nextIndex < 0 || nextIndex >= report.blocks.length) {
        return;
      }
      const nextBlock = report.blocks[nextIndex];
      if (nextBlock === undefined) {
        return;
      }
      report.blocks[index] = nextBlock;
      report.blocks[nextIndex] = block;
      renderBlocks();
      scheduleSave();
    };

    const createAction = (label: string, onClick: () => void, disabled = false): HTMLButtonElement => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'icon-button';
      button.textContent = label;
      button.disabled = disabled;
      button.addEventListener('click', onClick);
      return button;
    };
    actions.append(
      createAction(isExpanded ? '閉じる' : '編集', () => {
        if (isExpanded) {
          expandedBlockIds.delete(block.id);
        } else {
          expandedBlockIds.add(block.id);
        }
        renderBlocks();
      }),
      createAction('▲', () => moveBlock(-1), index === 0),
      createAction('▼', () => moveBlock(1), index === report.blocks.length - 1),
      createAction('削除', () => {
        report.blocks = report.blocks.filter((candidate) => candidate.id !== block.id);
        expandedBlockIds.delete(block.id);
        renderBlocks();
        scheduleSave();
      }),
    );
    header.append(time, projectDot, projectName, taskLabel, statusBadge, actions);

    if (!isExpanded) {
      const summary = document.createElement('div');
      summary.className = 'block-summary';
      const content = document.createElement('p');
      content.textContent = block.workContent.trim().length === 0 ? '作業内容は未入力です。' : block.workContent;
      summary.append(content);
      if (block.progressPercent !== undefined) {
        const progressVisual = document.createElement('div');
        progressVisual.className = 'progress-visual block-summary-progress';
        const progressBar = document.createElement('span');
        progressBar.className = 'progress-bar';
        progressBar.setAttribute('role', 'progressbar');
        progressBar.setAttribute('aria-label', '進捗率');
        progressBar.setAttribute('aria-valuemin', '0');
        progressBar.setAttribute('aria-valuemax', '100');
        progressBar.setAttribute('aria-valuenow', String(block.progressPercent));
        const progressFill = document.createElement('span');
        progressFill.className = 'progress-fill';
        progressFill.style.width = `${block.progressPercent}%`;
        const progressValue = document.createElement('span');
        progressValue.className = 'progress-value';
        progressValue.textContent = `${block.progressPercent}%`;
        progressBar.append(progressFill);
        progressVisual.append(progressBar, progressValue);
        summary.append(progressVisual);
      }
      card.append(header, summary);
      blockList.append(card);
      continue;
    }

    const body = document.createElement('div');
    body.className = 'block-body';
    if (issues !== undefined) {
      const validation = document.createElement('p');
      validation.className = 'block-validation block-field-wide';
      validation.tabIndex = -1;
      validation.textContent = issues.join(' ');
      body.append(validation);
    }
    const projectField = document.createElement('label');
    projectField.className = 'block-field block-field-wide project-field';
    const projectCaption = document.createElement('span');
    projectCaption.textContent = '対象案件';
    const projectChoices = document.createElement('div');
    projectChoices.className = 'project-choices';
    projectChoices.setAttribute('role', 'group');
    projectChoices.setAttribute('aria-label', '案件を選択');
    for (const project of activeProjects) {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'project-choice';
      choice.classList.toggle('is-selected', project.id === block.projectId);
      choice.style.setProperty('--project-color', project.color);
      choice.setAttribute('aria-pressed', String(project.id === block.projectId));
      const dot = document.createElement('span');
      dot.className = 'project-dot';
      dot.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.textContent = project.name;
      choice.append(dot, name);
      choice.addEventListener('click', () => {
        if (project.id !== block.projectId) {
          updateBlock(block.id, { projectId: project.id, projectName: project.name }, true);
        }
      });
      projectChoices.append(choice);
    }
    projectField.append(projectCaption, projectChoices);
    body.append(projectField);

    addTextField(
      body,
      '業務種別',
      block.taskLabel,
      '例: MTG',
      (taskLabel) => updateBlock(block.id, { taskLabel }),
      'task-label-options',
    );
    addTextArea(body, '作業内容', block.workContent, '作業内容を入力', (workContent) =>
      updateBlock(block.id, { workContent }),
    );

    addTimeField(body, '開始時刻', block.startTime, (startTime) =>
      updateBlock(block.id, { startTime }, true),
    );
    addTimeField(body, '終了時刻', block.endTime, (endTime) => updateBlock(block.id, { endTime }, true));

    const timeFeedback = document.createElement('p');
    timeFeedback.className = 'time-feedback block-field-wide';
    if (isEndTimeBeforeStartTime(block.startTime, block.endTime)) {
      timeFeedback.classList.add('time-error');
      timeFeedback.textContent = '終了時刻は開始時刻以降に設定してください。';
    } else {
      const duration = calculateDuration(block.startTime, block.endTime);
      timeFeedback.textContent = duration === undefined
        ? '開始・終了時刻を選ぶと所要時間を表示します。'
        : `所要時間：${duration}`;
    }
    body.append(timeFeedback);

    const statusField = document.createElement('label');
    statusField.className = 'block-field';
    const statusCaption = document.createElement('span');
    statusCaption.textContent = '進捗状況';
    const statusChoices = document.createElement('div');
    statusChoices.className = 'status-choices';
    statusChoices.setAttribute('role', 'group');
    statusChoices.setAttribute('aria-label', '進捗状況');
    for (const value of ['進行中', '完了', '保留']) {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'status-choice';
      choice.classList.toggle('is-selected', value === block.status);
      choice.setAttribute('aria-pressed', String(value === block.status));
      choice.textContent = value;
      choice.addEventListener('click', () => updateBlock(block.id, { status: value }, true));
      statusChoices.append(choice);
    }
    statusField.append(statusCaption, statusChoices);
    body.append(statusField);

    const progressField = document.createElement('label');
    progressField.className = 'block-field';
    const progressCaption = document.createElement('span');
    progressCaption.textContent = '進捗率（任意）';
    const progressInput = document.createElement('input');
    progressInput.type = 'number';
    progressInput.min = '0';
    progressInput.max = '100';
    progressInput.step = '1';
    progressInput.value = block.progressPercent?.toString() ?? '';
    progressInput.placeholder = '0〜100';
    const progressVisual = document.createElement('div');
    progressVisual.className = 'progress-visual';
    const progressBar = document.createElement('span');
    progressBar.className = 'progress-bar';
    const progressFill = document.createElement('span');
    progressFill.className = 'progress-fill';
    const progressValue = document.createElement('span');
    progressValue.className = 'progress-value';
    const updateProgressVisual = (value: number | undefined): void => {
      const safeValue = value === undefined ? 0 : value;
      progressFill.style.width = `${safeValue}%`;
      progressValue.textContent = value === undefined ? '未入力' : `${value}%`;
      progressBar.setAttribute('aria-valuenow', String(safeValue));
    };
    progressBar.append(progressFill);
    progressBar.setAttribute('role', 'progressbar');
    progressBar.setAttribute('aria-label', '進捗率');
    progressBar.setAttribute('aria-valuemin', '0');
    progressBar.setAttribute('aria-valuemax', '100');
    updateProgressVisual(block.progressPercent);
    progressInput.addEventListener('input', () => {
      const value = progressInput.value;
      if (value.length === 0) {
        updateBlock(block.id, { progressPercent: undefined });
        progressInput.setCustomValidity('');
        updateProgressVisual(undefined);
        return;
      }
      const progressPercent = Number(value);
      if (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 100) {
        progressInput.setCustomValidity('0〜100の整数で入力してください。');
        return;
      }
      progressInput.setCustomValidity('');
      updateBlock(block.id, { progressPercent });
      updateProgressVisual(progressPercent);
    });
    progressVisual.append(progressBar, progressValue);
    progressField.append(progressCaption, progressInput, progressVisual);
    body.append(progressField);

    addTextField(body, '詳細', block.statusDetail, '任意', (statusDetail) =>
      updateBlock(block.id, { statusDetail }),
    );
    addTextArea(body, '特記事項・課題・相談事項', block.note, '任意', (note) => updateBlock(block.id, { note }));
    card.append(header, body);
    blockList.append(card);
  }
};

const loadReport = async (date: string): Promise<void> => {
  loading = true;
  updateReportWeekday(date);
  setStatus('読み込み中…');
  try {
    const savedReport = await window.dailyReport.reports.load(date);
    report = savedReport ?? createEmptyReport(date);
    report.blocks = sortWorkBlocksByStartTime(report.blocks);
    expandedBlockIds = new Set(
      report.blocks
        .filter((block) => block.workContent.trim().length === 0)
        .map((block) => block.id),
    );
    previewIssues = new Map();
    commentInput.value = report.comment;
    renderBlocks();
    setStatus(savedReport === undefined ? '新しい日報を作成しました' : '保存済みの日報を復元しました');
  } catch {
    report = createEmptyReport(date);
    expandedBlockIds = new Set();
    commentInput.value = '';
    renderBlocks();
    setStatus('日報を読み込めませんでした');
  } finally {
    loading = false;
  }
};

const initialize = async (): Promise<void> => {
  dateInput.value = dateToInputValue(new Date());
  try {
    projects = await window.dailyReport.projects.list();
    activeProjects = projects.filter((project) => !project.archived);
  } catch {
    activeProjects = [];
    setStatus('案件一覧を読み込めませんでした');
  }
  await loadReport(dateInput.value);
};

dateInput.addEventListener('change', () => {
  if (dateInput.value.length > 0) {
    void loadReport(dateInput.value);
  }
});

addBlockButton.addEventListener('click', () => {
  const project = activeProjects[0];
  if (project === undefined) {
    return;
  }
  report.blocks.push(createWorkBlock(project));
  const addedBlock = report.blocks.at(-1);
  if (addedBlock !== undefined) {
    expandedBlockIds.add(addedBlock.id);
  }
  renderBlocks();
  scheduleSave();
});

commentInput.addEventListener('input', () => {
  report.comment = commentInput.value;
  scheduleSave();
});

previewButton.addEventListener('click', showPreview);
returnToInputButton.addEventListener('click', showInput);
navProjectsButton.addEventListener('click', () => {
  void showProjectManagement();
});
navReportButton.addEventListener('click', showInput);
navPreviewButton.addEventListener('click', showPreview);
navHistoryButton.addEventListener('click', () => {
  void showHistory();
});
archiveToggle.addEventListener('click', () => {
  showArchivedProjects = !showArchivedProjects;
  renderProjects();
});
projectFormCancel.addEventListener('click', resetProjectForm);
showProjectFormButton.addEventListener('click', showNewProjectForm);
projectColorInput.addEventListener('input', () => {
  projectColorWasChanged = true;
});
projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = projectNameInput.value.trim();
  const code = projectCodeInput.value.trim();
  const id = projectIdInput.value;
  if (name.length === 0) {
    setProjectFormMessage('案件名を入力してください。');
    projectNameInput.focus();
    return;
  }

  setProjectBusy(true);
  setProjectFormMessage(undefined);
  try {
    if (id.length === 0) {
      const input: CreateProjectInput = {
        name,
        ...(code.length === 0 ? {} : { code }),
        ...(projectColorWasChanged ? { color: projectColorInput.value } : {}),
      };
      await window.dailyReport.projects.create(input);
      setStatus('案件を登録しました');
    } else {
      const input: UpdateProjectInput = { name, code, color: projectColorInput.value };
      await window.dailyReport.projects.update(id, input);
      setStatus('案件を更新しました');
    }
    resetProjectForm();
    await refreshProjects();
  } catch {
    setProjectFormMessage('案件を保存できませんでした。入力内容を確認してください。');
  } finally {
    setProjectBusy(false);
  }
});
returnFromHistoryButton.addEventListener('click', showInput);
showHistoryButton.addEventListener('click', () => {
  void showHistory();
});
copyReportButton.addEventListener('click', async () => {
  const text = previewText.textContent;
  if (text === null || text.length === 0) {
    setCopyFeedback('コピーする日報がありません。', true);
    return;
  }

  copyReportButton.disabled = true;
  setCopyFeedback('コピー中…');
  try {
    await window.dailyReport.clipboard.writeReport(text);
    setCopyFeedback('クリップボードにコピーしました。');
  } catch {
    setCopyFeedback('コピーできませんでした。日報テキストを選択して手動でコピーしてください。', true);
    previewText.focus();
  } finally {
    copyReportButton.disabled = false;
  }
});

window.addEventListener('beforeunload', () => {
  if (saveTimer !== undefined) {
    void saveReport(structuredClone(report));
  }
});

void initialize();
