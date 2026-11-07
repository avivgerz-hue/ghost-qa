/** Polls a URL until it answers with any HTTP status (even 404 = server up). */
export declare function waitForUrl(url: string, timeoutMs?: number, pollIntervalMs?: number): Promise<void>;
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
export declare class ManagedDevServer {
    private child;
    private output;
    readonly command: string;
    private readonly options;
    constructor(command: string, options?: ManagedServerOptions);
    get isRunning(): boolean;
    get pid(): number | undefined;
    /** Last chunk of captured stdout+stderr (for "server failed to start" errors). */
    get outputTail(): string;
    start(): void;
    /** Resolves once the URL responds; rejects with the server output on timeout/early exit. */
    waitUntilReady(url: string, timeoutMs?: number): Promise<void>;
    /** Terminates the spawned process tree. Safe to call multiple times. */
    stop(graceMs?: number): Promise<void>;
    private signalTree;
}
/**
 * Convenience wrapper: spawn `command`, wait for `url`, run `fn`, and always
 * tear the server down afterwards — even when `fn` throws.
 */
export declare function withManagedDevServer<T>(command: string, url: string, fn: () => Promise<T>, options?: ManagedServerOptions & {
    readyTimeoutMs?: number;
}): Promise<T>;
//# sourceMappingURL=server-lifecycle.d.ts.map