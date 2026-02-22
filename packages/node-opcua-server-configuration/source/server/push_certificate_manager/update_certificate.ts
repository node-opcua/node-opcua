import { StatusCodes } from "node-opcua-status-code";
import { NodeId } from "node-opcua-nodeid";
import { ByteString } from "node-opcua-basic-types";
import { UpdateCertificateResult } from "../../push_certificate_manager";
import { CertificateManager, OPCUACertificateManager } from "node-opcua-certificate-manager";
import {
    exploreCertificate,
    makeSHA1Thumbprint,
    toPem,
    PrivateKey,
    certificateMatchesPrivateKey,
    coercePEMorDerToPrivateKey,
    coercePrivateKeyPem
} from "node-opcua-crypto/web";
import { readPrivateKey } from "node-opcua-crypto";
import * as path from "path";
import * as fs from "fs";
import { assert } from "node-opcua-assert";
import {
    warningLog,
    debugLog
} from "../push_certificate_manager_server_impl";
import { PushCertificateManagerInternalContext } from "./internal_context";
import {
    validateCertificateType,
    resolveCertificateGroupContext
} from "./util";
import { validateCertificateAndChain } from "../certificate_validation";

// Helper: Stage issuer certificates to temporary files
async function preInstallIssuerCertificates(
    serverImpl: PushCertificateManagerInternalContext,
    certificateManager: CertificateManager,
    issuerCertificates: ByteString[] | undefined
): Promise<void> {
    if (issuerCertificates && issuerCertificates.length > 0) {
        const issuerFolder = certificateManager.issuersCertFolder;
        await fs.promises.mkdir(issuerFolder, { recursive: true });

        for (let i = 0; i < issuerCertificates.length; i++) {
            const issuerCert = issuerCertificates[i];
            const thumbprint = makeSHA1Thumbprint(issuerCert).toString("hex");

            const finalIssuerFileDER = path.join(issuerFolder, `issuer_${thumbprint}.der`);
            const finalIssuerFilePEM = path.join(issuerFolder, `issuer_${thumbprint}.pem`);
            const issuerCertPEM = toPem(issuerCert, "CERTIFICATE");

            await serverImpl.fileTransactionManager.stageFile(finalIssuerFileDER, issuerCert);
            await serverImpl.fileTransactionManager.stageFile(finalIssuerFilePEM, issuerCertPEM, "utf-8");

            debugLog(`Staged issuer certificate ${i + 1}/${issuerCertificates.length}: ${thumbprint}`);
        }
    }
}

// Helper: Stage main certificate to temporary files
async function preInstallCertificate(
    serverImpl: PushCertificateManagerInternalContext,
    certificateManager: CertificateManager,
    certificate: Buffer
): Promise<void> {
    const certFolder = certificateManager.ownCertFolder;
    const destDER = path.join(certFolder, "certificate.der");
    const destPEM = path.join(certFolder, "certificate.pem");
    const certificatePEM = toPem(certificate, "CERTIFICATE");

    await serverImpl.fileTransactionManager.stageFile(destDER, certificate);
    await serverImpl.fileTransactionManager.stageFile(destPEM, certificatePEM, "utf-8");
}

// Helper: Stage private key to temporary file
async function preInstallPrivateKey(
    serverImpl: PushCertificateManagerInternalContext,
    certificateManager: CertificateManager,
    privateKeyFormat: string,
    privateKey: Buffer | string
): Promise<void> {
    assert(privateKeyFormat.toUpperCase() === "PEM");

    if (privateKey) {
        const privateKeyObj = coercePEMorDerToPrivateKey(privateKey as string | Buffer);
        const privateKeyPEM = coercePrivateKeyPem(privateKeyObj);
        await serverImpl.fileTransactionManager.stageFile(
            certificateManager.privateKey,
            privateKeyPEM,
            "utf-8"
        );
    }
}

