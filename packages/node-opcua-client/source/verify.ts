import * as chalk from "chalk";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { OPCUASecureObject } from "node-opcua-common";

import { convertPEMtoDER, exploreCertificate, explorePrivateKey, publicKeyAndPrivateKeyMatches } from "node-opcua-crypto";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = make_warningLog(__filename);

export async function _verifyCertificate(
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
        errorLog(chalk.bgWhite.red("[NODE-OPCUA-E010] Configuration error : the certificate and the private key do not match !"));
        errorLog(chalk.bgWhite.red("                  please check the configuration of the OPCUA Server"));
        errorLog(chalk.bgWhite.red("                  privateKey= ", this.privateKeyFile));
        errorLog(chalk.bgWhite.red(" cerficateManager.privateKey= ", certificateManager.privateKey));
        errorLog(chalk.bgWhite.red("                  certificateFile= ", this.certificateFile));
        throw new Error("Configuration error : the certificate and the private key do not match ! please fix your configuration");
    }
    // verify that the certificate provided has the right key length ( at least 2048)
    const privateKeyInfo = explorePrivateKey(privateKey);
    if (privateKeyInfo.modulus.length <= 1024 / 8) {
        warningLog(
            chalk.yellowBright(
`[NODE-OPCUA-W04] The public/private key pair uses a key length which is equal or lower than 1024 bits. 
                 OPCUA version 1.04 requires that security key length are greater or equal to 2048 bits.  
                 The ${serverOrClient} is operating at risk.                                             `));
    }
    // verify that the certificate has a valid date and has expected extensions fields such as DNS and IP.
    const status1 = await certificateManager.trustCertificate(certificate); 
    const status = await certificateManager.verifyCertificateAsync(certificate);

    if (status !== "Good") {
        warningLog(chalk.yellowBright("[NODE-OPCUA-W04] Warning: the certificate status is = "), status, " file = ",  this.certificateFile);
    }

    const certificateInfo = exploreCertificate(certificate);
    const now = new Date();

    // check that certificate is active
    if (certificateInfo.tbsCertificate.validity.notBefore.getTime() > now.getTime()) {
        // certificate is not active yet
        warningLog(chalk.yellowBright(
`[NODE-OPCUA-W02] The certificate is not active yet
                 notBefore       ${certificateInfo.tbsCertificate.validity.notBefore.toISOString()}
                 certificateFile ${this.certificateFile}
`));
    }
    //  check that certificate has not expired
    if (certificateInfo.tbsCertificate.validity.notAfter.getTime() <= now.getTime()) {
        // certificate is obsolete
        warningLog(chalk.yellowBright(
`[NODE-OPCUA-W03] The certificate has expired
                 Please regenerate a valid certificate
                 notAfter       = ${certificateInfo.tbsCertificate.validity.notAfter.toISOString()}
                 certificateFile= ${this.certificateFile} `));
    } else {
        const tenDays = 10 * 24 * 60 * 60 * 1000;
        if (certificateInfo.tbsCertificate.validity.notAfter.getTime() <= now.getTime() + tenDays) {
            // certificate is going to expired very soon
            warningLog(chalk.yellowBright(
`[NODE-OPCUA-W05] The certificate is about to expire in less than 10 days
                 Please regenerate a valid certificate as soon as possible
                 notAfter       = ${certificateInfo.tbsCertificate.validity.notAfter.toISOString()}
                 certificateFile= ${this.certificateFile}`));
        }
    }
    // check that server certificate matches Application URI

    if (
        certificateInfo?.tbsCertificate?.extensions?.subjectAltName?.uniformResourceIdentifier[0] !== applicationUri
    ) {
        warningLog(
            chalk.yellowBright(
`[NODE-OPCUA-W06] The certificate subjectAltName does not match the server applicationUri
                 Please regenerate a specific certificate that matches your server applicationUri
                 certificate subjectAltName  = ${certificateInfo.tbsCertificate.extensions?.subjectAltName?.uniformResourceIdentifier[0]}
                 applicationUri  = ${applicationUri}
                 certificateFile = ${this.certificateFile}`));
    }
}
