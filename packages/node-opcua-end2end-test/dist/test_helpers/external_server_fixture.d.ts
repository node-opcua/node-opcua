import { type ChildProcess } from "node:child_process";
import type { ServerCapabilitiesOptions } from "node-opcua-server";
export interface ServerHandle {
    process: ChildProcess;
    pid_collected: number;
    endpointUrl: string;
    serverCertificate: Buffer;
}
export interface IStartServerOptions {
    silent?: boolean;
    env?: Record<string, string | undefined>;
    port?: number;
    server_sourcefile: string;
    maxConnectionsPerEndpoint?: number;
    nodeset_filename?: string[];
    serverCapabilities?: ServerCapabilitiesOptions;
    allowAnonymousSubscriptionTransferOnUnsecuredChannel?: boolean;
}
export declare function start_simple_server(options: IStartServerOptions): Promise<ServerHandle>;
export declare function stop_simple_server(serverHandle: ServerHandle): Promise<void>;
export declare function crash_simple_server(serverHandle: ServerHandle): Promise<void>;
//# sourceMappingURL=external_server_fixture.d.ts.map