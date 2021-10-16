import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { OPCUASecureObject } from "node-opcua-common";

import {
    Certificate,
    convertPEMtoDER,
    exploreCertificate,
    explorePrivateKey,
    publicKeyAndPrivateKeyMatches
} from "node-opcua-crypto";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = make_warningLog(__filename);

export function verifyIsOPCUAValidCertificate(
    certificate: Certificate,
    certificateFile: string,
    type: "client" | "server",
    applicationUri: string
): void {
    const certificateInfo = exploreCertificate(certificate);
    const now = new Date();

    if (certificateInfo.tbsCertificate.validity.notBefore.getTime() > now.getTime()) {
        // check that certificate is active
        // certificate is not active yet
        warningLog(
            `[NODE-OPCUA-W02] The certificate is not active yet\n` +
                `notBefore       ${certificateInfo.tbsCertificate.validity.notBefore.toISOString()}\n` +
                `certificateFile ${certificateFile}`
        );
    }
    //  check that certificate has not expired
    if (certificateInfo.tbsCertificate.validity.notAfter.getTime() <= now.getTime()) {
        // certificate is obsolete
        warningLog(
            `[NODE-OPCUA-W03] The certificate has expired\n` +
                `Please regenerate a valid certificate\n` +
                `notAfter       = ${certificateInfo.tbsCertificate.validity.notAfter.toISOString()}\n` +
                `certificateFile= ${certificateFile}`
        );
    } else {
        const tenDays = 10 * 24 * 60 * 60 * 1000;
        if (certificateInfo.tbsCertificate.validity.notAfter.getTime() <= now.getTime() + tenDays) {
            // certificate is going to expired very soon
            warningLog(
                `[NODE-OPCUA-W05] The certificate is about to expire in less than 10 days.\n` +
                    `Please regenerate a valid certificate as soon as possible\n` +
                    `notAfter       = ${certificateInfo.tbsCertificate.validity.notAfter.toISOString()}\n` +
                    `certificateFile= ${certificateFile}\n`
            );
        }
    }
    // check that server certificate matches Application URI
    const uniformResourceIdentifier = certificateInfo?.tbsCertificate?.extensions?.subjectAltName?.uniformResourceIdentifier;
    if (!uniformResourceIdentifier) {
        warningLog(
            `[NODE-OPCUA-W14] The certificate subjectAltName uniformResourceIdentifier is missing.\n` +
                `Please regenerate a specific certificate with a uniformResourceIdentifier that matches your ${type} applicationUri\n` +
                `applicationUri  = ${applicationUri}\n` +
                `certificateFile = ${certificateFile}\n`
        );
        return;
    } else if (uniformResourceIdentifier[0] !== applicationUri) {
        warningLog(
            `[NODE-OPCUA-W06] The certificate subjectAltName does not match the ${type} applicationUri\n` +
                `Please regenerate a specific certificate that matches your ${type} applicationUri\n` +
                `certificate subjectAltName  = ${uniformResourceIdentifier[0]}\n` +
                `${type} applicationUri  = ${applicationUri}\n` +
                `certificateFile         = ${certificateFile}\n`
        );
    }
    const keyUsage = certificateInfo.tbsCertificate.extensions?.keyUsage;
    if (!keyUsage) {
        warningLog(`[NODE-OPCUA-W15] The certificate keyUsage is missing\n` + `certificateFile = ${certificateFile}`);
    } else {
        // spec says that certificate shall include digitalSignature, nonRepudiation, keyEncipherment and dataEncipherment.
        // Other key uses are allowed.
        if (!keyUsage.digitalSignature || !keyUsage.nonRepudiation || !keyUsage.keyEncipherment || !keyUsage.dataEncipherment) {
            warningLog(
                `[NODE-OPCUA-W16] The certificate keyUsage must include digitalSignature, nonRepudiation, keyEncipherment and dataEncipherment.\n` +
                    `see https://reference.opcfoundation.org/v104/Core/docs/Part6/6.2.2/\n` +
                    `certificateFile = ${certificateFile}`
            );
        }
    }
    const extKeyUsage = certificateInfo.tbsCertificate.extensions?.extKeyUsage;
    if (!extKeyUsage) {
        warningLog(`[NODE-OPCUA-W17] The certificate extKeyUsage is missing\n` + `certificateFile = ${certificateFile}`);
    } else {
        // spec says that certificate shall include digitalSignature, nonRepudiation, keyEncipherment and dataEncipherment.
        // Other key uses are allowed.
        if (!extKeyUsage.clientAuth && !extKeyUsage.serverAuth) {
            warningLog(
                `[NODE-OPCUA-W18] The certificate extKeyUsage must include clientAuth and/or serverAuth.\n` +
                    `see https://reference.opcfoundation.org/v104/Core/docs/Part6/6.2.2/\n` +
                    `certificateFile = ${certificateFile}`
            );
        }
    }

    const keyLengthInBits = certificateInfo.tbsCertificate.subjectPublicKeyInfo.keyLength * 8;
    if (keyLengthInBits < 1024) {
        errorLog(
            `[NODE-OPCUA-W19] The public key length shall be greater than or equal to 1024 bits. key length is ${keyLengthInBits}.\n` +
                `see https://reference.opcfoundation.org/v104/GDS/docs/7.6.3/\n` +
                `certificateFile = ${certificateFile}`
        );
    } else if (keyLengthInBits < 2048) {
        warningLog(
            `[NODE-OPCUA-W23] key lengths less than 2048 are considered insecure. key length is ${keyLengthInBits}\n` +
                `see https://reference.opcfoundation.org/v104/Core/docs/Part2/6.8/\n` +
                `certificateFile = ${certificateFile}`
        );
    }
}

