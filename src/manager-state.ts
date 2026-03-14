/**
 * manager-state.ts
 *
 * Pure TypeScript module for Manager GUI state logic.
 * No DOM dependencies — fully testable via Vitest.
 */

export interface Msg {
  sender: 'ai' | 'user';
  content: string;
  at: string;
}

export interface Thread {
  id: string;
  status: string;
  title: string;
  messages: Msg[];
  updatedAt: string;
  createdAt: string;
}

export interface Task {
  id: string;
  stage?: string;
  description?: string;
  updatedAt?: string;
  createdAt?: string;
}

export type SectionKey = 'ai-replied' | 'needs-reply' | 'review' | 'waiting' | 'idle';

export interface ThreadGroups {
  'ai-replied': Thread[];
  'needs-reply': Thread[];
  review: Thread[];
  waiting: Thread[];
  idle: Thread[];
}

export interface ReconcileResult {
  add: string[];
  remove: string[];
  update: string[];
}

/**
 * Returns the sender of the last message in a thread, or null if no messages.
 */
export function lastMsgSender(thread: Thread): 'ai' | 'user' | null {
  if (!thread.messages || thread.messages.length === 0) return null;
  return thread.messages[thread.messages.length - 1].sender;
}

/**
 * Groups threads into inbox sections.
 * Resolved threads are excluded from all sections.
 */
export function groupThreads(threads: Thread[]): ThreadGroups {
  const groups: ThreadGroups = {
    'ai-replied': [],
    'needs-reply': [],
    review: [],
    waiting: [],
    idle: [],
  };
  for (const t of threads) {
    if (t.status === 'resolved') continue;
    if (t.status === 'review') {
      groups['review'].push(t);
    } else if (t.status === 'needs-reply') {
      groups['needs-reply'].push(t);
    } else if (t.status === 'waiting') {
      groups['waiting'].push(t);
    } else if (t.status === 'active' && lastMsgSender(t) === 'ai') {
      groups['ai-replied'].push(t);
    } else {
      groups['idle'].push(t);
    }
  }
  return groups;
}

/**
 * Decides whether the detail panel should scroll to bottom after an update.
 */
export function shouldScrollToBottom({
  isFirstRender,
  hasNewMessages,
  wasNearBottom,
}: {
  isFirstRender: boolean;
  hasNewMessages: boolean;
  wasNearBottom: boolean;
}): boolean {
  return isFirstRender || (hasNewMessages && wasNearBottom);
}

/**
 * Diffs two arrays of IDs and returns which IDs to add, remove, or update.
 * prevIds: IDs currently rendered
 * nextIds: IDs that should be rendered after update
 */
export function reconcileIds(prevIds: string[], nextIds: string[]): ReconcileResult {
  const prevSet = new Set(prevIds);
  const nextSet = new Set(nextIds);

  const add: string[] = [];
  const remove: string[] = [];
  const update: string[] = [];

  for (const id of nextIds) {
    if (prevSet.has(id)) {
      update.push(id);
    } else {
      add.push(id);
    }
  }

  for (const id of prevIds) {
    if (!nextSet.has(id)) {
      remove.push(id);
    }
  }

  return { add, remove, update };
}

/**
 * Returns messages beyond the previously rendered count.
 */
export function getNewMessages(prevCount: number, msgs: Msg[]): Msg[] {
  if (!msgs || msgs.length <= prevCount) return [];
  return msgs.slice(prevCount);
}
