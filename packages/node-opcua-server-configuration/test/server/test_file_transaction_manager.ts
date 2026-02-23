import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import should from "should";

import { FileTransactionManager } from "../../dist/server/file_transaction_manager.js";

describe("FileTransactionManager", () => {
    let transactionManager: FileTransactionManager;
    let tempDir: string;
    let sourceFile: string;
    let destFile: string;

    beforeEach(async () => {
        transactionManager = new FileTransactionManager();
        const prefix = path.join(os.tmpdir(), "ftm-test-");
        tempDir = await fs.promises.mkdtemp(prefix);

        sourceFile = path.join(tempDir, "source.txt");
        destFile = path.join(tempDir, "dest.txt");

        await fs.promises.writeFile(sourceFile, "Hello World", "utf8");
    });

    afterEach(async () => {
        try {
            await transactionManager.abortTransaction();
        } catch (_err) {
            // ignore
        }
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    it("should successfully stage a file and apply ops", async () => {
        // Given a destination path and some content to stage
        const destPath = path.join(tempDir, "staged.txt");
        const content = "Staged Content";

        const tmpDir = await transactionManager.getTmpDir();
        // When I stage the file
        await transactionManager.stageFile(destPath, content, "utf8");

        // Then a temporary directory should be created
        fs.existsSync(tmpDir).should.be.true();
        // And the destination file should not exist yet
        fs.existsSync(destPath).should.be.false();
        // And there should be one pending task
        transactionManager.pendingTasksCount.should.eql(1);

        // When I apply the file operations
        await transactionManager.applyFileOps();

        // Then there should be no pending tasks left
        transactionManager.pendingTasksCount.should.eql(0);
        // And the temporary directory should be cleaned up
        fs.existsSync(tmpDir).should.be.false();

        // And the destination file should contain the staged content
        const fileContent = await fs.promises.readFile(destPath, "utf8");
        fileContent.should.eql(content);
        fs.existsSync(destPath).should.be.true();
    });

    it("should clean tmpdir on abortTransaction", async () => {
        // Given a staged file in the transaction
        const destPath = path.join(tempDir, "staged.txt");
        const content = "Staged Content";

        const tmpDir = await transactionManager.getTmpDir();
        await transactionManager.stageFile(destPath, content, "utf8");

        // And the temporary directory exists
        fs.existsSync(tmpDir).should.be.true();

        // When I abort the transaction
        await transactionManager.abortTransaction();

        // Then the temporary directory should be cleaned up
        fs.existsSync(tmpDir).should.be.false();
    });

    it("should rollback moved files if an operation fails", async () => {
        // Given an existing file at the destination
        const tmpDir = await transactionManager.getTmpDir();

        await fs.promises.writeFile(destFile, "Original Content", "utf8");

        const _destPath2 = path.join(tempDir, "dest2.txt");

        // When I stage a change that will overwrite the destination
        await transactionManager.stageFile(destFile, "New Content", "utf8");

        // And I add a failing operation
        transactionManager.addFileOp(async () => {
            throw new Error("Intentional failure");
        });

        // Then there should be two pending tasks
        transactionManager.pendingTasksCount.should.eql(2);

        // When I apply the file operations
        try {
            await transactionManager.applyFileOps();
            should.ok(false, "applyFileOps should have thrown");
        } catch (err) {
            // Then it should throw an error
            should.exist(err);
            (err as Error).message.should.eql("Intentional failure");
        }

        // And the transaction should roll back, restoring the original content
        const restoredContent = await fs.promises.readFile(destFile, "utf8");
        restoredContent.should.eql("Original Content");

        // And the temporary directory should be cleaned up
        fs.existsSync(tmpDir).should.be.false();
    });

    it("should correctly backup and rollback previously existing files when a 3-step transaction fails at the end", async () => {
        // Given three existing files
        const file1 = path.join(tempDir, "file1.txt");
        const file2 = path.join(tempDir, "file2.txt");
        const file3 = path.join(tempDir, "file3.txt");

        await fs.promises.writeFile(file1, "Content 1", "utf8");
        await fs.promises.writeFile(file2, "Content 2", "utf8");
        await fs.promises.writeFile(file3, "Content 3", "utf8");

        const tmpDir = await transactionManager.getTmpDir();

        // When I stage a change for the first file
        await transactionManager.stageFile(file1, "New Content 1", "utf8");

        // And I stage a change for the second file
        await transactionManager.stageFile(file2, "New Content 2", "utf8");

        // And I add a failing operation for the third step
        transactionManager.addFileOp(async () => {
            throw new Error("Intentional failure on Step 3");
        });

        // Then there should be three pending tasks
        transactionManager.pendingTasksCount.should.eql(3);

        // When I apply the file operations
        try {
            await transactionManager.applyFileOps();
            should.ok(false, "applyFileOps should have thrown");
        } catch (err) {
            // Then it should throw an error
            should.exist(err);
            (err as Error).message.should.eql("Intentional failure on Step 3");
        }

        // And the transaction should roll back, restoring the original content of all files
        const restored1 = await fs.promises.readFile(file1, "utf8");
        restored1.should.eql("Content 1");

        const restored2 = await fs.promises.readFile(file2, "utf8");
        restored2.should.eql("Content 2");

        const restored3 = await fs.promises.readFile(file3, "utf8");
        restored3.should.eql("Content 3");

        // And the temporary directory should be cleaned up
        fs.existsSync(tmpDir).should.be.false();
    });
    it("should execute cleanup tasks during applyFileOps and still have access to the temp folder", async () => {
        const manager = new FileTransactionManager();
        const tmpDir = await manager.getTmpDir();

        let cleanupExecuted = false;
        let tmpDirExistedDuringCleanup = false;

        manager.addCleanupTask(async () => {
            cleanupExecuted = true;
            tmpDirExistedDuringCleanup = fs.existsSync(tmpDir); // Should exist while cleanup tasks run
        });

        // When: Execute the transaction successfully
        await manager.applyFileOps();

        // Then: The cleanup task should have run
        cleanupExecuted.should.be.true("Cleanup task was not executed");
        tmpDirExistedDuringCleanup.should.be.true("Temp folder was deleted BEFORE cleanup tasks ran");

        // And: The temp folder should be deleted afterwards
        fs.existsSync(tmpDir).should.be.false("Temp folder was not deleted AFTER cleanup tasks ran");
    });

    it("should execute cleanup tasks during abortTransaction and still have access to the temp folder", async () => {
        const manager = new FileTransactionManager();
        const tmpDir = await manager.getTmpDir();

        let cleanupExecuted = false;
        let tmpDirExistedDuringCleanup = false;

        manager.addCleanupTask(async () => {
            cleanupExecuted = true;
            tmpDirExistedDuringCleanup = fs.existsSync(tmpDir); // Should exist while cleanup tasks run
        });

        // When: Abort the transaction
        await manager.abortTransaction();

        // Then: The cleanup task should have run
        cleanupExecuted.should.be.true("Cleanup task was not executed");
        tmpDirExistedDuringCleanup.should.be.true("Temp folder was deleted BEFORE cleanup tasks ran");

        // And: The temp folder should be deleted afterwards
        fs.existsSync(tmpDir).should.be.false("Temp folder was not deleted AFTER cleanup tasks ran");
    });
});
