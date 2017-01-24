/**
 * @module opcua.client
 */
import util from "util";
import { EventEmitter } from "events";
import _ from "underscore";
import assert from "better-assert";
import { resolveNodeId } from "lib/datamodel/nodeid";
import { DataValue } from "lib/datamodel/datavalue";
import { NodeId } from "lib/datamodel/nodeid";
import { Variant } from "lib/datamodel/variant";
import { coerceNodeId } from "lib/datamodel/nodeid";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import subscription_service from "lib/services/subscription_service";
import {
  ReadValueId,
  ReadRequest,
  TimestampsToReturn,
  ReadResponse,
} from "lib/services/read_service";
import { 
  ReadRawModifiedDetails,
  HistoryReadRequest,
  HistoryReadResponse
} from "lib/services/historizing_service";
import {
  BrowseDirection ,
  BrowseDescription,
  BrowseRequest,
  BrowseResponse,
  makeResultMask
} from "lib/services/browse_service";
import write_service from "lib/services/write_service";
import { 
  CallMethodRequest,
  CallRequest,
  CallResponse } from "lib/services/call_service";
import { DataType } from "lib/datamodel/variant";
import translate_service from "lib/services/translate_browse_paths_to_node_ids_service";
import query_service from "lib/services/query_service";

import { ClientSessionKeepAliveManager } from "./client_session_keepalive_manager";


import { AttributeIds } from "lib/datamodel/attributeIds";
import { ReferenceTypeIds } from "lib/opcua_node_ids";
import { makeNodeId } from "lib/datamodel/nodeid";

import { 
  make_debugLog, 
  checkDebugFlag,
  isNullOrUndefined
} from "lib/misc/utils";
const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

/**
 * @class ClientSession
 * @param client {OPCUAClient}
 * @constructor
 */
class ClientSession extends EventEmitter {
  constructor(client) {
    super();
    this._closeEventHasBeenEmmitted = false;
    this._client = client;
    this._publishEngine = null;
    this._closed = false;
  }

  /**
   * @method getPublishEngine
   * @return {ClientSidePublishEngine}
   */
  getPublishEngine() {
    if (!this._publishEngine) {
      const ClientSidePublishEngine = require("lib/client/client_publish_engine").ClientSidePublishEngine;
      this._publishEngine = new ClientSidePublishEngine(this);
    }

    return this._publishEngine;
  }

  /**
   * browse a node or an array of nodes.
   *
   * @method browse
   * @async
   *
   * @example:
   *
   * form1:
   *
   *    ``` javascript
   *    session.browse("RootFolder",function(err,results,diagnostics) {} );
   *    ```
   *
   * form2:
   *
   *    ``` javascript
   *    var browseDescription = {
   *       nodeId: "ObjectsFolder",
   *       referenceTypeId: "Organizes",
   *       browseDirection: BrowseDirection.Inverse,
   *       includeSubtypes: true,
   *       nodeClassMask: 0,
   *       resultMask: 63
   *    }
   *    session.browse(browseDescription,function(err,results,diagnostics) {} );
   *    ```
   *
   * form3:
   *
   *    ``` javascript
   *    session.browse([ "RootFolder", "ObjectsFolder"],function(err,results,diagnostics) {
   *       assert(results.length === 2);
   *    });
   *    ```
   *
   * form4:
   *
   *   ``` javascript
   *    var browseDescription = [
   *      {
   *          nodeId: "ObjectsFolder",
   *          referenceTypeId: "Organizes",
   *          browseDirection: BrowseDirection.Inverse,
   *          includeSubtypes: true,
   *          nodeClassMask: 0,
   *          resultMask: 63
   *      }
   *    ]
   *    session.browse(browseDescription,function(err,results,diagnostics) {} );
   *    ```
   *
   * @param nodes {Object}
   * @param {Function} callback
   * @param {Error|null} callback.err
   * @param {BrowseResult[]} callback.results an array containing the BrowseResult of each BrowseDescription.
   */
  browse(nodes, callback) {
    const self = this;

    try {
      self.requestedMaxReferencesPerNode = self.requestedMaxReferencesPerNode || 10000;
      assert(_.isFinite(self.requestedMaxReferencesPerNode));
      assert(_.isFunction(callback));

      if (!_.isArray(nodes)) {
        nodes = [nodes];
      }

      const nodesToBrowse = nodes.map(coerceBrowseDescription);

      const request = new BrowseRequest({
        nodesToBrowse,
        requestedMaxReferencesPerNode: self.requestedMaxReferencesPerNode
      });

      self.performMessageTransaction(request, (err, response) => {
        let i;
        let r;


              /* istanbul ignore next */
        if (err) {
          return callback(err, null, response);
        }

        assert(response instanceof BrowseResponse);

        if (self.requestedMaxReferencesPerNode > 0) {
          for (i = 0; i < response.results.length; i++) {
            r = response.results[i];

                      /* istanbul ignore next */
            if (r.references && r.references.length > self.requestedMaxReferencesPerNode) {
              console.log(`${"warning".yellow} BrowseResponse : server didn't take into account our requestedMaxReferencesPerNode `);
              console.log(`        self.requestedMaxReferencesPerNode= ${self.requestedMaxReferencesPerNode}`);
              console.log(`        got ${r.references.length}for ${nodesToBrowse[i].nodeId.toString()}`);
              console.log("        continuationPoint ", r.continuationPoint);
            }
          }
        }
        for (i = 0; i < response.results.length; i++) {
          r = response.results[i];
          r.references = r.references || [];
        }
              // detect unsupported case :
              // todo implement proper support for r.continuationPoint
        for (i = 0; i < response.results.length; i++) {
          r = response.results[i];

          if (r.continuationPoint !== null) {
            console.log(" warning:".yellow, " BrowseResponse : server didn't send all references and has provided a continuationPoint. Unfortunately we do not support this yet");
            console.log("           self.requestedMaxReferencesPerNode = ", self.requestedMaxReferencesPerNode);
            console.log("           continuationPoint ", r.continuationPoint);
          }
        }
        callback(null, response.results, response.diagnosticInfos);
      });
    }  catch (err) {
          /* istanbul ignore next */
      callback(err);
    }
  }

