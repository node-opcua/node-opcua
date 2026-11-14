import { type NodeId, type OPCUAServer } from "node-opcua";
export interface InnerServer {
    endpointUrl: string;
    serverCertificate: Buffer;
    temperatureVariableId: NodeId;
    server: OPCUAServer;
}
//# sourceMappingURL=test_e2e_secure_all_possibe_secure_connection.d.ts.map