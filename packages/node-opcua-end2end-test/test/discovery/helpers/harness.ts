
import { OPCUACertificateManager } from "node-opcua";
export interface TestHarness { 
    discoveryServerCertificateManager: OPCUACertificateManager;
    serverCertificateManager: OPCUACertificateManager;
}