  /**
   * @method readVariableValue
   * @async
   * @example:
   *
   *     session.readVariableValue("ns=2;s=Furnace_1.Temperature",function(err,dataValues,diagnostics) {} );
   *
   * @param nodes  {ReadValueId[]} - the read value id
   * @param {Function} callback -   the callback function
   * @param callback.err {object|null} the error if write has failed or null if OK
   * @param callback.results {DataValue[]} - an array of dataValue each read
   * @param callback.diagnosticInfos {DiagnosticInfo[]} - the diagnostic info.
   *
   *
   *
   * @example
   *
   * - read a single node :
   *
   *   session.readVariableValue("ns=0;i=2257",function(err,dataValue) {
   *      if (!err) {
   *         console.log(dataValue.toString());
   *      }
   *   });
   *
   * - read a array of nodes
   *   session.readVariableValue(["ns=0;i=2257","ns=0;i=2258"],function(err,dataValues) {
   *      if (!err) {
   *         console.log(dataValues[0].toString());
   *         console.log(dataValues[1].toString());
   *      }
   *   });
   *
   *
  */
  readVariableValue(nodes, callback) {
    const self = this;

    assert(_.isFunction(callback));


    const isArray = _.isArray(nodes);
    if (!isArray) {
      nodes = [nodes];
    }

    const nodesToRead = [];

    function coerceReadValueId(node) {
      if (typeof node === "string" || node instanceof NodeId) {
        return new ReadValueId({
          nodeId: resolveNodeId(node),
          attributeId: AttributeIds.Value,
          indexRange: null,
          dataEncoding: { namespaceIndex: 0, name: null }
        });
      } 
      assert(node instanceof Object);
      return new ReadValueId(node);
    }
    nodes.forEach((node) => {
      nodesToRead.push(coerceReadValueId(node));
    });

    const request = new ReadRequest({
      nodesToRead,
      timestampsToReturn: TimestampsToReturn.Neither
    });

    assert(nodes.length === request.nodesToRead.length);

    self.performMessageTransaction(request, (err, response) => {
          /* istanbul ignore next */
      if (err) {
        return callback(err, response);
      }
      if (response.responseHeader.serviceResult !== StatusCodes.Good) {
        return callback(new Error(response.responseHeader.serviceResult.toString()));
      }
      assert(response instanceof ReadResponse);
      assert(nodes.length === response.results.length);

      response.results = response.results || [];
      response.diagnosticInfos = response.diagnosticInfos || [];
      const results = isArray ? response.results : response.results[0];
      const diags   = isArray ? response.diagnosticInfos : response.diagnosticInfos[0];

      callback(null, results, diags);
    });
  }

