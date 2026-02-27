import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CertificateManager } from "node-opcua-certificate-manager";
import { convertPEMtoDER, type DirectoryName, exploreCertificate, readCertificate } from "node-opcua-crypto";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import type { SubjectOptions } from "node-opcua-pki";
import { StatusCodes } from "node-opcua-status-code";

import type { CreateSigningRequestResult } from "../../push_certificate_manager.js";
import type { PushCertificateManagerInternalContext } from "./internal_context.js";
import { subjectToString } from "./subject_to_string.js";
import { resolveCertificateGroupContext } from "./util.js";

const warningLog = make_warningLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");
const debugLog = make_debugLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");

export async function executeCreateSigningRequest(
    serverImpl: PushCertificateManagerInternalContext,
    certificateGroupId: NodeId | string,
    certificateTypeId: NodeId | string,
    subjectName: string | SubjectOptions | null,
    regeneratePrivateKey?: boolean,
    nonce?: Buffer
): Promise<CreateSigningRequestResult> {
    // Resolve context using our util
    const context = resolveCertificateGroupContext(serverImpl, certificateGroupId);
    if (context.statusCode.isNotGood() || !context.certificateManager) {
        doDebug && debugLog(" cannot find group ", certificateGroupId);
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    const { certificateManager, allowedTypes } = context;

    // Validate Certificate Type
    if (certificateTypeId) {
        let typeNodeId: NodeId;
        if (typeof certificateTypeId === "string") {
            if (certificateTypeId !== "") {
                try {
                    typeNodeId = resolveNodeId(certificateTypeId);
                } catch {
                    warningLog("Invalid certificateTypeId string:", certificateTypeId);
                    return { statusCode: StatusCodes.BadInvalidArgument };
                }
                if (!sameNodeId(typeNodeId, NodeId.nullNodeId)) {
                    const isValidType = allowedTypes?.some((t) => sameNodeId(t, typeNodeId));
                    if (!isValidType) {
                        warningLog("certificateTypeId is not in the allowed types for this certificate group:", certificateTypeId);
                        return { statusCode: StatusCodes.BadNotSupported };
                    }
                }
            }
        } else {
            typeNodeId = certificateTypeId;
            if (!sameNodeId(typeNodeId, NodeId.nullNodeId)) {
                const isValidType = allowedTypes?.some((t) => sameNodeId(t, typeNodeId));
                if (!isValidType) {
                    warningLog("certificateTypeId is not in the allowed types for this certificate group:", certificateTypeId);
                    return { statusCode: StatusCodes.BadNotSupported };
                }
            }
        }
    }

    // Resolve Subject Name
    if (!subjectName) {
        const currentCertificateFilename = path.join(certificateManager.rootDir, "own/certs/certificate.pem");
        try {
            const certificate = readCertificate(currentCertificateFilename);
            const e = exploreCertificate(certificate);
            subjectName = subjectToString(e.tbsCertificate.subject as SubjectOptions & DirectoryName);
            warningLog("reusing existing certificate subjectName = ", subjectName);
        } catch (err) {
            errorLog(
                "Cannot find existing certificate to extract subjectName",
                currentCertificateFilename,
                ":",
                (err as Error).message
            );
            return { statusCode: StatusCodes.BadInvalidState };
        }
    }

    if (typeof subjectName !== "string") {
        return { statusCode: StatusCodes.BadInternalError };
    }

    // Regenerate Private Key Logic
    if (regeneratePrivateKey) {
        if (!nonce || nonce.length < 32) {
            warningLog("nonce should be provided when regeneratePrivateKey is set, and length shall be at least 32 bytes");
            return { statusCode: StatusCodes.BadInvalidArgument };
        }

        const volatileTmp = await serverImpl.fileTransactionManager.getTmpDir();
        const tmpPKI = path.join(volatileTmp, `pki${crypto.randomUUID()}`);

        const tempCertificateManager = new CertificateManager({
            keySize: certificateManager.keySize,
            location: tmpPKI
        });

        doDebug && debugLog("generating a new private key ...");
        await tempCertificateManager.initialize();

        serverImpl.tmpCertificateManager = tempCertificateManager;

        const generatedPrivateKeyPEM = await fs.promises.readFile(tempCertificateManager.privateKey, "utf8");
        await serverImpl.fileTransactionManager.stageFile(certificateManager.privateKey, generatedPrivateKeyPEM, "utf8");

        serverImpl.fileTransactionManager.addCleanupTask(async () => {
            await tempCertificateManager.dispose();
            serverImpl.tmpCertificateManager = undefined;
        });
    }

    const options = {
        applicationUri: serverImpl.applicationUri,
        subject: subjectName
    };

    const activeCertificateManager = serverImpl.tmpCertificateManager || certificateManager;

    await activeCertificateManager.initialize();
    const csrFile = await activeCertificateManager.createCertificateRequest(options);
    const csrPEM = await fs.promises.readFile(csrFile, "utf8");
    const certificateSigningRequest = convertPEMtoDER(csrPEM);

    return {
        certificateSigningRequest,
        statusCode: StatusCodes.Good
    };
}
