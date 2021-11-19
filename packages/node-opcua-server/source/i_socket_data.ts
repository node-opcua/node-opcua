export interface ISocketData {
    bytesRead: number;
    bytesWritten: number;
    localAddress?: string;
    localPort?: number;
    remoteAddress?: string;
    remoteFamily?: string;
    remotePort?: number;
    timestamp: Date;
    reason: string;
}