  /**
   * @method readHistoryValue
   * @async
   * @example:
   *
   *     session.readHistoryValue("ns=5;s=Simulation Examples.Functions.Sine1","2015-06-10T09:00:00.000Z","2015-06-10T09:01:00.000Z",function(err,dataValues,diagnostics) {} );
   *
   * @param nodes  {ReadValueId[]} - the read value id
   * @param start - the starttime in UTC format
   * @param end - the endtime in UTC format
   * @param {Function} callback -   the callback function
   * @param callback.err {object|null} the error if write has failed or null if OK
   * @param callback.results {DataValue[]} - an array of dataValue each read
   * @param callback.diagnosticInfos {DiagnosticInfo[]} - the diagnostic infos.
   */
  readHistoryValue(nodes, start, end, callback) {
    const self = this;
    assert(_.isFunction(callback));
    if (!_.isArray(nodes)) {
      nodes = [nodes];
    }

    const nodesToRead = [];
    const historyReadDetails = [];
    nodes.forEach((node) => {
      nodesToRead.push({
        nodeId: resolveNodeId(node),
        indexRange: null,
        dataEncoding: { namespaceIndex: 0, name: null },
        continuationPoint: null
      });
    });

    const ReadRawModifiedDetails = new ReadRawModifiedDetails({
      isReadModified: false,
      startTime: start,
      endTime: end,
      numValuesPerNode: 0,
      returnBounds: true
    });

    const request = new HistoryReadRequest({
      nodesToRead,
      historyReadDetails: ReadRawModifiedDetails,
      timestampsToReturn: TimestampsToReturn.Both,
      releaseContinuationPoints: false
    });

    assert(nodes.length === request.nodesToRead.length);
    self.performMessageTransaction(request, (err, response) => {
      if (err) {
        return callback(err, response);
      }

      if (response.responseHeader.serviceResult !== StatusCodes.Good) {
        return callback(new Error(response.responseHeader.serviceResult.toString()));
      }

      assert(response instanceof HistoryReadResponse);
      assert(nodes.length === response.results.length);

      callback(null, response.results, response.diagnosticInfos);
    });
  }

  /**
   * @async
   * @method write
   * @param nodesToWrite {Array.<WriteValue>}  - the array of value to write. One or more elements.
   *
   * @param {Function} callback -   the callback function
   * @param callback.err {object|null} the error if write has failed or null if OK
   * @param callback.statusCodes {StatusCode[]} - an array of status code of each write
   * @param callback.diagnosticInfos {DiagnosticInfo[]} - the diagnostic infos.
   */
  write(nodesToWrite, callback) {
    const self = this;

    assert(_.isFunction(callback));
    assert(_.isArray(nodesToWrite));

    const request = new write_service.WriteRequest({ nodesToWrite });

    self.performMessageTransaction(request, (err, response) => {
          /* istanbul ignore next */
      if (err) {
        return callback(err, response);
      }
      if (response.responseHeader.serviceResult !== StatusCodes.Good) {
        return callback(new Error(response.responseHeader.serviceResult.toString()));
      }
      assert(response instanceof write_service.WriteResponse);
      assert(nodesToWrite.length === response.results.length);
      callback(null, response.results, response.diagnosticInfos);
    });
  }

  /**
   *
   * @async
   * @method writeSingleNode
   * @param nodeId  {NodeId}  - the node id of the node to write
   * @param value   {Variant} - the value to write
   * @param callback   {Function}
   * @param callback.err {object|null} the error if write has failed or null if OK
   * @param callback.statusCode {StatusCode} - the status code of the write
   * @param callback.diagnosticInfo {DiagnosticInfo} the diagnostic info.
   */
  writeSingleNode(nodeId, value, callback) {
    assert(_.isFunction(callback));

    const nodesToWrite = [];

    nodesToWrite.push({
      nodeId: resolveNodeId(nodeId),
      attributeId: AttributeIds.Value,
      indexRange: null,
      value: new DataValue({ value })
    });
    this.write(nodesToWrite, (err, statusCodes, diagnosticInfos) => {
          /* istanbul ignore next */
      if (err) {
        return callback(err);
      }

      assert(statusCodes.length === 1);
      const diagnosticInfo = diagnosticInfos ? diagnosticInfos[0] : null;
      callback(null, statusCodes[0], diagnosticInfo);
    });
  }

  /**
   * @method readAllAttributes
   *
   * @example:
   *
   *    ``` javascript
   *    session.readAllAttributes("ns=2;s=Furnace_1.Temperature",function(err,nodesToRead,dataValues,diagnostics) {} );
   *    ```
   *
   * @async
   * @param nodes  {NodeId[]} - an array of nodeId to read
   * @param callback              {Function} - the callback function
   * @param callback.err          {Error|null} - the error or null if the transaction was OK
   * @param callback.nodesToRead  {ReadValueId[]}
   * @param callback.results      {DataValue[]}
   * @param callback.diagnostic  {DiagnosticInfo[]}
   *
   */
  readAllAttributes(nodes, callback) {
    assert(_.isFunction(callback));
    if (!_.isArray(nodes)) {
      nodes = [nodes];
    }


    const nodesToRead = [];

    nodes.forEach((node) => {
      Object.keys(AttributeIds).forEach((key) => {
        const attributeId = AttributeIds[key];
        nodesToRead.push({
          nodeId: resolveNodeId(node),
          attributeId,
          indexRange: null,
          dataEncoding: { namespaceIndex: 0, name: null }
        });
      });
    });

    this.read(nodesToRead, (err, nodesToRead, result, diagnosticInfos) => {
      callback(err, nodesToRead, result, diagnosticInfos);
    });
  }

