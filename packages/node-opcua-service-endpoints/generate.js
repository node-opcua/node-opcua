var generator = require("node-opcua-generator");

require("node-opcua-data-model");


generator.registerObject("UserTokenPolicy");

generator.registerObject("EndpointDescription");
generator.registerObject("ApplicationDescription");

generator.registerObject("GetEndpointsRequest");
generator.registerObject("GetEndpointsResponse");
