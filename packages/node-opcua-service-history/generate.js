var generator = require("node-opcua-generator");
require("node-opcua-service-secure-channel");

// Historizing service
generator.registerObject("AggregateConfiguration");
generator.registerObject("HistoryReadValueId");
generator.registerObject("HistoryReadRequest");
generator.registerObject("HistoryReadResult");
generator.registerObject("HistoryReadResponse");
generator.registerObject("HistoryReadDetails");
//Xx generator.registerObject("MonitoringFilter");
// history
generator.registerObject("ModificationInfo");
generator.registerObject("HistoryData");
generator.registerObject("HistoryModifiedData");

generator.registerObject("HistoryUpdateResult");
generator.registerObject("HistoryUpdateRequest");
generator.registerObject("HistoryUpdateResponse");

generator.registerObject("ReadRawModifiedDetails");
generator.registerObject("ReadProcessedDetails");
generator.registerObject("ReadAtTimeDetails");
generator.registerObject("ReadEventDetails");
