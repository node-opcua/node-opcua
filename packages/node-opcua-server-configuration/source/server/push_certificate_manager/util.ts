import type { CertificateManager } from "node-opcua-certificate-manager";
import { NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { eccCertificateTypesArray, rsaCertificateTypesArray } from "../../clientTools/certificate_types";
import { getCertificateKeyType } from "../../clientTools/get_certificate_key_type";
import type { PushCertificateManagerInternalContext } from "./internal_context";

const defaultApplicationGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultApplicationGroup");
const defaultHttpsGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultHttpsGroup");
const defaultUserTokenGroup = resolveNodeId("ServerConfiguration_CertificateGroups_DefaultUserTokenGroup");

/**
 * Find the name of a certificate group based on its NodeId.
 * @param certificateGroupNodeId The NodeId of the certificate group
 * @returns The name of the certificate group (e.g. "DefaultApplicationGroup") or empty string if not recognized
 */
export function findCertificateGroupName(certificateGroupNodeId: NodeId | string): string {
    // Convert string to NodeId if needed to check for null NodeId
    let nodeId: NodeId;
    if (typeof certificateGroupNodeId === "string") {
        try {
            nodeId = resolveNodeId(certificateGroupNodeId);
        } catch {
            // Invalid NodeId string - treat as literal group name
            return certificateGroupNodeId;
        }
    } else {
        nodeId = certificateGroupNodeId;
    }

    // Check if it's null NodeId or DefaultApplicationGroup
    if (sameNodeId(nodeId, NodeId.nullNodeId) || sameNodeId(nodeId, defaultApplicationGroup)) {
        return "DefaultApplicationGroup";
    }
    if (sameNodeId(nodeId, defaultHttpsGroup)) {
        return "DefaultHttpsGroup";
    }
    if (sameNodeId(nodeId, defaultUserTokenGroup)) {
        return "DefaultUserTokenGroup";
    }

    // If it's a valid NodeId but not recognized, return empty string
    // If it was originally a string (and not a standard group), return the string as group name
    return typeof certificateGroupNodeId === "string" ? certificateGroupNodeId : "";
}

/**
 * Validate that the certificate type matches the expected type from certificateTypeId
 *
 * @param certificate The certificate to validate
 * @param certificateTypeId The NodeId of the expected certificate type
 * @param allowedTypes The list of allowed certificate types for this group
 * @param warningLog Function to log warnings
 * @returns true if valid or if validation is not applicable
 */
export function validateCertificateType(
    certificate: Buffer,
    certificateTypeId: NodeId | string,
    allowedTypes: NodeId[],
    warningLog: (msg: string, ...args: unknown[]) => void
): boolean {
    // If certificateTypeId is null or not specified, skip validation
    if (!certificateTypeId || (certificateTypeId instanceof NodeId && sameNodeId(certificateTypeId, NodeId.nullNodeId))) {
        return true;
    }

    const keyType = getCertificateKeyType(certificate);
    if (!keyType) {
        // If we can't determine the key type, allow it (backward compatibility)
        return true;
    }

    // Convert to NodeId if string
    let typeNodeId: NodeId;
    if (typeof certificateTypeId === "string") {
        try {
            typeNodeId = resolveNodeId(certificateTypeId);
        } catch {
            // Invalid NodeId string, skip validation
            return true;
        }
    } else {
        typeNodeId = certificateTypeId;
    }

    // Check again after conversion - empty string becomes null NodeId
    if (sameNodeId(typeNodeId, NodeId.nullNodeId)) {
        return true;
    }

    // Check if the certificateTypeId is in the list of allowed types for this group
    const isAllowed = allowedTypes.some((t) => sameNodeId(t, typeNodeId));

    if (!isAllowed) {
        warningLog("Certificate typeId is not in the allowed types for this certificate group:", certificateTypeId);
        return false;
    }

    // Additional validation: check if the certificate's actual key type matches the declared type
    const isRsaType = rsaCertificateTypesArray.some((t) => sameNodeId(t, typeNodeId));
    const isEccType = eccCertificateTypesArray.some((t) => sameNodeId(t, typeNodeId));

    if (keyType === "RSA" && !isRsaType) {
        warningLog("Certificate has RSA key but certificateTypeId is not an RSA type:", certificateTypeId);
        return false;
    }
    if (keyType === "ECC" && !isEccType) {
        warningLog("Certificate has ECC key but certificateTypeId is not an ECC type:", certificateTypeId);
        return false;
    }

    return true;
}

export interface ResolvedGroupContext {
    statusCode: StatusCode;
    certificateManager?: CertificateManager;
    allowedTypes?: NodeId[];
}

/**
 * Resolves the CertificateManager and its allowed types for a given certificate group
 */
export function resolveCertificateGroupContext(
    serverImpl: PushCertificateManagerInternalContext,
    certificateGroupId: NodeId | string
): ResolvedGroupContext {
    const groupName = findCertificateGroupName(certificateGroupId);
    if (!groupName) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    const certificateManager = serverImpl.getCertificateManager(groupName);
    if (!certificateManager) {
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    const allowedTypes = serverImpl.getCertificateTypes(groupName);

    return {
        statusCode: StatusCodes.Good,
        certificateManager,
        allowedTypes
    };
}