  /**
   * @method read
   *
   * @example:
   *
   *    ``` javascript
   *    var nodesToRead = [
   *        {
   *             nodeId:      "ns=2;s=Furnace_1.Temperature",
   *             attributeId: AttributeIds.BrowseName
   *        }
   *    ];
   *    session.read(nodesToRead,function(err,nodesToRead,results,diagnosticInfos) {
   *        if (!err) {
   *        }
   *    });
   *    ```
   *
   * @async
   * @param nodesToRead               {[]} - an array of nodeId to read
   * @param nodesToRead.nodeId       {NodeId|string}
   * @param nodesToRead.attributeId  {AttributeId[]}
   * @param [maxAge]                 {Number}
   * @param callback                 {Function}      - the callback function
   * @param callback.err             {Error|null}    - the error or null if the transaction was OK
   * @param callback.nodesToRead     {ReadValueId[]}
   * @param callback.results         {DataValue[]}
   * @param callback.diagnosticInfos {DiagnosticInfo[]}
   *
   */
  read(nodesToRead, maxAge, callback) {
    const self = this;

    if (!callback) {
      callback = maxAge;
      maxAge = 0;
    }

    assert(_.isArray(nodesToRead));
    assert(_.isFunction(callback));

      // coerce nodeIds
    nodesToRead.forEach((node) => {
      node.nodeId = resolveNodeId(node.nodeId);
    });

    const request = new ReadRequest({
      nodesToRead,
      maxAge,
      timestampsToReturn: TimestampsToReturn.Both
    });

    self.performMessageTransaction(request, (err, response) => {
          /* istanbul ignore next */
      if (err) {
        return callback(err, response);
      }
      assert(response instanceof ReadResponse);
      callback(null, nodesToRead, response.results, response.diagnosticInfos);
    });
  }

  emitCloseEvent(statusCode) {
    const self = this;
    if (!self._closeEventHasBeenEmmitted) {
      debugLog("ClientSession#emitCloseEvent");
      self._closeEventHasBeenEmmitted = true;
      self.emit("session_closed",statusCode);
    }
  }

  _defaultRequest(SomeRequest, SomeResponse, options, callback) {
    const self = this;

    assert(_.isFunction(callback));

    const request = new SomeRequest(options);

      /* istanbul ignore next */
    if (doDebug) {
      request.trace = new Error().stack;
    }

    self.performMessageTransaction(request, (err, response) => {
          /* istanbul ignore next */
      if (err) {
              // let intercept interesting error message
        if (err.message.match(/BadSessionClosed/)) {
                  // the session has been closed by Server
                  // probably due to timeout issue
                  // let's print some statistics
          const now = new Date();
          debugLog(" server send BadSessionClosed !".bgWhite.red);
          debugLog(" timeout.................. ",self.timeout);
          debugLog(" lastRequestSentTime...... ",new Date(self.lastRequestSentTime).toISOString(), now - self.lastRequestSentTime);
          debugLog(" lastResponseReceivedTime. ",new Date(self.lastResponseReceivedTime).toISOString(), now - self.lastResponseReceivedTime);

          self._terminatePublishEngine();
                  /**
                   * @event session_closed
                   * send when the session has been closed by the server ( proabably due to inactivity and timeout)
                   */
          self.emitCloseEvent(StatusCodes.BadSessionClosed);
        }
        return callback(err, response);
      }
      assert(response instanceof SomeResponse);
      callback(null, response);
    });
  }

  /**
   * @method createSubscription
   * @async
   *
   * @example:
   *
   *    ``` javascript
   *    session.createSubscription(request,function(err,response) {} );
   *    ```
   *
   * @param options {CreateSubscriptionRequest}
   * @param options.requestedPublishingInterval {Duration}
   * @param options.requestedLifetimeCount {Counter}
   * @param options.requestedMaxKeepAliveCount {Counter}
   * @param options.maxNotificationsPerPublish {Counter}
   * @param options.publishingEnabled {Boolean}
   * @param options.priority {Byte}
   * @param callback {Function}
   * @param callback.err {Error|null}   - the Error if the async method has failed
   * @param callback.response {CreateSubscriptionResponse} - the response
   */
  createSubscription(options, callback) {
    const self = this;
    assert(_.isFunction(callback));

    const request = new subscription_service.CreateSubscriptionRequest(options);

    self.performMessageTransaction(request, (err, response) => {
          /* istanbul ignore next */
      if (err) {
        return callback(err, response);
      }
      assert(response instanceof subscription_service.CreateSubscriptionResponse);
      callback(null, response);
    });
  }

  /**
   * @method deleteSubscriptions
   * @async
   * @example:
   *
   *     session.deleteSubscriptions(request,function(err,response) {} );
   *
   * @param options {DeleteSubscriptionsRequest}
   * @param callback {Function}
   * @param callback.err {Error|null}   - the Error if the async method has failed
   * @param callback.response {DeleteSubscriptionsResponse} - the response
   */
  deleteSubscriptions(options, callback) {
    this._defaultRequest(
          subscription_service.DeleteSubscriptionsRequest,
          subscription_service.DeleteSubscriptionsResponse,
          options, callback);
  }