export async function performCertificateSanityCheck(
    this: OPCUASecureObject,
    serverOrClient: "server" | "client",
    certificateManager: OPCUACertificateManager,
    applicationUri: string
): Promise<void> {
    // verify that certificate is matching private key, and inform the developper if not
    const certificate = this.getCertificate();
    const privateKey = convertPEMtoDER(this.getPrivateKey());
    //
    if (!publicKeyAndPrivateKeyMatches(certificate, privateKey)) {
        errorLog("[NODE-OPCUA-E01] Configuration error : the certificate and the private key do not match !");
        errorLog("                  please check the configuration of the OPCUA Server");
        errorLog("                    privateKey= ", this.privateKeyFile);
        errorLog(" certificateManager.privateKey= ", certificateManager.privateKey);
        errorLog("               certificateFile= ", this.certificateFile);
        throw new Error(
            "[NODE-OPCUA-E01] Configuration error : the certificate and the private key do not match ! please fix your configuration"
        );
    }
    // verify that the certificate provided has the right key length ( at least 2048)
    const privateKeyInfo = explorePrivateKey(privateKey);
    const keyLengthInBits = privateKeyInfo.modulus.length * 8;
    if (keyLengthInBits <= 1024) {
        warningLog(
            `[NODE-OPCUA-W04] The public/private key pair uses a key length which is equal or lower than 1024 bits. ( key length was ${keyLengthInBits} )\n` +
                `OPCUA version 1.04 requires that security key length are greater or equal to 2048 bits.\n` +
                `The ${serverOrClient} is operating at risk.                                             `
        );
    }
    // verify that the certificate has a valid date and has expected extensions fields such as DNS and IP.
    const status1 = await certificateManager.trustCertificate(certificate);
    const status = await certificateManager.verifyCertificateAsync(certificate);

    if (status !== "Good") {
        warningLog("[NODE-OPCUA-W04] Warning: the certificate status is = ", status, " file = ", this.certificateFile);
    }

    verifyIsOPCUAValidCertificate(certificate, this.certificateFile, serverOrClient, applicationUri);
}
