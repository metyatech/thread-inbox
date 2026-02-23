export interface Message {
  sender: 'ai' | 'user';
  content: string;
  at: string;
}

export interface Thread {
  id: string;
  title: string;
  status: 'active' | 'resolved';
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export type ThreadStatus = 'active' | 'resolved' | 'needs-reply' | 'waiting';

export interface ThreadFilters {
  status?: ThreadStatus;
}

export interface ListOptions {
  status?: ThreadStatus;
  json?: boolean;
  dir?: string;
}

export interface CommandOptions {
  json?: boolean;
  dir?: string;
  from?: 'ai' | 'user';
  dryRun?: boolean;
}
