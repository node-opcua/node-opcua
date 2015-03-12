
var _ = require("underscore");

function ServerCapabilities(options) {

    options = options || {};
    this.maxArrayLength                = options.maxArrayLength || 0;
    this.maxStringLength               = options.maxStringLength || 0;
    this.maxBrowseContinuationPoints   = options.maxBrowseContinuationPoints || 0;
    this.maxQueryContinuationPoints    =  options.maxQueryContinuationPoints || 0;
    this.maxHistoryContinuationPoints  = options.maxHistoryContinuationPoints || 0;

    this.operationLimits= {
        maxNodesPerRead:               100,
        maxNodesPerWrite:              100,
        maxNodesPerMethodCall:         100,
        maxNodesPerBrowse:             100,
        maxNodesPerRegisterNodes:        0,
        maxNodesPerNodeManagement:       0,
        maxMonitoredItemsPerCall:        0,
        maxNodesPerHistoryReadData:      0,
        maxNodesPerHistoryReadEvents:    0,
        maxNodesPerHistoryUpdateData:    0,
        maxNodesPerHistoryUpdateEvents:  0
    };

    options.operationLimits = options.operationLimits || {};

    this.operationLimits.maxNodesPerRead                = options.operationLimits.maxNodesPerRead  ||0;
    this.operationLimits.maxNodesPerWrite               = options.operationLimits.maxNodesPerWrite  ||0;
    this.operationLimits.maxNodesPerMethodCall          = options.operationLimits.maxNodesPerMethodCall  ||0;
    this.operationLimits.maxNodesPerBrowse              = options.operationLimits.maxNodesPerBrowse  ||0;
    this.operationLimits.maxNodesPerRegisterNodes       = options.operationLimits.maxNodesPerRegisterNodes  ||0;
    this.operationLimits.maxNodesPerNodeManagement      = options.operationLimits.maxNodesPerNodeManagement  ||0;
    this.operationLimits.maxMonitoredItemsPerCall       = options.operationLimits.maxMonitoredItemsPerCall  ||0;
    this.operationLimits.maxNodesPerHistoryReadData     = options.operationLimits.maxNodesPerHistoryReadData  ||0;
    this.operationLimits.maxNodesPerHistoryReadEvents   = options.operationLimits.maxNodesPerHistoryReadEvents  ||0;
    this.operationLimits.maxNodesPerHistoryUpdateData   = options.operationLimits.maxNodesPerHistoryUpdateData  ||0;
    this.operationLimits.maxNodesPerHistoryUpdateEvents = options.operationLimits.maxNodesPerHistoryUpdateEvents  ||0;

};

exports.ServerCapabilities = ServerCapabilities;
