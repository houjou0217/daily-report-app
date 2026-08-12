import type { CreateProjectInput, Project, UpdateProjectInput } from '../domain/models.js';
import type {} from '../preload/api.js';

const getElement = <ElementType extends HTMLElement>(selector: string): ElementType => {
  const element = document.querySelector<ElementType>(selector);
  if (element === null) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element;
};

const archiveToggle = getElement<HTMLButtonElement>('#archive-toggle');
const cancelButton = getElement<HTMLButtonElement>('#form-cancel');
const colorInput = getElement<HTMLInputElement>('#project-color');
const count = getElement<HTMLParagraphElement>('#project-count');
const emptyState = getElement<HTMLParagraphElement>('#empty-state');
const form = getElement<HTMLFormElement>('#project-form');
const formMessage = getElement<HTMLParagraphElement>('#form-message');
const formTitle = getElement<HTMLHeadingElement>('#form-title');
const idInput = getElement<HTMLInputElement>('#project-id');
const nameInput = getElement<HTMLInputElement>('#project-name');
const codeInput = getElement<HTMLInputElement>('#project-code');
const list = getElement<HTMLDivElement>('#project-list');
const status = getElement<HTMLParagraphElement>('#app-status');
const submitButton = getElement<HTMLButtonElement>('#form-submit');

let projects: Project[] = [];
let showArchived = false;
let colorWasChanged = false;

const setStatus = (message: string): void => {
  status.textContent = message;
};

const setFormMessage = (message: string | undefined): void => {
  formMessage.hidden = message === undefined;
  formMessage.textContent = message ?? '';
};

const setBusy = (busy: boolean): void => {
  submitButton.disabled = busy;
  archiveToggle.disabled = busy;
};

const formatDate = (dateTime: string): string => {
  const date = new Date(dateTime);
  return Number.isNaN(date.getTime())
    ? '登録日: 不明'
    : `登録日: ${new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' }).format(date)}`;
};

const resetForm = (): void => {
  form.reset();
  idInput.value = '';
  colorInput.value = '#2f746d';
  colorWasChanged = false;
  formTitle.textContent = '新規案件を登録';
  submitButton.textContent = '登録する';
  cancelButton.hidden = true;
  setFormMessage(undefined);
};

const startEditing = (project: Project): void => {
  idInput.value = project.id;
  nameInput.value = project.name;
  codeInput.value = project.code;
  colorInput.value = project.color;
  colorWasChanged = true;
  formTitle.textContent = '案件を編集';
  submitButton.textContent = '変更を保存';
  cancelButton.hidden = false;
  setFormMessage(undefined);
  nameInput.focus();
};

const createActionButton = (label: string, action: string, projectId: string): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button';
  button.dataset.action = action;
  button.dataset.projectId = projectId;
  button.textContent = label;
  return button;
};

const renderProjects = (): void => {
  const visibleProjects = projects.filter((project) => project.archived === showArchived);
  list.replaceChildren();
  emptyState.hidden = visibleProjects.length > 0;
  count.textContent = showArchived
    ? `アーカイブ済み ${visibleProjects.length}件`
    : `利用中 ${visibleProjects.length}件`;
  archiveToggle.textContent = showArchived ? '利用中の案件を表示' : 'アーカイブを表示';
  archiveToggle.setAttribute('aria-pressed', String(showArchived));

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
    meta.textContent = [project.code, formatDate(project.createdAt)].filter(Boolean).join(' ・ ');
    details.append(colorBar, name, meta);

    const actions = document.createElement('div');
    actions.className = 'project-actions';
    actions.append(
      createActionButton('編集', 'edit', project.id),
      createActionButton(project.archived ? '復元' : '保管', 'archive', project.id),
      createActionButton('削除', 'delete', project.id),
    );
    row.append(details, actions);
    list.append(row);
  }
};

const refreshProjects = async (): Promise<void> => {
  setBusy(true);
  try {
    projects = await window.dailyReport.projects.list();
    renderProjects();
    setStatus('案件一覧を更新しました');
  } catch {
    setStatus('案件一覧を読み込めませんでした');
  } finally {
    setBusy(false);
  }
};

const handleProjectAction = async (action: string, projectId: string): Promise<void> => {
  const project = projects.find((candidate) => candidate.id === projectId);
  if (project === undefined) {
    return;
  }

  if (action === 'edit') {
    startEditing(project);
    return;
  }

  setBusy(true);
  try {
    if (action === 'archive') {
      await window.dailyReport.projects.update(project.id, { archived: !project.archived });
      setStatus(project.archived ? '案件を復元しました' : '案件をアーカイブしました');
    }

    if (action === 'delete') {
      const confirmed = window.confirm(`「${project.name}」を削除しますか？`);
      if (!confirmed) {
        return;
      }
      await window.dailyReport.projects.delete(project.id);
      if (idInput.value === project.id) {
        resetForm();
      }
      setStatus('案件を削除しました');
    }

    await refreshProjects();
  } catch {
    setStatus('案件を保存できませんでした');
  } finally {
    setBusy(false);
  }
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const code = codeInput.value.trim();
  const id = idInput.value;

  if (name.length === 0) {
    setFormMessage('案件名を入力してください。');
    nameInput.focus();
    return;
  }

  setBusy(true);
  setFormMessage(undefined);
  try {
    if (id.length === 0) {
      const input: CreateProjectInput = {
        name,
        ...(code.length === 0 ? {} : { code }),
        ...(colorWasChanged ? { color: colorInput.value } : {}),
      };
      await window.dailyReport.projects.create(input);
      setStatus('案件を登録しました');
    } else {
      const input: UpdateProjectInput = { name, code, color: colorInput.value };
      await window.dailyReport.projects.update(id, input);
      setStatus('案件を更新しました');
    }
    resetForm();
    await refreshProjects();
  } catch {
    setFormMessage('案件を保存できませんでした。入力内容を確認してください。');
  } finally {
    setBusy(false);
  }
});

archiveToggle.addEventListener('click', () => {
  showArchived = !showArchived;
  renderProjects();
});

cancelButton.addEventListener('click', resetForm);
colorInput.addEventListener('input', () => {
  colorWasChanged = true;
});

list.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const { action, projectId } = target.dataset;
  if (action === undefined || projectId === undefined) {
    return;
  }

  void handleProjectAction(action, projectId);
});

void refreshProjects();
