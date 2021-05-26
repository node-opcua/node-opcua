
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing DiscoveryServer - Umbrella ", function () {

    const test = this;
    require("./u_test_opcua_ClientServer_findservers")(test);
    require("./u_test_frequent_server_restart")(test);
    // typescripts tests starts here...
    require("./u_test_registration_server_manager").t(test);
    require("./u_test_discovery_server").t(test);
    require("./u_test_multiple_discovery_servers_and_mdns").t(test);

    after((done) => setTimeout(done, 1000));
});
