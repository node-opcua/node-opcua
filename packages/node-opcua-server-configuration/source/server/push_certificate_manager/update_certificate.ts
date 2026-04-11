import fs from "node:fs";
import path from "node:path";
import { assert } from "node-opcua-assert";
import type { ByteString } from "node-opcua-basic-types";
import type { CertificateManager, OPCUACertificateManager } from "node-opcua-certificate-manager";
import { exploreCertificate, readPrivateKey } from "node-opcua-crypto";
import {
    certificateMatchesPrivateKey,
    type Certificate,
    coercePEMorDerToPrivateKey,
    coercePrivateKeyPem,
    combine_der,
    makeSHA1Thumbprint,
    type PrivateKey,
    toPem
} from "node-opcua-crypto/web";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import type { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";

import type { UpdateCertificateResult } from "../../push_certificate_manager.js";
import { validateCertificateAndChain } from "../certificate_validation.js";
import type { PushCertificateManagerInternalContext } from "./internal_context.js";
import { findCertificateGroupName, resolveCertificateGroupContext, validateCertificateType } from "./util.js";

const warningLog = make_warningLog("ServerConfiguration");
const debugLog = make_debugLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");

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

            doDebug && debugLog(`Staged issuer certificate ${i + 1}/${issuerCertificates.length}: ${thumbprint}`);
        }
    }
}

// Helper: Stage main certificate to temporary files
//
// The PEM file contains the full chain (leaf + issuer CAs) so that
// getCertificateChain() returns the complete chain.  This allows
// OpenSecureChannel and CreateSession to present the full chain to
// connecting clients, enabling them to build and verify the trust
// path without needing all CA certificates pre-installed.
async function preInstallCertificate(
    serverImpl: PushCertificateManagerInternalContext,
    certificateManager: CertificateManager,
    certificate: Certificate,
    issuerCertificates?: Certificate[]
): Promise<void> {
    const certFolder = certificateManager.ownCertFolder;
    const destPEM = path.join(certFolder, "certificate.pem");

    // Build the full chain: leaf first, then issuer CAs
    const certificateChain: Certificate[] = [certificate, ...(issuerCertificates ?? [])];
    const certificatePEM = toPem(combine_der(certificateChain), "CERTIFICATE");

    await serverImpl.fileTransactionManager.stageFile(destPEM, certificatePEM, "utf-8");

    // Clean up any leftover certificate.der from previous installations.
    // Since DER is no longer written, a stale file would be misleading.
    const legacyDER = path.join(certFolder, "certificate.der");
    if (fs.existsSync(legacyDER)) {
        serverImpl.fileTransactionManager.stageFileRemoval(legacyDER);
    }
}

// Helper: Stage private key to temporary file
async function preInstallPrivateKey(
    serverImpl: PushCertificateManagerInternalContext,
    certificateManager: CertificateManager,
    privateKeyFormat: string,
    privateKey: Buffer | string | undefined
): Promise<void> {
    assert(privateKeyFormat.toUpperCase() === "PEM");

    if (privateKey) {
        const privateKeyObj = coercePEMorDerToPrivateKey(privateKey as string | Buffer);
        const privateKeyPEM = coercePrivateKeyPem(privateKeyObj);
        await serverImpl.fileTransactionManager.stageFile(certificateManager.privateKey, privateKeyPEM, "utf-8");
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

        if (!validateCertificateType(certificate, certificateTypeId, allowedTypes ?? [], warningLog)) {
            try {
                const info = exploreCertificate(certificate);
                const groupName = findCertificateGroupName(certificateGroupId);
                const certInfoStr = `subject: ${info.tbsCertificate.subject.commonName}, issuer: ${info.tbsCertificate.issuer.commonName}, validFrom: ${info.tbsCertificate.validity.notBefore.toISOString()}, validTo: ${info.tbsCertificate.validity.notAfter.toISOString()}`;

                warningLog(
                    `Certificate type ${certificateTypeId} does not match expected certificateTypeId for group '${groupName}' (${certificateGroupId.toString()})\n allowed types: ${allowedTypes?.map((t) => t.toString()).join(", ")} \n provided certificate: ${certInfoStr}`
                );
            } catch (err) {
                // Fallback if certificate parsing fails
                warningLog(
                    `Certificate type ${certificateTypeId} does not match expected certificateTypeId for group '${certificateGroupId.toString()}'\n allowed types: ${allowedTypes?.map((t) => t.toString()).join(", ")} \n certificate could not be explored. ${(err as Error).message}`
                );
            }
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

        doDebug && debugLog(" updateCertificate ", makeSHA1Thumbprint(certificate).toString("hex"));

        const hasPrivateKeyFormat = privateKeyFormat !== undefined && privateKeyFormat !== null && privateKeyFormat !== "";
        const hasPrivateKey =
            privateKey !== undefined &&
            privateKey !== null &&
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
            await preInstallCertificate(serverImpl, certificateManager, certificate, issuerCertificates);
            serverImpl.emit("certificateUpdated", certificateGroupId, certificate);
            return { statusCode: StatusCodes.Good, applyChangesRequired: true };
        } else {
            if (privateKeyFormat !== "PEM" && privateKeyFormat !== "PFX") {
                warningLog(` the private key format is invalid privateKeyFormat =${privateKeyFormat}`);
                await serverImpl.fileTransactionManager.abortTransaction();
                return { statusCode: StatusCodes.BadNotSupported, applyChangesRequired: false };
            }
            if (privateKeyFormat !== "PEM") {
                warningLog(`in NodeOPCUA we only support PEM for the moment privateKeyFormat =${privateKeyFormat}`);
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

            await preInstallPrivateKey(serverImpl, certificateManager, privateKeyFormat, tempPrivateKey);
            await preInstallIssuerCertificates(serverImpl, certificateManager, issuerCertificates);
            await preInstallCertificate(serverImpl, certificateManager, certificate, issuerCertificates);

            serverImpl.emit("certificateUpdated", certificateGroupId, certificate);
            return { statusCode: StatusCodes.Good, applyChangesRequired: true };
        }
    } finally {
        serverImpl.operationInProgress = false;
    }
}
