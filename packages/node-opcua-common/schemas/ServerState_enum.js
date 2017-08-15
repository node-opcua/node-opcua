// --------- This code has been automatically generated !!! 2017-06-18T14:21:04.743Z
// namespace http://opcfoundation.org/UA/
var factories  = require("node-opcua-factory");
var makeNodeId = require("node-opcua-nodeid").makeNodeId;
var ServerState_Schema = {
  id:  makeNodeId(852,0),
  name: 'ServerState',
  namespace: '0',
  enumValues: {
     Running: 0,
     Failed: 1,
     NoConfiguration: 2,
     Suspended: 3,
     Shutdown: 4,
     Test: 5,
     CommunicationFault: 6,
     Unknown: 7,
  }
};
exports.ServerState_Schema = ServerState_Schema;
exports.ServerState = factories.registerEnumeration(ServerState_Schema);