import type { WorkBlock } from './models.js';

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export const isFiveMinuteTime = (value: string): boolean => {
  if (!TIME_PATTERN.test(value)) {
    return false;
  }
  const minutes = Number(value.slice(3));
  return minutes % 5 === 0;
};

export const timeToMinutes = (value: string): number | undefined => {
  if (!isFiveMinuteTime(value)) {
    return undefined;
  }
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
};

export const calculateDuration = (startTime: string, endTime: string): string | undefined => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (startMinutes === undefined || endMinutes === undefined || endMinutes < startMinutes) {
    return undefined;
  }

  const duration = endMinutes - startMinutes;
  return `${Math.floor(duration / 60)}時間${String(duration % 60).padStart(2, '0')}分`;
};

export const isEndTimeBeforeStartTime = (startTime: string, endTime: string): boolean => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return startMinutes !== undefined && endMinutes !== undefined && endMinutes < startMinutes;
};

export const sortWorkBlocksByStartTime = (blocks: readonly WorkBlock[]): WorkBlock[] =>
  blocks
    .map((block, index) => ({ block, index, startMinutes: timeToMinutes(block.startTime) }))
    .sort((left, right) => {
      if (left.startMinutes === undefined && right.startMinutes === undefined) {
        return left.index - right.index;
      }
      if (left.startMinutes === undefined) {
        return 1;
      }
      if (right.startMinutes === undefined) {
        return -1;
      }
      return left.startMinutes === right.startMinutes
        ? left.index - right.index
        : left.startMinutes - right.startMinutes;
    })
    .map(({ block }) => block);
