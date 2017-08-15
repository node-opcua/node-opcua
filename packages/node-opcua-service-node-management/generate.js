var generator = require("node-opcua-generator");

// node Management service
generator.registerObject("AddNodesItem");
generator.registerObject("AddNodesRequest");

generator.registerObject("AddNodesResult");
generator.registerObject("AddNodesResponse");

generator.registerObject("AddReferencesItem");
generator.registerObject("AddReferencesRequest");
generator.registerObject("AddReferencesResponse");

generator.registerObject("DeleteNodesItem");
generator.registerObject("DeleteNodesRequest");
generator.registerObject("DeleteNodesResponse");

generator.registerObject("DeleteReferencesItem");
generator.registerObject("DeleteReferencesRequest");
generator.registerObject("DeleteReferencesResponse");
