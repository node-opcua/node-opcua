"use strict";


/**
 * @class OperationLimits
 * @param options {Object}
 * @param [options.maxNodesPerRead=0]
 * @param [options.maxNodesPerWrite=0]
 * @param [options.maxNodesPerMethodCall=0]
 * @param [options.maxNodesPerBrowse=0]
 * @param [options.maxNodesPerRegisterNodes=0]
 * @param [options.maxNodesPerNodeManagement=0]
 * @param [options.maxMonitoredItemsPerCall=0]
 * @param [options.maxNodesPerHistoryReadData=0]
 * @param [options.maxNodesPerHistoryReadEvents=0]
 * @param [options.maxNodesPerHistoryUpdateData=0]
 * @param [options.maxNodesPerHistoryUpdateEvents=0]
 * @param [options.maxNodesPerTranslateBrowsePathsToNodeIds=0]
 * @constructor
 */
function OperationLimits(options) {

    /**
     * @property maxNodesPerRead
     * @type {Number}
     */
    this.maxNodesPerRead = options.maxNodesPerRead || 0;
    /**
     * @property maxNodesPerWrite
     * @type {Number}
     */
    this.maxNodesPerWrite = options.maxNodesPerWrite || 0;
    /**
     * @property maxNodesPerMethodCall
     * @type {Number}
     */
    this.maxNodesPerMethodCall = options.maxNodesPerMethodCall || 0;
    /**
     * @property maxNodesPerBrowse
     * @type {Number}
     */
    this.maxNodesPerBrowse = options.maxNodesPerBrowse || 0;
    /**
     * @property maxNodesPerRegisterNodes
     * @type {Number}
     */
    this.maxNodesPerRegisterNodes = options.maxNodesPerRegisterNodes || 0;
    /**
     * @property maxNodesPerNodeManagement
     * @type {Number}
     */
    this.maxNodesPerNodeManagement = options.maxNodesPerNodeManagement || 0;
    /**
     * @property maxMonitoredItemsPerCall
     * @type {Number}
     */
    this.maxMonitoredItemsPerCall = options.maxMonitoredItemsPerCall || 0;
    /**
     * @property maxNodesPerHistoryReadData
     * @type {Number}
     */
    this.maxNodesPerHistoryReadData = options.maxNodesPerHistoryReadData || 0;
    /**
     * @property maxNodesPerHistoryReadEvents
     * @type {Number}
     */
    this.maxNodesPerHistoryReadEvents = options.maxNodesPerHistoryReadEvents || 0;
    /**
     * @property maxNodesPerHistoryUpdateData
     * @type {Number}
     */
    this.maxNodesPerHistoryUpdateData = options.maxNodesPerHistoryUpdateData || 0;
    /**
     * @property maxNodesPerHistoryUpdateEvents
     * @type {Number}
     */
    this.maxNodesPerHistoryUpdateEvents = options.maxNodesPerHistoryUpdateEvents || 0;
    /**
     * @property maxNodesPerTranslateBrowsePathsToNodeIds
     * @type {Number}
     */
    this.maxNodesPerTranslateBrowsePathsToNodeIds = options.maxNodesPerTranslateBrowsePathsToNodeIds || 0;

}
/**
 * @class ServerCapabilities
 * @param options
 * @param options.operationLimits
 * @param [options.operationLimits.maxNodesPerRead=0]
 * @param [options.operationLimits.maxNodesPerWrite=0]
 * @param [options.operationLimits.maxNodesPerMethodCall=0]
 * @param [options.operationLimits.maxNodesPerBrowse=0]
 * @param [options.operationLimits.maxNodesPerRegisterNodes=0]
 * @param [options.operationLimits.maxNodesPerNodeManagement=0]
 * @param [options.operationLimits.maxMonitoredItemsPerCall=0]
 * @param [options.operationLimits.maxNodesPerHistoryReadData=0]
 * @param [options.operationLimits.maxNodesPerHistoryReadEvents=0]
 * @param [options.operationLimits.maxNodesPerHistoryUpdateData=0]
 * @param [options.operationLimits.maxNodesPerHistoryUpdateEvents=0]
 * @param [options.operationLimits.maxNodesPerTranslateBrowsePathsToNodeIds=0]
 * @param options.serverProfileArray
 * @param options.localeIdArray
 * @param options.softwareCertificates
 * @param options.maxArrayLength
 * @param options.maxStringLength
 * @param options.maxBrowseContinuationPoints
 * @param options.maxQueryContinuationPoints
 * @param options.maxHistoryContinuationPoints
 * @constructor
 */
function ServerCapabilities(options) {

    options = options || {};
    options.operationLimits = options.operationLimits || {};

    this.serverProfileArray = options.serverProfileArray || [];
    this.localeIdArray = options.localeIdArray || [];
    this.softwareCertificates = options.softwareCertificates || [];
    /**
     * @property maxArrayLength
     * @type {Number}
     */
    this.maxArrayLength = options.maxArrayLength || 0;
    /**
     * @property maxStringLength
     * @type {Number}
     */
    this.maxStringLength = options.maxStringLength || 0;
    /**
     * @property maxBrowseContinuationPoints
     * @type {Number}
     */
    this.maxBrowseContinuationPoints = options.maxBrowseContinuationPoints || 0;
    /**
     * @property maxQueryContinuationPoints
     * @type {Number}
     */
    this.maxQueryContinuationPoints = options.maxQueryContinuationPoints || 0;
    /**
     * @property maxHistoryContinuationPoints
     * @type {Number}
     */
    this.maxHistoryContinuationPoints = options.maxHistoryContinuationPoints || 0;

    /**
     * @property operationLimits
     * @type {OperationLimits}
     */
    this.operationLimits = new OperationLimits(options.operationLimits);
}

exports.ServerCapabilities = ServerCapabilities;