  /**
   * @method transferSubscriptions
   *
   * @async
   * @param options {TransferSubscriptionsRequest}
   * @param callback {Function}
   * @param callback.err {Error|null}   - the Error if the async method has failed
   * @param callback.response {TransferSubscriptionsResponse} - the response
   */
  transferSubscriptions(options, callback) {
    this._defaultRequest(
          subscription_service.TransferSubscriptionsRequest,
          subscription_service.TransferSubscriptionsResponse,
          options, callback);
  }

  /**
   *
   * @method createMonitoredItems
   * @async
   * @param options  {CreateMonitoredItemsRequest}
   * @param callback {Function}
   * @param callback.err {Error|null}   - the Error if the async method has failed
   * @param callback.response {CreateMonitoredItemsResponse} - the response
   */
  createMonitoredItems(options, callback) {
    this._defaultRequest(
          subscription_service.CreateMonitoredItemsRequest,
          subscription_service.CreateMonitoredItemsResponse,
          options, callback);
  }

  /**
   *
   * @method modifyMonitoredItems
   * @async
   * @param options {ModifyMonitoredItemsRequest}
   * @param callback {Function}
   * @param callback.err {Error|null}   - the Error if the async method has failed
   * @param callback.response {ModifyMonitoredItemsResponse} - the response
   */
  modifyMonitoredItems(options, callback) {
    this._defaultRequest(
          subscription_service.ModifyMonitoredItemsRequest,
          subscription_service.ModifyMonitoredItemsResponse,
          options, callback);
  }

  /**
   *
   * @method modifySubscription
   * @async
   * @param options {ModifySubscriptionRequest}
   * @param callback {Function}
   * @param callback.err {Error|null}   - the Error if the async method has failed
   * @param callback.response {ModifySubscriptionResponse} - the response
   */
  modifySubscription(options, callback) {
    this._defaultRequest(
          subscription_service.ModifySubscriptionRequest,
          subscription_service.ModifySubscriptionResponse,
          options, callback);
  }

  setMonitoringMode(options, callback) {
    this._defaultRequest(
          subscription_service.SetMonitoringModeRequest,
          subscription_service.SetMonitoringModeResponse,
          options, callback);
  }

  /**
   *
   * @method publish
   * @async
   * @param options  {PublishRequest}
   * @param callback {Function}
   * @param callback.err {Error|null}   - the Error if the async method has failed
   * @param callback.response {PublishResponse} - the response
   */
  publish(options, callback) {
    this._defaultRequest(
          subscription_service.PublishRequest,
          subscription_service.PublishResponse,
          options, callback);
  }

  /**
   *
   * @method republish
   * @async
   * @param options  {RepublishRequest}
   * @param callback {Function}
   * @param callback.err {Error|null}   - the Error if the async method has failed
   * @param callback.response {RepublishResponse} - the response
   */
  republish(options, callback) {
    this._defaultRequest(
          subscription_service.RepublishRequest,
          subscription_service.RepublishResponse,
          options, callback);
  }

  /**
   *
   * @method deleteMonitoredItems
   * @async
   * @param options  {DeleteMonitoredItemsRequest}
   * @param callback {Function}
   * @param callback.err {Error|null}   - the Error if the async method has failed
   */
  deleteMonitoredItems(options, callback) {
    this._defaultRequest(
          subscription_service.DeleteMonitoredItemsRequest,
          subscription_service.DeleteMonitoredItemsResponse,
          options, callback);
  }

  /**
   *
   * @method setPublishingMode
   * @async
   * @param publishingEnabled  {Boolean}
   * @param subscriptionIds {Array<Integer>}
   * @param callback {Function}
   * @param callback.err {Error|null}   - the Error if the async method has failed
   */
  setPublishingMode(publishingEnabled, subscriptionIds, callback) {
    const self = this;
    assert(_.isFunction(callback));
    assert(publishingEnabled === true || publishingEnabled === false);
    if (!_.isArray(subscriptionIds)) {
      assert(_.isNumber(subscriptionIds));
      subscriptionIds = [subscriptionIds];
    }

    const request = new subscription_service.SetPublishingModeRequest({
      publishingEnabled,
      subscriptionIds
    });

    self.performMessageTransaction(request, (err, response) => {
          /* istanbul ignore next */
      if (err) {
        return callback(err, null);
      }

      callback(err, response.results);
    });
  }

