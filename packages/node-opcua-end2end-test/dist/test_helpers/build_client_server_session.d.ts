import "should";
import { type ClientSession, OPCUAServer, type OPCUAServerOptions } from "node-opcua";
export interface ClientServerSession {
    g_session: ClientSession;
    g_server: OPCUAServer;
    shutdown: () => Promise<void>;
}
export declare function build_client_server_session(options: OPCUAServerOptions & {
    port: number;
}): Promise<ClientServerSession>;
//# sourceMappingURL=build_client_server_session.d.ts.map