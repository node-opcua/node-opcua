import { OPCUACertificateManager } from "./certificate_manager";

export function makeSubject(applicationName: string, hostname: string): string{
    const commonName = `${applicationName}@${hostname}`.substr(0, 63);
    const dc = `${hostname}`.substr(63);
    return `/CN=${commonName}` + `/DC=${dc}` + OPCUACertificateManager.defaultCertificateSubject;
}
