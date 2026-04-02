import { AsymmetricAlgorithmSecurityHeader, type MessageSecurityMode, type SecurityPolicy } from "node-opcua-secure-channel";

export interface IChannelData {
    channelId: number | null;
    clientCertificate: Buffer | null;
    securityMode: MessageSecurityMode;
    securityPolicy: SecurityPolicy;
    timeout: number;
    transactionsCount: number;
}
