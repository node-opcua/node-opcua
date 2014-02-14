module.exports.OPCUAClient      = require("./lib/opcua-client").OPCUAClient;
module.exports.structures       = require("./lib/structures");
module.exports.browse_service   = require("./lib/browse_service");
module.exports.read_service     = require("./lib/read_service");
module.exports.parseEndpointUrl = require("./lib/nodeopcua").parseEndpointUrl;
module.exports.resolveNodeId    = require("./lib/nodeid").resolveNodeId;
