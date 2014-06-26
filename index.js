
// common services
module.exports.structures       = require("./lib/datamodel/structures");
module.exports.parseEndpointUrl = require("./lib/nodeopcua").parseEndpointUrl;
module.exports.resolveNodeId    = require("./lib/datamodel/nodeid").resolveNodeId;
module.exports.makeNodeId       = require("./lib/datamodel/nodeid").makeNodeId;
module.exports.makeExpandedNodeId       = require("./lib/datamodel/nodeid").makeExpandedNodeId;
module.exports.StatusCodes      = require("./lib/datamodel/opcua_status_code").StatusCodes;
module.exports.DataType         = require("./lib/datamodel/variant").DataType;
module.exports.DataValue        = require("./lib/datamodel/datavalue").DataValue;
module.exports.Variant          = require("./lib/datamodel/variant").Variant;
module.exports.NodeId           = require("./lib/datamodel/nodeid").NodeId;
module.exports.NumericRange     = require("./lib/datamodel/numeric_range").NumericRange;
module.exports.AccessLevelFlag  = require("./lib/datamodel/access_level").AccessLevelFlag;
module.exports.browse_service   = require("./lib/services/browse_service");
module.exports.read_service     = require("./lib/services/read_service");
module.exports.AttributeIds     = module.exports.read_service.AttributeIds;
module.exports.AttributeNameById= module.exports.read_service.AttributeNameById;
module.exports.VariableIds      = require("./lib/opcua_node_ids").VariableIds;

// client services
module.exports.OPCUAClient      = require("./lib/client/opcua_client").OPCUAClient;
module.exports.NodeCrawler      = require("./lib/client/node_crawler").NodeCrawler;
module.exports.ClientSubscription = require("./lib/client/client_subscription").ClientSubscription;

// Server services
module.exports.OPCUAServer      = require("./lib/server/opcua_server").OPCUAServer;
module.exports.generate_address_space = require("./lib/address_space/load_nodeset2").generate_address_space;
module.exports.AddressSpace     = require("./lib/address_space/address_space").AddressSpace;
