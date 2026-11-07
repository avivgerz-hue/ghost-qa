import { spawn, type ChildProcess } from 'node:child_process';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';

/** Polls a URL until it answers with any HTTP status (even 404 = server up). */
export function waitForUrl(
  url: string,
  timeoutMs = 30_000,
  pollIntervalMs = 400,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolvePromise, rejectPromise) => {
    const attempt = () => {
      const getter = url.startsWith('https:') ? httpsGet : httpGet;
      const request = getter(url, (response) => {
        response.resume();
        resolvePromise();
      });
      request.setTimeout(2_000, () => request.destroy(new Error('poll timeout')));
      request.on('error', () => {
        if (Date.now() >= deadline) {
          rejectPromise(
            new Error(`Timed out after ${timeoutMs}ms waiting for ${url} to respond.`),
          );
        } else {
          setTimeout(attempt, pollIntervalMs);
        }
      });
    };
    attempt();
  });
}

export interface ManagedServerOptions {
  /** Working directory for the command (default: process.cwd()). */
  cwd?: string;
  /** Extra environment variables merged over process.env. */
  env?: Record<string, string>;
  /** How many characters of server output to keep for error reporting. */
  outputBufferChars?: number;
}

/**
 * Owns a spawned dev-server process tree: `start()` spawns it through the
 * platform shell in its own process group, `waitUntilReady()` polls the
 * target URL, and `stop()` terminates the whole tree (SIGTERM, then SIGKILL)
 * so no orphaned dev servers survive a ghost-qa run.
 */
export class ManagedDevServer {
  private child: ChildProcess | null = null;
  private output = '';
  readonly command: string;
  private readonly options: ManagedServerOptions;

  constructor(command: string, options: ManagedServerOptions = {}) {
    this.command = command;
    this.options = options;
  }

  get isRunning(): boolean {
    return this.child !== null && !this.child.killed && this.child.exitCode === null;
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  /** Last chunk of captured stdout+stderr (for "server failed to start" errors). */
  get outputTail(): string {
    return this.output.slice(-2_000);
  }

  start(): void {
    if (this.child) throw new Error(`Dev server already started: ${this.command}`);
    const bufferLimit = this.options.outputBufferChars ?? 20_000;
    this.child = spawn(this.command, {
      cwd: this.options.cwd ?? process.cwd(),
      env: { ...process.env, ...(this.options.env ?? {}) },
      shell: true,
      // Own process group on POSIX so stop() can kill the whole tree
      // (shell -> npm -> node) instead of just the shell wrapper.
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const capture = (chunk: Buffer) => {
      this.output = (this.output + chunk.toString()).slice(-bufferLimit);
    };
    this.child.stdout?.on('data', capture);
    this.child.stderr?.on('data', capture);
  }

  /** Resolves once the URL responds; rejects with the server output on timeout/early exit. */
  async waitUntilReady(url: string, timeoutMs = 30_000): Promise<void> {
    if (!this.child) this.start();
    let exited: Error | null = null;
    const onExit = (code: number | null) => {
      exited = new Error(
        `Dev server exited before ${url} became ready (exit code ${code ?? 'unknown'}).\n` +
          `Command: ${this.command}\n--- server output ---\n${this.outputTail || '(no output captured)'}`,
      );
    };
    this.child!.once('exit', onExit);
    try {
      await waitForUrl(url, timeoutMs);
      if (exited) throw exited;
    } catch (error) {
      if (exited) throw exited;
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\n` +
          `Command: ${this.command}\n--- server output ---\n${this.outputTail || '(no output captured)'}`,
      );
    } finally {
      this.child?.removeListener('exit', onExit);
    }
  }

  /** Terminates the spawned process tree. Safe to call multiple times. */
  async stop(graceMs = 3_000): Promise<void> {
    const child = this.child;
    if (!child || child.exitCode !== null) {
      this.child = null;
      return;
    }
    const exited = new Promise<void>((resolvePromise) => {
      child.once('exit', () => resolvePromise());
    });

    this.signalTree(child, 'SIGTERM');
    const graceful = await Promise.race([
      exited.then(() => true),
      new Promise<false>((resolvePromise) => setTimeout(() => resolvePromise(false), graceMs)),
    ]);
    if (!graceful) {
      this.signalTree(child, 'SIGKILL');
      await Promise.race([
        exited,
        new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 2_000)),
      ]);
    }
    this.child = null;
  }

  private signalTree(child: ChildProcess, signal: NodeJS.Signals): void {
    try {
      if (process.platform !== 'win32' && child.pid) {
        // Negative pid = the whole process group created by `detached: true`.
        process.kill(-child.pid, signal);
        return;
      }
    } catch {
      /* group already gone — fall through to direct kill */
    }
    try {
      child.kill(signal);
    } catch {
      /* already exited */
    }
  }
}

/**
 * Convenience wrapper: spawn `command`, wait for `url`, run `fn`, and always
 * tear the server down afterwards — even when `fn` throws.
 */
export async function withManagedDevServer<T>(
  command: string,
  url: string,
  fn: () => Promise<T>,
  options: ManagedServerOptions & { readyTimeoutMs?: number } = {},
): Promise<T> {
  const server = new ManagedDevServer(command, options);
  server.start();
  try {
    await server.waitUntilReady(url, options.readyTimeoutMs ?? 30_000);
    return await fn();
  } finally {
    await server.stop();
  }
}
