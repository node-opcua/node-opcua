import { AsymmetricAlgorithmSecurityHeader, MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";

export interface IChannelData {
    channelId: number | null;
    clientCertificate: Buffer | null;
    clientNonce: Buffer | null;
    clientSecurityHeader: any;
    securityHeader: AsymmetricAlgorithmSecurityHeader | null;
    securityMode: MessageSecurityMode;
    securityPolicy: SecurityPolicy;
    timeout: number;
    transactionsCount: number;
}