// Main Execute Function
export async function executeUpdateCertificate(
    serverImpl: PushCertificateManagerInternalContext,
    certificateGroupId: NodeId | string,
    certificateTypeId: NodeId | string,
    certificate: Buffer,
    issuerCertificates: ByteString[],
    privateKeyFormat?: string,
    privateKey?: Buffer | string
): Promise<UpdateCertificateResult> {

    if (serverImpl.operationInProgress) {
        return { statusCode: StatusCodes.BadTooManyOperations, applyChangesRequired: false };
    }

    serverImpl.operationInProgress = true;
    try {
        const context = resolveCertificateGroupContext(serverImpl, certificateGroupId);
        if (context.statusCode.isNotGood() || !context.certificateManager) {
            debugLog(" cannot find group ", certificateGroupId);
            return { statusCode: StatusCodes.BadInvalidArgument, applyChangesRequired: false };
        }

        const { certificateManager, allowedTypes } = context;

        if (!validateCertificateType(certificate, certificateTypeId, allowedTypes!, warningLog)) {
            warningLog(`Certificate type ${certificateTypeId} does not match expected certificateTypeId \n allowed types: ${allowedTypes!.map(t => t.toString()).join(", ")} \n certificate: ${certificate.toString("base64")}`);
            return { statusCode: StatusCodes.BadCertificateInvalid, applyChangesRequired: false };
        }

        const isApplicationGroup = certificateManager === serverImpl.applicationGroup;
        const validationResult = await validateCertificateAndChain(
            certificateManager as OPCUACertificateManager,
            isApplicationGroup,
            certificate,
            issuerCertificates
        );

        if (validationResult.statusCode !== StatusCodes.Good) {
            await serverImpl.fileTransactionManager.abortTransaction();
            return { statusCode: validationResult.statusCode, applyChangesRequired: false };
        }

        debugLog(" updateCertificate ", makeSHA1Thumbprint(certificate).toString("hex"));

        const hasPrivateKeyFormat = privateKeyFormat !== undefined && privateKeyFormat !== null && privateKeyFormat !== "";
        const hasPrivateKey = privateKey !== undefined && privateKey !== null &&
            privateKey !== "" &&
            !(privateKey instanceof Buffer && privateKey.length === 0);

        if (hasPrivateKeyFormat !== hasPrivateKey) {
            warningLog("privateKeyFormat and privateKey must both be provided or both be omitted");
            await serverImpl.fileTransactionManager.abortTransaction();
            return { statusCode: StatusCodes.BadInvalidArgument, applyChangesRequired: false };
        }

        if (!hasPrivateKeyFormat && !hasPrivateKey) {
            const privateKeyObj = readPrivateKey(
                serverImpl.tmpCertificateManager ? serverImpl.tmpCertificateManager.privateKey : certificateManager.privateKey
            );

            if (!certificateMatchesPrivateKey(certificate, privateKeyObj)) {
                warningLog("certificate doesn't match privateKey");
                await serverImpl.fileTransactionManager.abortTransaction();
                return { statusCode: StatusCodes.BadSecurityChecksFailed, applyChangesRequired: false };
            }

            await preInstallIssuerCertificates(serverImpl, certificateManager, issuerCertificates);
            await preInstallCertificate(serverImpl, certificateManager, certificate);
            return { statusCode: StatusCodes.Good, applyChangesRequired: true };
        } else {
            if (privateKeyFormat !== "PEM" && privateKeyFormat !== "PFX") {
                warningLog(" the private key format is invalid privateKeyFormat =" + privateKeyFormat);
                await serverImpl.fileTransactionManager.abortTransaction();
                return { statusCode: StatusCodes.BadNotSupported, applyChangesRequired: false };
            }
            if (privateKeyFormat !== "PEM") {
                warningLog("in NodeOPCUA we only support PEM for the moment privateKeyFormat =" + privateKeyFormat);
                await serverImpl.fileTransactionManager.abortTransaction();
                return { statusCode: StatusCodes.BadNotSupported, applyChangesRequired: false };
            }

            let privateKeyObj: PrivateKey | undefined;
            let tempPrivateKey = privateKey;

            if (tempPrivateKey instanceof Buffer || typeof tempPrivateKey === "string") {
                if (tempPrivateKey instanceof Buffer) {
                    assert(privateKeyFormat === "PEM");
                    tempPrivateKey = tempPrivateKey.toString("utf-8");
                }
                privateKeyObj = coercePEMorDerToPrivateKey(tempPrivateKey);
            }

            if (!privateKeyObj) {
                await serverImpl.fileTransactionManager.abortTransaction();
                return { statusCode: StatusCodes.BadNotSupported, applyChangesRequired: false };
            }

            if (!certificateMatchesPrivateKey(certificate, privateKeyObj)) {
                warningLog("certificate doesn't match privateKey");
                await serverImpl.fileTransactionManager.abortTransaction();
                return { statusCode: StatusCodes.BadSecurityChecksFailed, applyChangesRequired: false };
            }

            await preInstallPrivateKey(serverImpl, certificateManager, privateKeyFormat!, tempPrivateKey!);
            await preInstallIssuerCertificates(serverImpl, certificateManager, issuerCertificates);
            await preInstallCertificate(serverImpl, certificateManager, certificate);

            return { statusCode: StatusCodes.Good, applyChangesRequired: true };
        }
    } finally {
        serverImpl.operationInProgress = false;
    }
}
