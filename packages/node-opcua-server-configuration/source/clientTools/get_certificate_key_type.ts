import { exploreCertificate } from "node-opcua-crypto";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";

const debugLog = make_debugLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");
const warningLog = make_warningLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");

/**
 * Extract the key type from a certificate (RSA or ECC)
 * @param certificate The certificate to analyze
 * @returns "RSA" or "ECC" or null if unknown
 */
type AlgorithmIdentifierLike = {
    identifier?: string;
    oid?: string;
};

/**
 * Extract the algorithm identifier from an algorithm object or string
 * @param algorithm The algorithm to analyze
 * @returns The algorithm identifier as a string, or undefined if not found
 */
function getAlgorithmId(algorithm: unknown): string | undefined {
    if (typeof algorithm === "string") {
        return algorithm;
    }
    if (algorithm && typeof algorithm === "object") {
        const obj = algorithm as AlgorithmIdentifierLike;
        return obj.identifier ?? obj.oid;
    }
    return undefined;
}

/**
 * Extract the key type from a certificate (RSA or ECC)
 * @param certificate The certificate to analyze
 * @returns "RSA" or "ECC" or null if unknown
 */
export function getCertificateKeyType(certificate: Buffer): "RSA" | "ECC" | null {
    try {
        const certInfo = exploreCertificate(certificate);

        // Use subject public key algorithm to determine key type
        const publicKeyAlg = certInfo.tbsCertificate?.subjectPublicKeyInfo?.algorithm;
        doDebug && debugLog("Certificate subjectPublicKeyInfo.algorithm:", publicKeyAlg);

        const algorithmStr = getAlgorithmId(publicKeyAlg);

        if (!algorithmStr) {
            warningLog("Unable to extract public key algorithm from certificate");
            return null;
        }

        const algorithmLower = algorithmStr.toLowerCase();

        // RSA public key OID: 1.2.840.113549.1.1.1
        if (algorithmStr.startsWith("1.2.840.113549.1.1.1") || algorithmLower.includes("rsa")) {
            return "RSA";
        }

        // EC public key OID: 1.2.840.10045.2.1
        if (algorithmStr.startsWith("1.2.840.10045.2.1") || algorithmLower.includes("ec") || algorithmLower.includes("ecc")) {
            return "ECC";
        }

        warningLog("Unknown certificate public key algorithm:", algorithmStr);
        return null;
    } catch (err) {
        errorLog("Error extracting certificate key type:", (err as Error).message);
        return null;
    }
}
