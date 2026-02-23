export interface Message {
  sender: 'ai' | 'user';
  content: string;
  at: string;
}

export type ThreadStatus = 'active' | 'resolved' | 'waiting' | 'needs-reply' | 'review';

export interface Thread {
  id: string;
  title: string;
  status: ThreadStatus;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export type ThreadFilter = ThreadStatus | 'inbox';

export interface ThreadFilters {
  status?: ThreadFilter;
}

export interface ListOptions {
  status?: ThreadFilter;
  json?: boolean;
  dir?: string;
}

export interface CommandOptions {
  json?: boolean;
  dir?: string;
  from?: 'ai' | 'user';
  status?: ThreadStatus;
  dryRun?: boolean;
}
