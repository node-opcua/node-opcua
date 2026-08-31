import { OPCUACertificateManager, OPCUAClientBase, OPCUAServer } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { tmpFolderFor } from "../../test_helpers/paths.js";
import type { TestHarness } from "./helpers/harness.js";
import { t as tDiscoveryServer } from "./u_test_discovery_server.js";
import { t as tFrequentServerRestart } from "./u_test_frequent_server_restart.js";
import { t as tMultipleDiscoveryServersAndMdns } from "./u_test_multiple_discovery_servers_and_mdns.js";
import { t as tOpcuaClientServerFindservers } from "./u_test_opcua_ClientServer_findservers.js";
import { t as tRegistrationServerManager } from "./u_test_registration_server_manager.js";

describe("testing DiscoveryServer - Umbrella ", function (this: Mocha.Runnable & TestHarness) {
    before(async () => {
        this.serverCertificateManager = new OPCUACertificateManager({
            rootFolder: tmpFolderFor("PKI-DiscoveryCommon")
        });
        this.serverCertificateManager.referenceCounter++;
        await this.serverCertificateManager.initialize();

        this.discoveryServerCertificateManager = new OPCUACertificateManager({
            rootFolder: tmpFolderFor("PKI-Discovery")
        });
        this.discoveryServerCertificateManager.referenceCounter++;
        await this.discoveryServerCertificateManager.initialize();
    });
    after(async () => {
        this.serverCertificateManager.referenceCounter--;
        await this.serverCertificateManager.dispose();

        this.discoveryServerCertificateManager.referenceCounter--;
        await this.discoveryServerCertificateManager.dispose();
    });
    before(() => {
        OPCUAServer.registry.count().should.eql(0);
        OPCUAClientBase.registry.count().should.eql(0);
    });

    after(async () => {
        OPCUAServer.registry.count().should.eql(0);
        OPCUAClientBase.registry.count().should.eql(0);
    });

    // typescripts tests starts here...
    tDiscoveryServer(this);
    tFrequentServerRestart(this);
    tMultipleDiscoveryServersAndMdns(this);
    tOpcuaClientServerFindservers(this);
    tRegistrationServerManager(this);
});
