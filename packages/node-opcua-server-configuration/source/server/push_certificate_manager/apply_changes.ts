import { StatusCodes, StatusCode } from "node-opcua-status-code";
import { errorLog, debugLog } from "../push_certificate_manager_server_impl";
import { PushCertificateManagerInternalContext } from "./internal_context";

// Helper: Flush action queue
async function flushActionQueue(serverImpl: PushCertificateManagerInternalContext): Promise<void> {
    while (serverImpl.actionQueue.length) {
        const first = serverImpl.actionQueue.pop()!;
        await first!();
    }
}

export async function executeApplyChanges(serverImpl: PushCertificateManagerInternalContext): Promise<StatusCode> {
    // ApplyChanges is used to tell the Server to apply any security changes.
    // This Method should only be called if a previous call to a Method that changed the
    // configuration returns applyChangesRequired=true.

    if (serverImpl.operationInProgress) {
        return StatusCodes.BadTooManyOperations;
    }

    // Check if there are any pending tasks
    if (serverImpl.fileTransactionManager.pendingTasksCount === 0 && serverImpl.actionQueue.length === 0) {
        // If ApplyChanges is called and there is no active transaction then return Bad_NothingToDo
        return StatusCodes.BadNothingToDo;
    }

    serverImpl.operationInProgress = true;
    try {
        try {
            serverImpl.emit("CertificateAboutToChange", serverImpl.actionQueue);
        } catch (err) {
            errorLog("Event listener error:", (err as Error).message);
        }
        await flushActionQueue(serverImpl);

        try {
            await serverImpl.fileTransactionManager.applyFileOps();
        } catch (err) {
            await serverImpl.fileTransactionManager.abortTransaction();
            debugLog("err ", (err as Error).message);
            return StatusCodes.BadInternalError;
        }
        try {
            serverImpl.emit("CertificateChanged", serverImpl.actionQueue);
        } catch (err) {
            errorLog("Event listener error:", (err as Error).message);
        }
        await flushActionQueue(serverImpl);

        // Dispose and clear temporary certificate manager after applying changes
        if (serverImpl.tmpCertificateManager) {
            await serverImpl.tmpCertificateManager.dispose();
        }
        serverImpl.tmpCertificateManager = undefined;
        return StatusCodes.Good;
    } finally {
        serverImpl.operationInProgress = false;
    }
}
