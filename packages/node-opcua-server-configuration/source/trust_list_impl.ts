/**
 * @module node-opcua-server-configuration
 */
import { ITrustList } from "./trust_list";

export class TrustList implements ITrustList {

    public async closeAndUpdate(
      fileHandle: number
    ): Promise<boolean> {

        return false;
    }

    public async addCertificate(
      certificate: Buffer,
      isTrustedCertificate: boolean
    ): Promise<void> {
        return;
    }

    public async removeCertificate(
      thumbprint: string,
      isTrustedCertificate: boolean
    ): Promise<void> {
        return;
    }
}
