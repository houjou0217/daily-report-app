import type { Report, WorkBlock } from './models.js';
import { isEndTimeBeforeStartTime, sortWorkBlocksByStartTime } from './time.js';

export interface PreviewValidationIssue {
  blockId: string;
  field: 'project' | 'workContent' | 'status' | 'time';
  message: string;
}

const weekDays = ['日', '月', '火', '水', '木', '金', '土'] as const;

export const formatReportDate = (date: string): string => {
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  const weekDay = weekDays[parsedDate.getUTCDay()];
  return `${date.slice(0, 4)}年${date.slice(5, 7)}月${date.slice(8, 10)}日（${weekDay}）`;
};

export const validateReportForPreview = (report: Report): PreviewValidationIssue[] => {
  const issues: PreviewValidationIssue[] = [];
  for (const block of report.blocks) {
    if (block.projectId.trim().length === 0 || block.projectName.trim().length === 0) {
      issues.push({ blockId: block.id, field: 'project', message: '対象案件を選択してください。' });
    }
    if (block.workContent.trim().length === 0) {
      issues.push({ blockId: block.id, field: 'workContent', message: '作業内容を入力してください。' });
    }
    if (block.status.trim().length === 0) {
      issues.push({ blockId: block.id, field: 'status', message: '進捗状況を選択してください。' });
    }
    if (isEndTimeBeforeStartTime(block.startTime, block.endTime)) {
      issues.push({ blockId: block.id, field: 'time', message: '終了時刻は開始時刻以降に設定してください。' });
    }
  }
  return issues;
};

const formatBlock = (block: WorkBlock): string => {
  const time = block.startTime.length > 0 && block.endTime.length > 0
    ? `${block.startTime}-${block.endTime} `
    : '';
  const taskLabel = block.taskLabel.trim().length > 0 ? `（${block.taskLabel.trim()}）` : '';
  const progress = block.progressPercent === undefined ? '' : `（${block.progressPercent}%）`;
  const detail = block.statusDetail.trim().length > 0 ? ` ${block.statusDetail.trim()}` : '';

  return [
    `${time}■ ${block.projectName.trim()}${taskLabel}`,
    `・作業内容：${block.workContent.trim()}`,
    `・進捗状況：${block.status.trim()}${progress}${detail}`,
  ].join('\n');
};

export const formatReport = (report: Report): string => {
  const sections = [
    `【日報】${formatReportDate(report.date)}`,
    ...sortWorkBlocksByStartTime(report.blocks).map(formatBlock),
  ];
  if (report.comment.trim().length > 0) {
    sections.push(`本日の所感・共有事項：${report.comment.trim()}`);
  }
  return sections.join('\n\n');
};
