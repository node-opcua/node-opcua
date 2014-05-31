module.exports.OPCUAClient      = require("./lib/client/opcua_client").OPCUAClient;
module.exports.structures       = require("./lib/datamodel/structures");
module.exports.browse_service   = require("./lib/services/browse_service");
module.exports.read_service     = require("./lib/services/read_service");
module.exports.parseEndpointUrl = require("./lib/nodeopcua").parseEndpointUrl;
module.exports.resolveNodeId    = require("./lib/datamodel/nodeid").resolveNodeId;
module.exports.makeNodeId       = require("./lib/datamodel/nodeid").makeNodeId;
module.exports.ClientSubscription = require("./lib/client/client_subscription").ClientSubscription;
module.exports.OPCUAServer      = require("./lib/server/opcua_server").OPCUAServer;
module.exports.StatusCodes      = require("./lib/datamodel/opcua_status_code").StatusCodes;
module.exports.DataType         = require("./lib/datamodel/variant").DataType;
module.exports.DataValue        = require("./lib/datamodel/datavalue").DataValue;
module.exports.Variant          = require("./lib/datamodel/variant").Variant;
module.exports.NodeId          = require("./lib/datamodel/nodeid").NodeId;
module.exports.AttributeIds     = module.exports.read_service.AttributeIds;
module.exports.VariableIds      = require("./lib/opcua_node_ids").VariableIds;

