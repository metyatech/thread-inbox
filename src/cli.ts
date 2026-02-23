import { Command } from 'commander';
import {
  createThread,
  listThreads,
  getThread,
  addMessage,
  resolveThread,
  reopenThread,
  purgeThreads,
} from './threads.js';
import { formatThreadList, formatThread } from './format.js';

const program = new Command();

program
  .name('thread-inbox')
  .description('Threaded conversation inbox for managing user-AI interactions')
  .version('0.1.0');

program
  .command('new <title>')
  .description('Create a new thread')
  .option('--json', 'Output as JSON')
  .option('--dir <path>', 'Working directory', process.cwd())
  .action(async (title: string, options: { json?: boolean; dir: string }) => {
    try {
      const thread = await createThread(options.dir, title);
      if (options.json) {
        console.log(JSON.stringify(thread, null, 2));
      } else {
        console.log(thread.id);
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all threads')
  .option('--status <status>', 'Filter by status (active, resolved, needs-reply, waiting)')
  .option('--json', 'Output as JSON')
  .option('--dir <path>', 'Working directory', process.cwd())
  .action(async (options: { status?: string; json?: boolean; dir: string }) => {
    try {
      const threads = await listThreads(options.dir, {
        status: options.status as 'active' | 'resolved' | 'needs-reply' | 'waiting' | undefined,
      });

      if (options.json) {
        console.log(JSON.stringify(threads, null, 2));
      } else {
        console.log(formatThreadList(threads));
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('inbox')
  .description('List threads that need reply (alias for list --status needs-reply)')
  .option('--json', 'Output as JSON')
  .option('--dir <path>', 'Working directory', process.cwd())
  .action(async (options: { json?: boolean; dir: string }) => {
    try {
      const threads = await listThreads(options.dir, { status: 'needs-reply' });

      if (options.json) {
        console.log(JSON.stringify(threads, null, 2));
      } else {
        console.log(formatThreadList(threads));
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('show <id>')
  .description('Show thread details')
  .option('--json', 'Output as JSON')
  .option('--dir <path>', 'Working directory', process.cwd())
  .action(async (id: string, options: { json?: boolean; dir: string }) => {
    try {
      const thread = await getThread(options.dir, id);

      if (!thread) {
        console.error(`Thread ${id} not found`);
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(thread, null, 2));
      } else {
        console.log(formatThread(thread));
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('add <id> <message>')
  .description('Add a message to a thread')
  .option('--from <sender>', 'Message sender (user or ai)', 'user')
  .option('--json', 'Output as JSON')
  .option('--dir <path>', 'Working directory', process.cwd())
  .action(
    async (id: string, message: string, options: { from: string; json?: boolean; dir: string }) => {
      try {
        const sender = options.from as 'ai' | 'user';
        const thread = await addMessage(options.dir, id, message, sender);

        if (options.json) {
          console.log(JSON.stringify(thread, null, 2));
        } else {
          console.log(`Added message to thread ${id}`);
        }
      } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(1);
      }
    },
  );

program
  .command('resolve <id>')
  .description('Mark a thread as resolved')
  .option('--json', 'Output as JSON')
  .option('--dir <path>', 'Working directory', process.cwd())
  .action(async (id: string, options: { json?: boolean; dir: string }) => {
    try {
      const thread = await resolveThread(options.dir, id);

      if (options.json) {
        console.log(JSON.stringify(thread, null, 2));
      } else {
        console.log(`Resolved thread ${id}`);
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('reopen <id>')
  .description('Reopen a resolved thread')
  .option('--json', 'Output as JSON')
  .option('--dir <path>', 'Working directory', process.cwd())
  .action(async (id: string, options: { json?: boolean; dir: string }) => {
    try {
      const thread = await reopenThread(options.dir, id);

      if (options.json) {
        console.log(JSON.stringify(thread, null, 2));
      } else {
        console.log(`Reopened thread ${id}`);
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('purge')
  .description('Remove all resolved threads')
  .option('--dry-run', 'Show what would be purged without removing')
  .option('--json', 'Output as JSON')
  .option('--dir <path>', 'Working directory', process.cwd())
  .action(async (options: { dryRun?: boolean; json?: boolean; dir: string }) => {
    try {
      const purged = await purgeThreads(options.dir, options.dryRun);

      if (options.json) {
        console.log(JSON.stringify(purged, null, 2));
      } else {
        const action = options.dryRun ? 'Would purge' : 'Purged';
        const plural = purged.length === 1 ? 'thread' : 'threads';
        console.log(`${action} ${purged.length} ${plural}`);
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program.parse();
