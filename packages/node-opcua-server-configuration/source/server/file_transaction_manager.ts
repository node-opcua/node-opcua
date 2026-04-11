/**
 * @module node-opcua-server-configuration-server
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";

const debugLog = make_debugLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");
const warningLog = make_warningLog("ServerConfiguration");

type Functor = () => Promise<void>;

async function _copyFile(source: string, dest: string): Promise<void> {
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

async function _deleteFile(file: string): Promise<void> {
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

async function _moveFile(source: string, dest: string): Promise<void> {
    debugLog("moving file file \n source ", source, "\n =>\n dest ", dest);
    try {
        await _copyFile(source, dest);
        await _deleteFile(source);
    } catch (err) {
        errorLog(err);
    }
}

async function _moveFileWithBackup(source: string, dest: string, backupPath: string): Promise<void> {
    // let make a copy of the destination file
    debugLog("moveFileWithBackup file \n source ", source, "\n =>\n dest ", dest);
    await _copyFile(dest, backupPath);
    await _moveFile(source, dest);
}

export class FileTransactionManager {
    readonly #pendingFileOps: Functor[] = [];
    readonly #cleanupTasks: Functor[] = [];
    readonly #backupFiles: Map<string, string> = new Map();
    #tmpdir?: string;

    /**
     * Gets or initializes the underlying temporary directory for the transaction.
     */
    public async getTmpDir(): Promise<string> {
        if (!this.#tmpdir) {
            const tempBase = path.join(os.tmpdir(), "node-opcua-tx-");
            this.#tmpdir = await fs.promises.mkdtemp(tempBase);
        }
        return this.#tmpdir;
    }

    /**
     * Stages a file for writing during the transaction.
     * Writes the content to a temporary location and registers
     * a move operation to atomically place it at destinationPath upon applyFileOps().
     */
    public async stageFile(destinationPath: string, content: Buffer | string, encoding?: BufferEncoding): Promise<void> {
        // ensure tmpdir exists
        const tmpDir = await this.getTmpDir();

        const uniqueFileName = `${crypto.randomBytes(16).toString("hex")}.tmp`;
        const tempFilePath = path.join(tmpDir, uniqueFileName);

        if (encoding) {
            await fs.promises.writeFile(tempFilePath, content as string, encoding);
        } else {
            await fs.promises.writeFile(tempFilePath, content);
        }

        this.addFileOp(() => this.#moveFileWithBackupTracked(tempFilePath, destinationPath));
    }

    /**
     * Stages a file for deletion during the transaction.
     *
     * The file is backed up before removal so it can be restored
     * if the transaction is rolled back.  If the file does not
     * exist at apply time the operation is silently skipped.
     *
     * @param filePath - absolute path of the file to remove
     */
    public stageFileRemoval(filePath: string): void {
        this.addFileOp(async () => {
            if (!fs.existsSync(filePath)) {
                return;
            }
            // Create a backup before deleting so rollback can restore it
            const tmpDir = await this.getTmpDir();
            const uniqueFileName = `${crypto.randomBytes(16).toString("hex")}_backup.tmp`;
            const backupPath = path.join(tmpDir, uniqueFileName);
            this.#backupFiles.set(filePath, backupPath);

            await _copyFile(filePath, backupPath);
            await _deleteFile(filePath);
        });
    }

    public addFileOp(functor: Functor): void {
        this.#pendingFileOps.push(functor);
    }

    public addCleanupTask(functor: Functor): void {
        this.#cleanupTasks.push(functor);
    }

    public get pendingTasksCount(): number {
        return this.#pendingFileOps.length;
    }

    /**
     * Abort the current transaction by clearing pending file operations
     * and deleting the temporary staging folder.
     */
    public async abortTransaction(): Promise<void> {
        this.#pendingFileOps.length = 0;
        await this.#executeCleanupTasks();
        await this.#cleanupTempFolder();
    }

    /**
     * Move file with backup and track the backup for potential rollback.
     * This method creates a backup of the destination file and tracks it
     * so it can be restored if the transaction fails.
     */
    async #moveFileWithBackupTracked(source: string, dest: string): Promise<void> {
        const tmpDir = await this.getTmpDir();
        const uniqueFileName = `${crypto.randomBytes(16).toString("hex")}_backup.tmp`;
        const backupPath = path.join(tmpDir, uniqueFileName);

        // Track the backup before creating it
        this.#backupFiles.set(dest, backupPath);

        // Perform the actual move with backup
        await _moveFileWithBackup(source, dest, backupPath);
    }

    /**
     * Commit the transaction by executing all pending file operations.
     */
    public async applyFileOps(): Promise<void> {
        debugLog("start applyFileOps");
        const fileOperation = this.#pendingFileOps.splice(0);

        try {
            while (fileOperation.length) {
                const op = fileOperation.shift();
                await op?.();
            }
            debugLog("end applyFileOps");

            // Transaction successful - clean up backup files
            await this.#cleanupBackupFiles();
            await this.#executeCleanupTasks();
            await this.#cleanupTempFolder();
        } catch (err) {
            errorLog("Error during applyFileOps:", (err as Error).message);
            errorLog("Rolling back transaction to restore previous certificate state");

            // Rollback: restore all backup files to their original locations
            try {
                await this.#rollbackTransaction();
                debugLog("Transaction rollback successful");
            } catch (rollbackErr) {
                errorLog("Critical: Rollback failed:", (rollbackErr as Error).message);
                errorLog("Certificate state may be inconsistent - manual intervention required");
            }

            // Clear backup tracking after rollback
            this.#backupFiles.clear();
            await this.#executeCleanupTasks();
            await this.#cleanupTempFolder();

            throw err;
        }
    }

    /**
     * Rollback the transaction by restoring all backup files.
     * This restores files from their *_old backups to recover the previous state.
     */
    async #rollbackTransaction(): Promise<void> {
        debugLog("Rolling back transaction, restoring", this.#backupFiles.size, "backup files");

        const rollbackPromises: Promise<void>[] = [];

        for (const [dest, backupPath] of this.#backupFiles.entries()) {
            rollbackPromises.push(
                (async () => {
                    try {
                        // Check if backup exists before trying to restore
                        if (fs.existsSync(backupPath)) {
                            debugLog("Restoring backup:", backupPath, "to", dest);
                            await _copyFile(backupPath, dest);
                            // Delete backup immediately after restoration
                            await _deleteFile(backupPath);
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
    async #cleanupBackupFiles(): Promise<void> {
        debugLog("Cleaning up", this.#backupFiles.size, "backup files");

        const cleanupPromises: Promise<void>[] = [];

        for (const backupPath of this.#backupFiles.values()) {
            cleanupPromises.push(
                _deleteFile(backupPath).catch((err) => {
                    warningLog("Failed to delete backup file", backupPath, ":", err);
                })
            );
        }

        await Promise.all(cleanupPromises);
        this.#backupFiles.clear();
    }

    /**
     * Clean up the temporary transaction folder.
     */
    async #cleanupTempFolder(): Promise<void> {
        if (this.#tmpdir) {
            try {
                await fs.promises.rm(this.#tmpdir, { recursive: true, force: true });
            } catch (err) {
                warningLog("Failed to delete temporary transaction folder", this.#tmpdir, ":", err);
            } finally {
                this.#tmpdir = undefined;
            }
        }
    }

    async #executeCleanupTasks(): Promise<void> {
        debugLog("Executing cleanup tasks");
        const tasks = this.#cleanupTasks.splice(0);
        for (const task of tasks) {
            try {
                await task();
            } catch (err) {
                errorLog("Error during cleanup task:", (err as Error).message);
            }
        }
    }
}
