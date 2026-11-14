import type { MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";
export interface IChannelData {
    channelId: number | null;
    clientCertificate: Buffer | null;
    securityMode: MessageSecurityMode;
    securityPolicy: SecurityPolicy;
    timeout: number;
    transactionsCount: number;
}
//# sourceMappingURL=i_channel_data.d.ts.map