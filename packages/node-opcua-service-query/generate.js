var generator = require("node-opcua-generator");


// query service
// -- already registerObject("ContentFilterResult");
generator.registerObject("ParsingResult");
generator.registerObject("QueryDataDescription");
generator.registerObject("NodeTypeDescription");
generator.registerObject("QueryFirstRequest");
generator.registerObject("QueryDataSet");
generator.registerObject("QueryFirstResponse");


generator.registerObject("QueryNextRequest");
generator.registerObject("QueryNextResponse");