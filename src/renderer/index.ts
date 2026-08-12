import type { Project, Report, WorkBlock } from '../domain/models.js';
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
const dateInput = getElement<HTMLInputElement>('#report-date');
const emptyState = getElement<HTMLParagraphElement>('#empty-state');
const projectNotice = getElement<HTMLParagraphElement>('#project-notice');
const status = getElement<HTMLParagraphElement>('#app-status');

let activeProjects: Project[] = [];
let report: Report;
let saveTimer: number | undefined;
let loading = false;

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

const updateBlock = (id: string, change: Partial<WorkBlock>): void => {
  const block = report.blocks.find((candidate) => candidate.id === id);
  if (block === undefined) {
    return;
  }
  Object.assign(block, change);
  scheduleSave();
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

    const header = document.createElement('header');
    header.className = 'block-header';
    const title = document.createElement('h3');
    title.textContent = `作業ブロック ${index + 1}`;
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

window.addEventListener('beforeunload', () => {
  if (saveTimer !== undefined) {
    void saveReport();
  }
});

void initialize();