  /**
   *
   * @method translateBrowsePath
   * @async
   * @param browsePath {BrowsePath|Array<BrowsePathResult>}
   * @param callback {Function}
   * @param callback.err {Error|null}
   * @param callback.response {BrowsePathResult|Array<BrowsePathResult>}
   *
   *
   *
   */
  translateBrowsePath(browsePath, callback) {
    assert(_.isFunction(callback));
    const self = this;

    
    const has_single_element = !_.isArray(browsePath);
    browsePath = has_single_element ? [browsePath] : browsePath;

    const request = new translate_service.TranslateBrowsePathsToNodeIdsRequest({
      browsePath
    });

    self.performMessageTransaction(request, (err, response) => {
          /* istanbul ignore next */
      if (err) {
        return callback(err, response);
      }
      assert(response instanceof translate_service.TranslateBrowsePathsToNodeIdsResponse);
      callback(null, has_single_element ? response.results[0] : response.results);
    });
  }

  performMessageTransaction(request, callback) {
    const self = this;

    assert(_.isFunction(callback));
    assert(self._client);

    request.requestHeader.authenticationToken = this.authenticationToken;

    self.lastRequestSentTime = Date.now();

    self._client.performMessageTransaction(request, (err, response) => {
      self.lastResponseReceivedTime = Date.now();

          /* istanbul ignore next */
      if (err) {
        return callback(err, response);
      }

      if (response.responseHeader.serviceResult !== StatusCodes.Good) {
        err = new Error(` ServiceResult is ${response.responseHeader.serviceResult.toString()}`);
      }
      callback(err, response);
    });
  }

  _terminatePublishEngine() {
    if (this._publishEngine) {
      this._publishEngine.terminate();
      this._publishEngine = null;
    }
  }

  /**
   *
   * @method close
   * @async
   * @param [deleteSubscription=true] {Boolean}
   * @param callback {Function}
   */
  close(deleteSubscription, callback) {
    if (arguments.length === 1) {
      callback = deleteSubscription;
      deleteSubscription = true;
    }
    assert(_.isFunction(callback));
    assert(_.isBoolean(deleteSubscription));
    assert(this._client);

    this._terminatePublishEngine();
    this._client.closeSession(this,deleteSubscription,callback);
  }

  /**
   *
   * @returns {Boolean}
   */
  hasBeenClosed() {
    return isNullOrUndefined(this._client) || this._closed;
  }

  /**
   *
   * @method call
   *
   * @param methodsToCall {CallMethodRequest[]} the call method request array
   * @param callback {Function}
   * @param callback.err {Error|null}
   * @param callback.response {CallMethodResult[]}
   *
   *
   * @example :
   *
   * var methodsToCall = [ {
   *     objectId: "ns=2;i=12",
   *     methodId: "ns=2;i=13",
   *     inputArguments: [
   *         new Variant({...}),
   *         new Variant({...}),
   *     ]
   * }];
   * session.call(methodsToCall,function(err,response) {
   *    if (!err) {
   *         var rep = response[0];
   *         console.log(" statusCode = ",rep.statusCode);
   *         console.log(" inputArgumentResults[0] = ",rep.inputArgumentResults[0].toString());
   *         console.log(" inputArgumentResults[1] = ",rep.inputArgumentResults[1].toString());
   *         console.log(" outputArgument[0]       = ",rep.outputArgument[0].toString()); // array of variant
   *    }
   * });
   */
  call(methodsToCall, callback) {
    const self = this;

    assert(_.isArray(methodsToCall));

      // Note : The client has no explicit address space and therefore will struggle to
      //        access the method arguments signature.
      //        There are two methods that can be considered:
      //           - get the object definition by querying the server
      //           - load a fake address space to have some thing to query on our end
      // var request = self._client.factory.constructObjectId("CallRequest",{ methodsToCall: methodsToCall});
    const request = new CallRequest({ methodsToCall });

    self.performMessageTransaction(request, (err, response) => {
          /* istanbul ignore next */
      if (err) {
        return callback(err);
      }

      assert(response instanceof CallResponse);
      callback(null, response.results);
    });
  }

  /**
   * @method getMonitoredItems
   * @param subscriptionId {UInt32} the subscription Id to return
   * @param callback {Function}
   * @param callback.err {Error}
   * @param callback.monitoredItems the monitored Items
   * @param callback.monitoredItems the monitored Items
   */
  getMonitoredItems(subscriptionId, callback) {
      // <UAObject NodeId="i=2253"  BrowseName="Server">
      // <UAMethod NodeId="i=11492" BrowseName="GetMonitoredItems" ParentNodeId="i=2253" MethodDeclarationId="i=11489">
      // <UAMethod NodeId="i=11489" BrowseName="GetMonitoredItems" ParentNodeId="i=2004">
    const self = this;
    const methodsToCall =
          new CallMethodRequest({
            objectId: coerceNodeId("ns=0;i=2253"),  // ObjectId.Server
            methodId: coerceNodeId("ns=0;i=11492"), // MethodIds.Server_GetMonitoredItems;
            inputArguments: [
                  // BaseDataType
                  { dataType: DataType.UInt32, value: subscriptionId }
            ]
          });

    self.call([methodsToCall], (err, result, diagnosticInfo) => {
              /* istanbul ignore next */
      if (err) {
        return callback(err);
      }

      result = result[0];
      diagnosticInfo = diagnosticInfo ? diagnosticInfo[0] : null;
              // xx console.log(" xxxxxxxxxxxxxxxxxx RRR err",err);
              // xx console.log(" xxxxxxxxxxxxxxxxxx RRR result ".red.bold,result.toString());
              // xx console.log(" xxxxxxxxxxxxxxxxxx RRR err",diagnosticInfo);
      if (result.statusCode !== StatusCodes.Good) {
        callback(new Error(result.statusCode.toString()), result, diagnosticInfo);
      } else {
        assert(result.outputArguments.length === 2);
        const data = {
          serverHandles: result.outputArguments[0].value, //
          clientHandles: result.outputArguments[1].value
        };
        assert(data.serverHandles instanceof Uint32Array);
        assert(data.clientHandles instanceof Uint32Array);
        callback(null, data, diagnosticInfo);
      }
    }
      );
  }

