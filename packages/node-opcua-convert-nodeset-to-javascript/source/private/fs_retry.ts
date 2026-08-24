import fs from "node:fs";

// On Windows, transient locks from antivirus, OneDrive, or the TS language server
// (when files are open in an IDE) surface as ERROR_SHARING_VIOLATION
// (errno -4094 / code UNKNOWN/EBUSY/EPERM) on an otherwise valid write.
//
// This matters more than a lost write: generation writes the raw sources first and
// rewrites their imports in a second pass, so a crash between the two leaves the
// working tree half-generated — which reads as massive drift rather than as the
// transient failure it is. Retrying keeps the two passes atomic in practice.
function isTransientWriteError(err: unknown): boolean {
    const code = (err as NodeJS.ErrnoException).code;
    return code === "UNKNOWN" || code === "EBUSY" || code === "EPERM";
}

// Synchronous on purpose: the callers are sync (fs.writeFileSync, ts-morph's
// saveSync), so the backoff has to spin rather than await. Waits are ms-scale.
export function retryOnTransientWrite<T>(write: () => T, attempts = 6): T {
    for (let i = 0; ; i++) {
        try {
            return write();
        } catch (err) {
            if (!isTransientWriteError(err) || i === attempts - 1) throw err;
            const until = Date.now() + 50 * (i + 1);
            while (Date.now() < until) {
                /* spin */
            }
        }
    }
}

export function writeFileSyncRetry(filePath: string, content: string, attempts = 6): void {
    retryOnTransientWrite(() => fs.writeFileSync(filePath, content), attempts);
}
