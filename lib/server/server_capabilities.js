"use strict";

function ServerCapabilities(options) {

    options = options || {};
    options.operationLimits = options.operationLimits || {};

    this.serverProfileArray = options.serverProfileArray  || [];
    this.localeIdArray = options.localeIdArray ||[];
    this.softwareCertificates = options.softwareCertificates||[];

    this.maxArrayLength = options.maxArrayLength || 0;
    this.maxStringLength = options.maxStringLength || 0;
    this.maxBrowseContinuationPoints = options.maxBrowseContinuationPoints || 0;
    this.maxQueryContinuationPoints = options.maxQueryContinuationPoints || 0;
    this.maxHistoryContinuationPoints = options.maxHistoryContinuationPoints || 0;

    var operationLimits = {};

    operationLimits.maxNodesPerRead = options.operationLimits.maxNodesPerRead || 0;
    operationLimits.maxNodesPerWrite = options.operationLimits.maxNodesPerWrite || 0;
    operationLimits.maxNodesPerMethodCall = options.operationLimits.maxNodesPerMethodCall || 0;
    operationLimits.maxNodesPerBrowse = options.operationLimits.maxNodesPerBrowse || 0;
    operationLimits.maxNodesPerRegisterNodes = options.operationLimits.maxNodesPerRegisterNodes || 0;
    operationLimits.maxNodesPerNodeManagement = options.operationLimits.maxNodesPerNodeManagement || 0;
    operationLimits.maxMonitoredItemsPerCall = options.operationLimits.maxMonitoredItemsPerCall || 0;
    operationLimits.maxNodesPerHistoryReadData = options.operationLimits.maxNodesPerHistoryReadData || 0;
    operationLimits.maxNodesPerHistoryReadEvents = options.operationLimits.maxNodesPerHistoryReadEvents || 0;
    operationLimits.maxNodesPerHistoryUpdateData = options.operationLimits.maxNodesPerHistoryUpdateData || 0;
    operationLimits.maxNodesPerHistoryUpdateEvents = options.operationLimits.maxNodesPerHistoryUpdateEvents || 0;

    this.operationLimits = operationLimits;
}

exports.ServerCapabilities = ServerCapabilities;
