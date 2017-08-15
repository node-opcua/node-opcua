var generator = require("node-opcua-generator");
require("node-opcua-basic-types");
require("node-opcua-variant");


generator.registerObject("ReferenceDescription");
generator.registerObject("ViewDescription");
generator.registerObject("BrowseDescription");
generator.registerObject("BrowseResult");


generator.registerObject("BrowseRequest");
generator.registerObject("BrowseResponse");
generator.registerObject("BrowseNextRequest");
generator.registerObject("BrowseNextResponse");
