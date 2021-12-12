const path = require("path");
const { OPCUACertificateManager } = require("node-opcua");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing DiscoveryServer - Umbrella ", function () {
    before(async () => {
        this.serverCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(__dirname, "../../tmp/PKI-DiscoveryCommon")
        });
        this.serverCertificateManager.referenceCounter++;
        await this.serverCertificateManager.initialize();

        this.discoveryServerCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(__dirname, "../../tmp", "PKI-Discovery")
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
    // typescripts tests starts here...
    require("./u_test_discovery_server").t(this);
    require("./u_test_frequent_server_restart").t(this);
    require("./u_test_multiple_discovery_servers_and_mdns").t(this);
    require("./u_test_opcua_ClientServer_findservers").t(this);
    require("./u_test_registration_server_manager").t(this);
});
