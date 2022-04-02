import { OPCUACertificateManager } from "./certificate_manager";

export function makeSubject(applicationName: string, hostname: string): string{
    const commonName = `${applicationName}@${hostname}`.substring(0, 63);
    const dc = `${hostname}`.substring(63);
    return `/CN=${commonName}` + `/DC=${dc}` + OPCUACertificateManager.defaultCertificateSubject;
}
