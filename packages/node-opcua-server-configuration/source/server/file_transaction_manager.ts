/**
 * @module node-opcua-server-configuration-server
 */
import fs from "fs";
import { make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";

const debugLog = make_debugLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");
const warningLog = make_warningLog("ServerConfiguration");

type Functor = () => Promise<void>;

export async function copyFile(source: string, dest: string): Promise<void> {
    try {
        debugLog("copying file \n source ", source, "\n =>\n dest ", dest);
        const sourceExist = fs.existsSync(source);
        if (sourceExist) {
            await fs.promises.copyFile(source, dest);
        }
    } catch (err) {
        errorLog(err);
    }
}

export async function deleteFile(file: string): Promise<void> {
    try {
        const exists = fs.existsSync(file);
        if (exists) {
            debugLog("deleting file ", file);
            await fs.promises.unlink(file);
        }
    } catch (err) {
        errorLog(err);
    }
}

export async function moveFile(source: string, dest: string): Promise<void> {
    debugLog("moving file file \n source ", source, "\n =>\n dest ", dest);
    try {
        await copyFile(source, dest);
        await deleteFile(source);
    } catch (err) {
        errorLog(err);
    }
}

export async function moveFileWithBackup(source: string, dest: string): Promise<void> {
    // let make a copy of the destination file
    debugLog("moveFileWithBackup file \n source ", source, "\n =>\n dest ", dest);
    await copyFile(dest, dest + "_old");
    await moveFile(source, dest);
}

export class FileTransactionManager {
    private readonly _pendingFileOps: Functor[] = [];
    private readonly _backupFiles: Map<string, string> = new Map();

    public addFileOp(functor: Functor): void {
        this._pendingFileOps.push(functor);
    }

    public get pendingTasksCount(): number {
        return this._pendingFileOps.length;
    }

    /**
     * Move file with backup and track the backup for potential rollback.
     * This method creates a backup of the destination file and tracks it
     * so it can be restored if the transaction fails.
     */
    public async moveFileWithBackupTracked(source: string, dest: string): Promise<void> {
        const backupPath = dest + "_old";

        // Track the backup before creating it
        this._backupFiles.set(dest, backupPath);

        // Perform the actual move with backup
        await moveFileWithBackup(source, dest);
    }

    /**
     * Commit the transaction by executing all pending file operations.
     */
    public async applyFileOps(): Promise<void> {
        debugLog("start applyFileOps");
        const fileOperation = this._pendingFileOps.splice(0);

        try {
            while (fileOperation.length) {
                const op = fileOperation.shift()!;
                await op();
            }
            debugLog("end applyFileOps");

            // Transaction successful - clean up backup files
            await this.cleanupBackupFiles();
        } catch (err) {
            errorLog("Error during applyFileOps:", (err as Error).message);
            errorLog("Rolling back transaction to restore previous certificate state");

            // Rollback: restore all backup files to their original locations
            try {
                await this.rollbackTransaction();
                debugLog("Transaction rollback successful");
            } catch (rollbackErr) {
                errorLog("Critical: Rollback failed:", (rollbackErr as Error).message);
                errorLog("Certificate state may be inconsistent - manual intervention required");
            }

            // Clear backup tracking after rollback
            this._backupFiles.clear();

            throw err;
        }
    }

    /**
     * Rollback the transaction by restoring all backup files.
     * This restores files from their *_old backups to recover the previous state.
     */
    private async rollbackTransaction(): Promise<void> {
        debugLog("Rolling back transaction, restoring", this._backupFiles.size, "backup files");

        const rollbackPromises: Promise<void>[] = [];

        for (const [dest, backupPath] of this._backupFiles.entries()) {
            rollbackPromises.push(
                (async () => {
                    try {
                        // Check if backup exists before trying to restore
                        if (fs.existsSync(backupPath)) {
                            debugLog("Restoring backup:", backupPath, "to", dest);
                            await copyFile(backupPath, dest);
                            // Delete backup immediately after restoration
                            await deleteFile(backupPath);
                        }
                    } catch (err) {
                        errorLog("Error restoring backup file", backupPath, "to", dest, ":", (err as Error).message);
                    }
                })()
            );
        }

        await Promise.all(rollbackPromises);
        debugLog("Transaction rollback completed");
    }

    /**
     * Clean up backup files after successful transaction.
     * Removes all *_old backup files that were created during the transaction.
     */
    private async cleanupBackupFiles(): Promise<void> {
        debugLog("Cleaning up", this._backupFiles.size, "backup files");

        const cleanupPromises: Promise<void>[] = [];

        for (const backupPath of this._backupFiles.values()) {
            cleanupPromises.push(
                deleteFile(backupPath).catch(err => {
                    warningLog("Failed to delete backup file", backupPath, ":", err);
                })
            );
        }

        await Promise.all(cleanupPromises);
        this._backupFiles.clear();
    }
}
