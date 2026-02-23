import chalk from 'chalk';
import { Thread } from './types.js';

export function formatAge(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffMonth > 0) return `${diffMonth}mo`;
  if (diffWeek > 0) return `${diffWeek}w`;
  if (diffDay > 0) return `${diffDay}d`;
  if (diffHour > 0) return `${diffHour}h`;
  if (diffMin > 0) return `${diffMin}m`;
  return `${diffSec}s`;
}

function colorStatus(status: string): string {
  switch (status) {
    case 'needs-reply':
      return chalk.yellow(status);
    case 'review':
      return chalk.magenta(status);
    case 'waiting':
      return chalk.cyan(status);
    case 'resolved':
      return chalk.dim(status);
    default:
      return status;
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function formatThreadList(threads: Thread[], now: Date = new Date()): string {
  if (threads.length === 0) {
    return 'No threads found.';
  }

  const header = `${chalk.bold('ID')}        ${chalk.bold('STATUS')}       ${chalk.bold('TITLE')}                          ${chalk.bold('LAST MESSAGE')}        ${chalk.bold('AGE')}`;
  const rows = threads.map((thread) => {
    const status = thread.status;
    const lastMessage =
      thread.messages.length > 0 ? thread.messages[thread.messages.length - 1] : null;

    const lastMessageText = lastMessage
      ? `"${truncate(lastMessage.content, 15)}" (${lastMessage.sender}, ${formatAge(new Date(lastMessage.at), now)})`
      : '-';

    const age = formatAge(new Date(thread.createdAt), now);

    return `${thread.id}  ${colorStatus(status).padEnd(25)}  ${truncate(thread.title, 30).padEnd(30)}  ${lastMessageText.padEnd(20)}  ${age}`;
  });

  return [header, ...rows].join('\n');
}

export function formatThread(thread: Thread): string {
  const lines = [
    chalk.bold(`Thread: ${thread.title}`),
    `ID: ${thread.id}`,
    `Status: ${thread.status}`,
    `Created: ${thread.createdAt}`,
    `Updated: ${thread.updatedAt}`,
    '',
  ];

  if (thread.messages.length === 0) {
    lines.push('No messages yet.');
  } else {
    lines.push(chalk.bold('Messages:'));
    thread.messages.forEach((msg) => {
      const sender = msg.sender === 'ai' ? chalk.cyan('[ai]') : chalk.green('[user]');
      lines.push(`${sender} ${msg.at}`);
      lines.push(`  ${msg.content}`);
      lines.push('');
    });
  }

  return lines.join('\n');
}