  /**
   * extract the argument definition of a method
   * @method getArgumentDefinition
   * @param methodId {NodeId}
   * @param callback  {Function}
   * @param {Error|null} callback.err
   * @param {Argument<>} callback.inputArguments
   * @param {Argument<>} callback.outputArguments
   */
  getArgumentDefinition(methodId, callback) {
    assert(_.isFunction(callback));
    assert(methodId instanceof NodeId);
    const self = this;

    const browseDescription = [{
      nodeId: methodId,
      referenceTypeId: resolveNodeId("HasProperty"),
      browseDirection: BrowseDirection.Forward,
      nodeClassMask: 0,// browse_service.makeNodeClassMask("Variable"),
      includeSubtypes: true,
      resultMask: makeResultMask("BrowseName")
    }];

      // Xx console.log("xxxx browseDescription", util.inspect(browseDescription, {colors: true, depth: 10}));
    self.browse(browseDescription, (err, results) => {
          /* istanbul ignore next */
      if (err) {
        return callback(err);
      }
      results[0].references = results[0].references || [];

          // xx console.log("xxxx results", util.inspect(results, {colors: true, depth: 10}));
      let inputArgumentRef = results[0].references.filter(r => r.browseName.name === "InputArguments");

          // note : InputArguments property is optional thus may be missing
      inputArgumentRef = (inputArgumentRef.length === 1)  ? inputArgumentRef[0] : null;

      let outputArgumentRef = results[0].references.filter(r => r.browseName.name === "OutputArguments");

          // note : OutputArguments property is optional thus may be missing
      outputArgumentRef = (outputArgumentRef.length === 1)  ? outputArgumentRef[0] : null;

          // xx console.log("xxxx argument", util.inspect(argument, {colors: true, depth: 10}));
          // xx console.log("xxxx argument nodeId", argument.nodeId.toString());

      let inputArguments = [];

      let outputArguments = [];

      const nodesToRead = [];
      const actions = [];

      if (inputArgumentRef) {
        nodesToRead.push({
          nodeId: inputArgumentRef.nodeId,
          attributeId: AttributeIds.Value
        });
        actions.push((result) => { inputArguments = result.value.value; });
      }
      if (outputArgumentRef) {
        nodesToRead.push({
          nodeId: outputArgumentRef.nodeId,
          attributeId: AttributeIds.Value
        });
        actions.push((result) => { outputArguments = result.value.value; });
      }

      if (nodesToRead.length === 0) {
        return callback(null, inputArguments, outputArguments);
      }
          // now read the variable
      self.read(nodesToRead, (err, unused_nodesToRead, results) => {
              /* istanbul ignore next */
        if (err) {
          return callback(err);
        }

        results.forEach((result, index) => { actions[index].call(null,result); });

              // xx console.log("xxxx result", util.inspect(result, {colors: true, depth: 10}));
        callback(null, inputArguments, outputArguments);
      });
    });
  }

  /**
   * @method queryFirst
   * @param queryFirstRequest {queryFirstRequest}
   * @param callback {Function}
   * @param callback.err {Error|null}
   * @param callback.response {queryFirstResponse}
   *
   */
  queryFirst(queryFirstRequest, callback) {
    const self = this;
    assert(_.isFunction(callback));

    const request = new query_service.QueryFirstRequest(queryFirstRequest);

    self.performMessageTransaction(request, (err, response) => {
          /* istanbul ignore next */
      if (err) {
        return callback(err);
      }
      assert(response instanceof query_service.QueryFirstResponse);
      callback(null, response.results);
    });
  }

  startKeepAliveManager() {
    const self = this;
    assert(!self._keepAliveManager,"keepAliveManger already started");
    self._keepAliveManager = new ClientSessionKeepAliveManager(this);


    self._keepAliveManager.on("failure",() => {
      self.stopKeepAliveManager();
          /**
           * raised when a keep-alive request has failed on the session, may be the session has timeout
           * unexpectidaly on the server side, may be the connection is broken.
           * @event keepalive_failure
           */
      self.emit("keepalive_failure");
    });
    self._keepAliveManager.on("keepalive",(state) => {
          /**
           * @event keepalive
           */
      self.emit("keepalive",state);
    });
    self._keepAliveManager.start();
  }

