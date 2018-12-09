const generator = require("node-opcua-generator");

generator.registerObject("RegisteredServer");
generator.registerObject("RegisterServerRequest");
generator.registerObject("RegisterServerResponse");

generator.registerObject("MdnsDiscoveryConfiguration");
generator.registerObject("RegisterServer2Request");
generator.registerObject("RegisterServer2Response");

generator.registerObject("FindServersRequest");
generator.registerObject("FindServersResponse");

generator.registerObject("ServerOnNetwork");
generator.registerObject("FindServersOnNetworkRequest");
generator.registerObject("FindServersOnNetworkResponse");
