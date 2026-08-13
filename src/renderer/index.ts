import type { Project, Report, WorkBlock } from '../domain/models.js';
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
const blockList = getElement<HTMLDivElement>('#block-list');
const commentInput = getElement<HTMLTextAreaElement>('#report-comment');
const copyFeedback = getElement<HTMLParagraphElement>('#copy-feedback');
const copyReportButton = getElement<HTMLButtonElement>('#copy-report');
const dateInput = getElement<HTMLInputElement>('#report-date');
const emptyState = getElement<HTMLParagraphElement>('#empty-state');
const projectNotice = getElement<HTMLParagraphElement>('#project-notice');
const previewButton = getElement<HTMLButtonElement>('#show-preview');
const previewPanel = getElement<HTMLElement>('#preview-panel');
const previewText = getElement<HTMLPreElement>('#preview-text');
const reportPanel = getElement<HTMLElement>('.report-panel');
const returnToInputButton = getElement<HTMLButtonElement>('#return-to-input');
const status = getElement<HTMLParagraphElement>('#app-status');

let activeProjects: Project[] = [];
let report: Report;
let saveTimer: number | undefined;
let loading = false;
let previewIssues = new Map<string, string[]>();

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
  reportPanel.hidden = false;
  setCopyFeedback(undefined);
  previewButton.focus();
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
    renderBlocks();
    setStatus('必須項目または時刻を確認してください。');
    document.querySelector<HTMLElement>('.block-validation')?.focus();
    return;
  }

  previewText.textContent = formatReport(report);
  setCopyFeedback(undefined);
  reportPanel.hidden = true;
  previewPanel.hidden = false;
  previewText.focus();
};

const scheduleSave = (): void => {
  if (loading) {
    return;
  }
  if (saveTimer !== undefined) {
    window.clearTimeout(saveTimer);
  }
  setStatus('保存中…');
  saveTimer = window.setTimeout(() => {
    void saveReport();
  }, 400);
};

const saveReport = async (): Promise<void> => {
  saveTimer = undefined;
  report.updatedAt = new Date().toISOString();
  try {
    await window.dailyReport.reports.save(report);
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
  emptyState.hidden = report.blocks.length > 0;
  addBlockButton.disabled = activeProjects.length === 0;
  projectNotice.hidden = activeProjects.length > 0;

  for (const [index, block] of report.blocks.entries()) {
    const card = document.createElement('article');
    card.className = 'block-card';

    const issues = previewIssues.get(block.id);
    if (issues !== undefined) {
      card.classList.add('block-card-invalid');
    }

    const header = document.createElement('header');
    header.className = 'block-header';
    const title = document.createElement('h3');
    title.textContent = block.startTime.length === 0
      ? `作業ブロック ${index + 1}`
      : `${block.startTime}〜 ${block.projectName}`;
    const actions = document.createElement('div');
    actions.className = 'block-actions';

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
      createAction('▲', () => moveBlock(-1), index === 0),
      createAction('▼', () => moveBlock(1), index === report.blocks.length - 1),
      createAction('削除', () => {
        report.blocks = report.blocks.filter((candidate) => candidate.id !== block.id);
        renderBlocks();
        scheduleSave();
      }),
    );
    header.append(title, actions);

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
    projectField.className = 'block-field';
    const projectCaption = document.createElement('span');
    projectCaption.textContent = '対象案件';
    const projectSelect = document.createElement('select');
    for (const project of activeProjects) {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      option.selected = project.id === block.projectId;
      projectSelect.append(option);
    }
    projectSelect.addEventListener('change', () => {
      const project = activeProjects.find((candidate) => candidate.id === projectSelect.value);
      if (project !== undefined) {
        updateBlock(block.id, { projectId: project.id, projectName: project.name });
      }
    });
    projectField.append(projectCaption, projectSelect);
    body.append(projectField);

    addTextField(body, '業務種別', block.taskLabel, '例: MTG', (taskLabel) =>
      updateBlock(block.id, { taskLabel }),
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
    const statusSelect = document.createElement('select');
    for (const value of ['進行中', '完了', '保留']) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      option.selected = value === block.status;
      statusSelect.append(option);
    }
    statusSelect.addEventListener('change', () => updateBlock(block.id, { status: statusSelect.value }));
    statusField.append(statusCaption, statusSelect);
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
    progressInput.addEventListener('input', () => {
      const value = progressInput.value;
      if (value.length === 0) {
        updateBlock(block.id, { progressPercent: undefined });
        progressInput.setCustomValidity('');
        return;
      }
      const progressPercent = Number(value);
      if (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 100) {
        progressInput.setCustomValidity('0〜100の整数で入力してください。');
        return;
      }
      progressInput.setCustomValidity('');
      updateBlock(block.id, { progressPercent });
    });
    progressField.append(progressCaption, progressInput);
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
  setStatus('読み込み中…');
  try {
    const savedReport = await window.dailyReport.reports.load(date);
    report = savedReport ?? createEmptyReport(date);
    report.blocks = sortWorkBlocksByStartTime(report.blocks);
    previewIssues = new Map();
    commentInput.value = report.comment;
    renderBlocks();
    setStatus(savedReport === undefined ? '新しい日報を作成しました' : '保存済みの日報を復元しました');
  } catch {
    report = createEmptyReport(date);
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
    activeProjects = (await window.dailyReport.projects.list()).filter((project) => !project.archived);
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
  renderBlocks();
  scheduleSave();
});

commentInput.addEventListener('input', () => {
  report.comment = commentInput.value;
  scheduleSave();
});

previewButton.addEventListener('click', showPreview);
returnToInputButton.addEventListener('click', showInput);
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
    void saveReport();
  }
});

void initialize();