  stopKeepAliveManager() {
    const self = this;
    if (self._keepAliveManager) {
      self._keepAliveManager.stop();
      self._keepAliveManager = null;
    }
  }

  dispose() {
    assert(this._closeEventHasBeenEmmitted);
    this._terminatePublishEngine();
    this.stopKeepAliveManager();
    this.removeAllListeners();
  }

  toString() {
    const now = Date.now();
    const session = this;
    console.log(" name..................... ",session.name);
    console.log(" sessionId................ ",session.sessionId);
    console.log(" authenticationToken...... ",session.authenticationToken);
    console.log(" timeout.................. ",session.timeout);
    console.log(" serverNonce.............. ",session.serverNonce.toString("hex"));
    console.log(" serverCertificate........ ",session.serverCertificate.toString("base64"));
    console.log(" serverSignature.......... ",session.serverSignature);
    console.log(" lastRequestSentTime...... ",new Date(session.lastRequestSentTime).toISOString(), now - session.lastRequestSentTime);
    console.log(" lastResponseReceivedTime. ",new Date(session.lastResponseReceivedTime).toISOString(), now - session.lastResponseReceivedTime);
  }

  /**
   * retrieve the built-in DataType of a Variable, from its DataType attribute
   * useful to determine which DataType to use when constructing a Variant
   * @param nodeId {NodeId} the node id of the variable to query
   * @param callback {Function} the callback function
   * @param callback.err
   * @param callback.result {DataType}
   * @async
   *
   *
   * @example
   *     var session = ...; // ClientSession
   *     var nodeId = opcua.VariableIds.Server_ServerStatus_CurrentTime;
   *     session.getBuildInDataType(nodeId,function(err,dataType) {
   *        assert(dataType === opcua.DataType.DateTime);
   *     });
   *     // or
   *     nodeId = opcua.coerceNodeId("ns=411;s=Scalar_Static_ImagePNG");
   *     session.getBuildInDataType(nodeId,function(err,dataType) {
   *        assert(dataType === opcua.DataType.ByteString);
   *     });
   *
   */
  getBuiltInDataType(nodeId, callback) {
    let dataTypeId = null;
    let dataType;
    const session = this;
    const nodes_to_read = [
      {
        nodeId,
        attributeId: AttributeIds.DataType
      }
    ];
    session.read(nodes_to_read, 0, (err, nodes_to_read, dataValues) => {
      if (err) return callback(err);
      if (dataValues[0].statusCode != StatusCodes.Good) {
        return callback(new Error(`cannot read DataType Attribute ${dataValues[0].statusCode.toString()}`));
      }
      dataTypeId = dataValues[0].value.value;
      assert(dataTypeId instanceof NodeId);
      __findBasicDataType(session,dataTypeId,callback);
    });
  }

  resumePublishEngine() {
    const self = this;

    if (self._publishEngine.subscriptionCount > 0) {
      self._publishEngine.replenish_publish_request_queue();
    }
  }
  /**
 * the endpoint on which this session is operating
 * @property endpoint
 * @type {EndpointDescription}
 */
  get endpoint() {
    return this._client.endpoint;
  }

}

function coerceBrowseDescription(data) {
  if (typeof data === "string" || data instanceof NodeId) {
    return coerceBrowseDescription({
      nodeId: data,
      includeSubtypes: true,
      browseDirection: BrowseDirection.Both,
      nodeClassMask: 0,
      resultMask: 63
    });
  } 
  data.nodeId = resolveNodeId(data.nodeId);
  data.referenceTypeId = data.referenceTypeId ? resolveNodeId(data.referenceTypeId) : null;
  return new BrowseDescription(data);
}


const resultMask = makeResultMask("ReferenceType");

function __findBasicDataType(session,dataTypeId,callback) {
  assert(dataTypeId instanceof NodeId);

  if (dataTypeId.value <= 25) {
        // we have a well-known DataType
    const dataType = DataType.get(dataTypeId.value);
    callback(null,dataType);
  } else {
        // let's browse for the SuperType of this object
    const nodeToBrowse = new BrowseDescription({
      referenceTypeId: makeNodeId(ReferenceTypeIds.HasSubtype),
      includeSubtypes: false,
      browseDirection: BrowseDirection.Inverse,
      nodeId: dataTypeId,
      resultMask
    });

    session.browse([nodeToBrowse],(err, results) => {
      const result = results[0];
      if (err) return callback(err);
      const baseDataType = result.references[0].nodeId;
      return __findBasicDataType(session,baseDataType,callback);
    });
  }
}

export default ClientSession ;

