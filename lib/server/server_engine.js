/**
 * @module opcua.server
 */

import assert from "better-assert";
import async from "async";
import { NodeClass } from "lib/datamodel/nodeclass";
import { NodeId } from "lib/datamodel/nodeid";
import { resolveNodeId } from "lib/datamodel/nodeid";
import { makeNodeId } from "lib/datamodel/nodeid";
import { NodeIdType } from "lib/datamodel/nodeid";
import { NumericRange } from "lib/datamodel/numeric_range";
import { BrowseDirection, BrowseResult } from "lib/services/browse_service";


import {
  ReadRequest,
  AttributeIds,
  TimestampsToReturn
} from "lib/services/read_service";

import { BaseNode } from "lib/address_space/base_node";
import { UAObject } from "lib/address_space/ua_object";
import { UAVariable } from "lib/address_space/ua_variable";
import { HistoryReadRequest, HistoryReadDetails, HistoryReadResult } from "lib/services/historizing_service";

import { DataValue } from "lib/datamodel/datavalue";
import { Variant } from "lib/datamodel/variant";
import { DataType } from "lib/datamodel/variant";
import { VariantArrayType } from "lib/datamodel/variant";
import { isValidVariant } from "lib/datamodel/variant";
import { LocalizedText } from "lib/datamodel/localized_text";
import { BuildInfo } from "lib/datamodel/buildinfo";
import util from "util";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { StatusCode } from "lib/datamodel/opcua_status_code";
import _ from "underscore";
import { AddressSpace } from "lib/address_space/address_space";

import { generate_address_space } from "lib/address_space/load_nodeset2";
import { ServerSession } from "lib/server/server_session";
import { VariableIds } from "lib/opcua_node_ids";
import { MethodIds } from "lib/opcua_node_ids";
import { ObjectIds } from "lib/opcua_node_ids";
import { ReferenceType } from "lib/address_space/referenceType";
import { EventEmitter } from "events";
import { ServerState } from "schemas/39394884f696ff0bf66bacc9a8032cc074e0158e/ServerState_enum";
import { ServerStatus } from "_generated_/_auto_generated_ServerStatus";
import { ServerDiagnosticsSummary } from "_generated_/_auto_generated_ServerDiagnosticsSummary";
import { constructFilename } from "lib/misc/utils";
import { ApplicationDescription } from "lib/services/get_endpoints_service";
import { ServerCapabilities } from "./server_capabilities";
import { bindExtObjArrayNode } from "lib/address_space/extension_object_array_node";
import { ServerSidePublishEngine } from "lib/server/server_publish_engine";
import { TransferResult } from "_generated_/_auto_generated_TransferResult";
import { CallMethodResult } from "lib/services/call_service";

import { Argument } from "lib/datamodel/argument_list";
import { apply_timestamps } from "lib/datamodel/datavalue";
import { WriteValue } from "lib/services/write_service";

import { 
  make_debugLog, 
  checkDebugFlag,
  trace_from_this_projet_only 
} from "lib/misc/utils";

import d from "lib/address_space/address_space_add_method";


const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

/**
 * @class ServerEngine
 * @extends EventEmitter
 * @uses ServerSidePublishEngine
 * @param options {Object}
 * @param options.buildInfo
 * @param [options.isAuditing = false ] {Boolean}
 * @param [options.serverCapabilities]
 * @param [options.serverCapabilities.serverProfileArray]
 * @param [options.serverCapabilities.localeIdArray]
 * @param options.applicationUri {String} the application URI.
 * @constructor
 */
class ServerEngine extends EventEmitter {
  constructor(options = {}) {
    super(...arguments);
    options.buildInfo = options.buildInfo || {};

    EventEmitter.apply(this, arguments);

    this._sessions = {};
    this._closedSessions = {};

    this.isAuditing = _.isBoolean(options.isAuditing) ? options.isAuditing : false;

    // ---------------------------------------------------- ServerStatus
    this.serverStatus = new ServerStatus({
      startTime: new Date(),
      currentTime: new Date(),
      state: ServerState.NoConfiguration,
      buildInfo: options.buildInfo,
      secondsTillShutdown: 10,
      shutdownReason: { text: "" }
    });

    var self = this;

    this.serverStatus.__defineGetter__("secondsTillShutdown", () => self.secondsTillShutdown());

    this.serverStatus.__defineGetter__("currentTime", () => new Date());
    this.serverStatus.__defineSetter__("currentTime", (value) => {
      // DO NOTHING currentTime is readonly
    });

    // --------------------------------------------------- ServerCapabilities
    options.serverCapabilities = options.serverCapabilities || {};
    options.serverCapabilities.serverProfileArray = options.serverCapabilities.serverProfileArray || [];
    options.serverCapabilities.localeIdArray = options.serverCapabilities.localeIdArray || ["en-EN", "fr-FR"];

    this.serverCapabilities = new ServerCapabilities(options.serverCapabilities);

    // --------------------------------------------------- serverDiagnosticsSummary
    this.serverDiagnosticsSummary = new ServerDiagnosticsSummary({

    });
    assert(this.serverDiagnosticsSummary.hasOwnProperty("currentSessionCount"));

    var self = this;
    this.serverDiagnosticsSummary.__defineGetter__("currentSessionCount", () => Object.keys(self._sessions).length);
    assert(this.serverDiagnosticsSummary.hasOwnProperty("currentSubscriptionCount"));
    this.serverDiagnosticsSummary.__defineGetter__("currentSubscriptionCount", () => {
      // currentSubscriptionCount returns the total number of subscriptions
      // that are currently active on all sessions
      let counter = 0;
      _.values(self._sessions).forEach((session) => {
        counter += session.currentSubscriptionCount;
      });
      return counter;
    });

    this.status = "creating";

    this.setServerState(ServerState.NoConfiguration);

    this.addressSpace = null;

    this._shutdownTask = [];

    this._applicationUri = options.applicationUri || "<unset _applicationUri>";
  }

  /**
   * register a function that will be called when the server will perform its shut down.
   * @method registerShutdownTask
   */
  registerShutdownTask(task) {
    assert(_.isFunction(task));
    this._shutdownTask.push(task);
  }

  /**
   * @method shutdown
   */
  shutdown() {
    const self = this;

    self.status = "shutdown";
    self.setServerState(ServerState.Shutdown);

    // delete any existing sessions
    const tokens = Object.keys(self._sessions).map((key) => {
      const session = self._sessions[key];
      return session.authenticationToken;
    });

    // xx console.log("xxxxxxxxx ServerEngine.shutdown must terminate "+ tokens.length," sessions");

    tokens.forEach((token) => {
      self.closeSession(token, true, "Terminated");
    });

    // all sessions must have been terminated
    assert(self.currentSessionCount === 0);

    self._shutdownTask.push(disposeAddressSpace);

    // perform registerShutdownTask
    self._shutdownTask.forEach((task) => {
      task.call(self);
    });
  }

  /**
   * @method secondsTillShutdown
   * @return {UInt32} the approximate number of seconds until the server will be shut down. The
   * value is only relevant once the state changes into SHUTDOWN.
   */
  secondsTillShutdown() {
    return; // ToDo: implement a correct solution here
    1;
  }

  setServerState(serverState) {
    assert(serverState !== null && serverState !== undefined);
    this.serverStatus.state = serverState;
  }

  /**
   * @method initialize
   * @async
   *
   * @param options {Object}
   * @param options.nodeset_filename {String} - [option](default : 'mini.Node.Set2.xml' )
   * @param callback
   */
  initialize(options, callback) {
    const self = this;
    assert(!self.addressSpace); // check that 'initialize' has not been already called

    self.status = "initializing";

    options = options || {};
    assert(_.isFunction(callback));

    options.nodeset_filename = options.nodeset_filename || standard_nodeset_file;

    const startTime = new Date();

    debugLog("Loading ", options.nodeset_filename, "...");

    self.addressSpace = new AddressSpace();

    // register namespace 1 (our namespace);
    const serverNamespaceIndex = self.addressSpace.registerNamespace(self.serverNamespaceUrn);
    assert(serverNamespaceIndex === 1);

    generate_address_space(self.addressSpace, options.nodeset_filename, () => {
      const endTime = new Date();
      debugLog("Loading ", options.nodeset_filename, " done : ", endTime - startTime, " ms");

      function findObjectNodeId(name) {
        const obj = self.addressSpace.findNode(name);
        return obj ? obj.nodeId : null;
      }

      self.FolderTypeId = findObjectNodeId("FolderType");
      self.BaseObjectTypeId = findObjectNodeId("BaseObjectType");
      self.BaseDataVariableTypeId = findObjectNodeId("BaseDataVariableType");

      self.rootFolder = self.addressSpace.findNode("RootFolder");
      assert(self.rootFolder.readAttribute);

      self.setServerState(ServerState.Running);

      function bindVariableIfPresent(nodeId, opts) {
        assert(nodeId instanceof NodeId);
        assert(!nodeId.isEmpty());
        const obj = self.addressSpace.findNode(nodeId);
        if (obj) {
          __bindVariable(self, nodeId, opts);
        }
        return obj;
      }


      // -------------------------------------------- install default get/put handler
      const server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255
      bindVariableIfPresent(server_NamespaceArray_Id, {
        get() {
          return new Variant({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: self.addressSpace.getNamespaceArray()
          });
        },
        set: null // read only
      });

      const server_NameUrn_var = new Variant({
        dataType: DataType.String,
        arrayType: VariantArrayType.Array,
        value: [
          self.serverNameUrn // this is us !
        ]
      });
      const server_ServerArray_Id = makeNodeId(VariableIds.Server_ServerArray); // ns=0;i=2254

      bindVariableIfPresent(server_ServerArray_Id, {
        get() {
          return server_NameUrn_var;
        },
        set: null // read only
      });


      function bindStandardScalar(id, dataType, func, setter_func) {
        assert(_.isNumber(id));
        assert(_.isFunction(func));
        assert(_.isFunction(setter_func) || !setter_func);
        assert(dataType !== null); // check invalid dataType

        let setter_func2 = null;
        if (setter_func) {
          setter_func2 = (variant) => {
            const variable2 = !!variant.value;
            setter_func(variable2);
            return StatusCodes.Good;
          };
        }

        const nodeId = makeNodeId(id);

        // make sur the provided function returns a valid value for the variant type
        // This test may not be exhaustive but it will detect obvious mistakes.
        assert(isValidVariant(VariantArrayType.Scalar, dataType, func()));
        return bindVariableIfPresent(nodeId, {
          get() {
            return new Variant({
              dataType,
              arrayType: VariantArrayType.Scalar,
              value: func()
            });
          },
          set: setter_func2

        });
      }

      function bindStandardArray(id, variantDataType, dataType, func) {
        assert(_.isFunction(func));
        assert(variantDataType !== null); // check invalid dataType

        const nodeId = makeNodeId(id);

        // make sur the provided function returns a valid value for the variant type
        // This test may not be exhaustive but it will detect obvious mistakes.
        assert(isValidVariant(VariantArrayType.Array, dataType, func()));

        bindVariableIfPresent(nodeId, {
          get() {
            const value = func();
            assert(_.isArray(value));
            return new Variant({
              dataType: variantDataType,
              arrayType: VariantArrayType.Array,
              value
            });
          },
          set: null // read only
        });
      }

      bindStandardScalar(VariableIds.Server_ServiceLevel,
        DataType.Byte, () => 255);

      bindStandardScalar(VariableIds.Server_Auditing,
        DataType.Boolean, () => self.isAuditing);


      function bindServerDiagnostics() {
        let serverDiagnostics_Enabled = false;

        bindStandardScalar(VariableIds.Server_ServerDiagnostics_EnabledFlag,
          DataType.Boolean, () => serverDiagnostics_Enabled, (newFlag) => {
            serverDiagnostics_Enabled = newFlag;
          });


        const serverDiagnosticsSummary_var = new Variant({
          dataType: DataType.ExtensionObject,
          value: self.serverDiagnosticsSummary
        });
        bindVariableIfPresent(makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary), {
          get() {
            return serverDiagnosticsSummary_var;
          },
          set: null
        });

        const serverDiagnosticsSummary = self.addressSpace.findNode(makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary));
        if (serverDiagnosticsSummary) {
          serverDiagnosticsSummary.bindExtensionObject();
        }
      }

      function bindServerStatus() {
        bindVariableIfPresent(makeNodeId(VariableIds.Server_ServerStatus), {
          get() {
            const serverStatus_var = new Variant({
              dataType: DataType.ExtensionObject,
              value: self.serverStatus.clone()
            });
            return serverStatus_var;
          },
          set: null
        });

        const serverStatus = self.addressSpace.findNode(makeNodeId(VariableIds.Server_ServerStatus));
        if (serverStatus) {
          serverStatus.bindExtensionObject();
          serverStatus.miminumSamplingInterval = 250;
        }

        const currentTimeNode = self.addressSpace.findNode(makeNodeId(VariableIds.Server_ServerStatus_CurrentTime));

        if (currentTimeNode) {
          currentTimeNode.miminumSamplingInterval = 250;
        }
      }

      function bindServerCapabilities() {
        bindStandardArray(VariableIds.Server_ServerCapabilities_ServerProfileArray,
          DataType.String, "String", () => self.serverCapabilities.serverProfileArray);

        bindStandardArray(VariableIds.Server_ServerCapabilities_LocaleIdArray,
          DataType.String, "LocaleId", () => self.serverCapabilities.localeIdArray);

        bindStandardScalar(VariableIds.Server_ServerCapabilities_MinSupportedSampleRate,
          DataType.Double, () => self.serverCapabilities.minSupportedSampleRate);

        bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxBrowseContinuationPoints,
          DataType.UInt16, () => self.serverCapabilities.maxBrowseContinuationPoints);

        bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxQueryContinuationPoints,
          DataType.UInt16, () => self.serverCapabilities.maxQueryContinuationPoints);

        bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxHistoryContinuationPoints,
          DataType.UInt16, () => self.serverCapabilities.maxHistoryContinuationPoints);

        bindStandardArray(VariableIds.Server_ServerCapabilities_SoftwareCertificates,
          DataType.ByteString, "SoftwareCertificates", () => self.serverCapabilities.softwareCertificates);

        bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxArrayLength,
          DataType.UInt32, () => self.serverCapabilities.maxArrayLength);

        bindStandardScalar(VariableIds.Server_ServerCapabilities_MaxStringLength,
          DataType.UInt32, () => self.serverCapabilities.maxStringLength);

        function bindOperationLimits(operationLimits) {
          assert(_.isObject(operationLimits));

          function upperCaseFirst(str) {
            return str.slice(0, 1).toUpperCase() + str.slice(1);
          }

          // Xx bindStandardArray(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerWrite,
          // Xx     DataType.UInt32, "UInt32", function () {  return operationLimits.maxNodesPerWrite;  });
          const keys = Object.keys(operationLimits);

          keys.forEach((key) => {
            const uid = `Server_ServerCapabilities_OperationLimits_${upperCaseFirst(key)}`;
            const nodeId = makeNodeId(VariableIds[uid]);
            // xx console.log("xxx Binding ".bgCyan,uid,nodeId.toString());
            assert(!nodeId.isEmpty());

            bindStandardScalar(VariableIds[uid],
              DataType.UInt32, () => operationLimits[key]);
          });
        }
        bindOperationLimits(self.serverCapabilities.operationLimits);
      }

      bindServerDiagnostics();

      bindServerStatus();

      bindServerCapabilities();

      function bindExtraStuff() {
        // mainly for compliance

        // The version number for the data type description. i=104
        bindStandardScalar(VariableIds.DataTypeDescriptionType_DataTypeVersion,
          DataType.UInt16, () => 0.0);

        // i=111
        bindStandardScalar(VariableIds.ModellingRuleType_NamingRule,
          DataType.UInt16, () => 0.0);

        // i=112
        bindStandardScalar(VariableIds.ModellingRule_Mandatory_NamingRule,
          DataType.UInt16, () => 0.0);

        // i=113
        bindStandardScalar(VariableIds.ModellingRule_Optional_NamingRule,
          DataType.UInt16, () => 0.0);
      }

      bindExtraStuff();

      self.__internal_bindMethod(makeNodeId(MethodIds.Server_GetMonitoredItems), getMonitoredItemsId.bind(self));

      function prepareServerDiagnostics() {
        const addressSpace = self.addressSpace;

        if (!addressSpace.rootFolder.objects) {
          return;
        }
        const server = addressSpace.rootFolder.objects.server;

        if (!server) {
          return;
        }

        // create SessionsDiagnosticsSummary
        const serverDiagnostics = server.getComponentByName("ServerDiagnostics");

        if (!serverDiagnostics) {
          return;
        }
        const subscriptionDiagnosticsArray = serverDiagnostics.getComponentByName("SubscriptionDiagnosticsArray");

        assert(subscriptionDiagnosticsArray instanceof UAVariable);

        bindExtObjArrayNode(subscriptionDiagnosticsArray, "SubscriptionDiagnosticsType", "subscriptionId");
      }
      prepareServerDiagnostics();


      self.status = "initialized";
      setImmediate(callback);
    });
  }

  __findObject(nodeId) {
    // coerce nodeToBrowse to NodeId
    try {
      nodeId = resolveNodeId(nodeId);
    } catch (err) {
      return null;
    }
    assert(nodeId instanceof NodeId);
    return this.addressSpace.findNode(nodeId);
  }

  /**
   *
   * @method browseSingleNode
   * @param nodeId {NodeId|String} : the nodeid of the element to browse
   * @param browseDescription
   * @param browseDescription.browseDirection {BrowseDirection} :
   * @param browseDescription.referenceTypeId {String|NodeId}
   * @param [session] {ServerSession}
   * @return {BrowseResult}
   */
  browseSingleNode(nodeId, browseDescription, session) {
    // create default browseDescription
    browseDescription = browseDescription || {};
    browseDescription.browseDirection = browseDescription.browseDirection || BrowseDirection.Forward;


    const self = this;
    assert(self.addressSpace instanceof AddressSpace); // initialize not called
    assert(browseDescription.browseDirection);

    // xx console.log(util.inspect(browseDescription,{colors:true,depth:5}));
    browseDescription = browseDescription || {};

    if (typeof nodeId === "string") {
      const node = self.addressSpace.findNode(self.addressSpace.resolveNodeId(nodeId));
      if (node) {
        nodeId = node.nodeId;
      }
    }


    const browseResult = {
      statusCode: StatusCodes.Good,
      continuationPoint: null,
      references: null
    };
    if (browseDescription.browseDirection === BrowseDirection.Invalid) {
      browseResult.statusCode = StatusCodes.BadBrowseDirectionInvalid;
      return new BrowseResult(browseResult);
    }

    // check if referenceTypeId is correct
    if (browseDescription.referenceTypeId instanceof NodeId) {
      if (browseDescription.referenceTypeId.value === 0) {
        browseDescription.referenceTypeId = null;
      } else {
        const rf = self.addressSpace.findNode(browseDescription.referenceTypeId);
        if (!rf || !(rf instanceof ReferenceType)) {
          browseResult.statusCode = StatusCodes.BadReferenceTypeIdInvalid;
          return new BrowseResult(browseResult);
        }
      }
    }

    const obj = self.__findObject(nodeId);
    if (!obj) {
      // Object Not Found
      browseResult.statusCode = StatusCodes.BadNodeIdUnknown;
      // xx console.log("xxxxxx browsing ",nodeId.toString() , " not found" );
    } else {
      browseResult.statusCode = StatusCodes.Good;
      browseResult.references = obj.browseNode(browseDescription, session);
    }
    return new BrowseResult(browseResult);
  }

  /**
   *
   * @method browse
   * @param nodesToBrowse {BrowseDescription[]}
   * @param [session] {ServerSession}
   * @return {BrowseResult[]}
   */
  browse(nodesToBrowse, session) {
    const self = this;
    assert(self.addressSpace instanceof AddressSpace); // initialize not called
    assert(_.isArray(nodesToBrowse));

    const results = [];
    nodesToBrowse.forEach((browseDescription) => {
      const nodeId = resolveNodeId(browseDescription.nodeId);

      const r = self.browseSingleNode(nodeId, browseDescription, session);
      results.push(r);
    });
    return results;
  }

  /**
   *
   * @method readSingleNode
   * @param nodeId
   * @param attributeId {AttributeId}
   * @param [timestampsToReturn=TimestampsToReturn.Neither]
   * @return {DataValue}
   */
  readSingleNode(nodeId, attributeId, timestampsToReturn) {
    return this._readSingleNode({
      nodeId,
      attributeId
    }, timestampsToReturn);
  }

  _readSingleNode(nodeToRead, timestampsToReturn) {
    const self = this;
    const nodeId = nodeToRead.nodeId;
    const attributeId = nodeToRead.attributeId;
    const indexRange = nodeToRead.indexRange;
    const dataEncoding = nodeToRead.dataEncoding;
    assert(self.addressSpace instanceof AddressSpace); // initialize not called

    if (timestampsToReturn === TimestampsToReturn.Invalid) {
      return new DataValue({ statusCode: StatusCodes.BadTimestampsToReturnInvalid });
    }

    timestampsToReturn = (_.isObject(timestampsToReturn)) ? timestampsToReturn : TimestampsToReturn.Neither;

    const obj = self.__findObject(nodeId);

    if (!obj) {
      // may be return BadNodeIdUnknown in dataValue instead ?
      // Object Not Found
      return new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown });
    } 
      // check access
      //    BadUserAccessDenied
      //    BadNotReadable
      //    invalid attributes : BadNodeAttributesInvalid
      //    invalid range      : BadIndexRangeInvalid
    try {
      var dataValue = obj.readAttribute(attributeId, indexRange, dataEncoding);
      assert(dataValue.statusCode instanceof StatusCode);
      assert(dataValue.isValid());
    } catch (err) {
      console.log(" Internal error reading ", obj.nodeId.toString());
      console.log("                        ", err.message);
      return new DataValue({ statusCode: StatusCodes.BadInternalError });
    }


    dataValue = apply_timestamps(dataValue, timestampsToReturn, attributeId);

    return dataValue;
  }

  /**
   *
   *  @method read
   *  @param readRequest {ReadRequest}
   *  @param readRequest.timestampsToReturn  {TimestampsToReturn}
   *  @param readRequest.nodesToRead
   *  @param readRequest.maxAge {Number} maxAge - must be greater or equal than zero.
   *
   *    Maximum age of the value to be read in milliseconds. The age of the value is based on the difference between the
   *    ServerTimestamp and the time when the  Server starts processing the request. For example if the Client specifies a
   *    maxAge of 500 milliseconds and it takes 100 milliseconds until the Server starts  processing the request, the age
   *    of the returned value could be 600 milliseconds  prior to the time it was requested.
   *    If the Server has one or more values of an Attribute that are within the maximum age, it can return any one of the
   *    values or it can read a new value from the data  source. The number of values of an Attribute that a Server has
   *    depends on the  number of MonitoredItems that are defined for the Attribute. In any case, the Client can make no
   *    assumption about which copy of the data will be returned.
   *    If the Server does not have a value that is within the maximum age, it shall attempt to read a new value from the
   *    data source.
   *    If the Server cannot meet the requested maxAge, it returns its 'best effort' value rather than rejecting the
   *    request.
   *    This may occur when the time it takes the Server to process and return the new data value after it has been
   *    accessed is greater than the specified maximum age.
   *    If maxAge is set to 0, the Server shall attempt to read a new value from the data source.
   *    If maxAge is set to the max Int32 value or greater, the Server shall attempt to geta cached value. Negative values
   *    are invalid for maxAge.
   *
   *  @return {DataValue[]}
   */
  read(readRequest) {
    assert(readRequest instanceof ReadRequest);
    assert(readRequest.maxAge >= 0);

    const self = this;
    const timestampsToReturn = readRequest.timestampsToReturn;

    const nodesToRead = readRequest.nodesToRead;

    assert(self.addressSpace instanceof AddressSpace); // initialize not called
    assert(_.isArray(nodesToRead));

    const dataValues = nodesToRead.map((readValueId) => {
      assert(readValueId.indexRange instanceof NumericRange);
      return self._readSingleNode(readValueId, timestampsToReturn);
    });

    assert(dataValues.length === readRequest.nodesToRead.length);
    return dataValues;
  }

  /**
   *
   * @method writeSingleNode
   * @param writeValue {DataValue}
   * @param callback {Function}
   * @param callback.err {Error|null}
   * @param callback.statusCode {StatusCode}
   * @async
   */
  writeSingleNode(writeValue, callback) {
    const self = this;
    assert(_.isFunction(callback));
    assert(writeValue._schema.name === "WriteValue");
    assert(writeValue.value instanceof DataValue);

    if (writeValue.value.value === null) {
      return callback(null, StatusCodes.BadTypeMismatch);
    }

    assert(writeValue.value.value instanceof Variant);
    assert(self.addressSpace instanceof AddressSpace); // initialize not called

    const nodeId = writeValue.nodeId;

    const obj = self.__findObject(nodeId);
    if (!obj) {
      callback(null, StatusCodes.BadNodeIdUnknown);
    } else {
      obj.writeAttribute(writeValue, callback);
    }
  }

  /**
   * write a collection of nodes
   * @method write
   * @param nodesToWrite {Object[]}
   * @param callback {Function}
   * @param callback.err
   * @param callback.results {StatusCode[]}
   * @async
   */
  write(nodesToWrite, callback) {
    assert(_.isFunction(callback));

    const self = this;

    assert(self.addressSpace instanceof AddressSpace); // initialize not called

    function performWrite(writeValue, inner_callback) {
      assert(writeValue instanceof WriteValue);
      self.writeSingleNode(writeValue, inner_callback);
    }

    async.map(nodesToWrite, performWrite, (err, statusCodes) => {
      assert(_.isArray(statusCodes));
      callback(err, statusCodes);
    });
  }

  /**
   *
   * @method historyReadSingleNode
   * @param nodeId
   * @param attributeId {AttributeId}
   * @param historyReadDetails {HistoryReadDetails}
   * @param [timestampsToReturn=TimestampsToReturn.Neither]
   * @param callback {Function}
   * @param callback.err
   * @param callback.results {HistoryReadResult}
   */
  historyReadSingleNode(nodeId, attributeId, historyReadDetails, timestampsToReturn, callback) {
    this._historyReadSingleNode({
      nodeId,
      attributeId
    }, historyReadDetails, timestampsToReturn, callback);
  }

  _historyReadSingleNode(nodeToRead, historyReadDetails, timestampsToReturn, callback) {
    const self = this;
    const nodeId = nodeToRead.nodeId;
    const indexRange = nodeToRead.indexRange;
    const dataEncoding = nodeToRead.dataEncoding;
    const continuationPoint = nodeToRead.continuationPoint;
    assert(self.addressSpace instanceof AddressSpace); // initialize not called

    if (timestampsToReturn === TimestampsToReturn.Invalid) {
      return new DataValue({ statusCode: StatusCodes.BadTimestampsToReturnInvalid });
    }

    timestampsToReturn = (_.isObject(timestampsToReturn)) ? timestampsToReturn : TimestampsToReturn.Neither;

    const obj = self.__findObject(nodeId);

    if (!obj) {
      // may be return BadNodeIdUnknown in dataValue instead ?
      // Object Not Found
      callback(null, new HistoryReadResult({ statusCode: StatusCodes.BadNodeIdUnknown }));
    } else {
      if (!obj.historyRead) {
        // note : Object and View may also support historyRead to provide Event historical data
        //        todo implement historyRead for Object and View
        const msg = ` this node doesn't provide historyRead! probably not a UAVariable\n ${obj.nodeId.toString()} ${obj.browseName.toString()}\nwith ${nodeToRead.toString()}\nHistoryReadDetails ${historyReadDetails.toString()}`;
        if (doDebug) {
          console.log("ServerEngine#_historyReadSingleNode ".cyan, msg.white.bold);
        }
        const err = new Error(msg);
        // object has no historyRead method
        return setImmediate(callback.bind(null, err));
      }
      // check access
      //    BadUserAccessDenied
      //    BadNotReadable
      //    invalid attributes : BadNodeAttributesInvalid
      //    invalid range      : BadIndexRangeInvalid
      obj.historyRead(historyReadDetails, indexRange, dataEncoding, continuationPoint, (err, result) => {
        assert(result.statusCode instanceof StatusCode);
        assert(result.isValid());
        // result = apply_timestamps(result, timestampsToReturn, attributeId);
        callback(err, result);
      });
    }
  }

  /**
   *
   *  @method historyRead
   *  @param historyReadRequest {HistoryReadRequest}
   *  @param historyReadRequest.requestHeader  {RequestHeader}
   *  @param historyReadRequest.historyReadDetails  {HistoryReadDetails}
   *  @param historyReadRequest.timestampsToReturn  {TimestampsToReturn}
   *  @param historyReadRequest.releaseContinuationPoints  {Boolean}
   *  @param historyReadRequest.nodesToRead {HistoryReadValueId[]}
   *  @param callback {Function}
   *  @param callback.err
   *  @param callback.results {HistoryReadResult[]}
   */
  historyRead(historyReadRequest, callback) {
    assert(historyReadRequest instanceof HistoryReadRequest);
    assert(_.isFunction(callback));

    const self = this;
    const timestampsToReturn = historyReadRequest.timestampsToReturn;
    const historyReadDetails = historyReadRequest.historyReadDetails;

    const nodesToRead = historyReadRequest.nodesToRead;

    assert(historyReadDetails instanceof HistoryReadDetails);
    assert(self.addressSpace instanceof AddressSpace); // initialize not called
    assert(_.isArray(nodesToRead));

    const historyData = [];
    async.eachSeries(nodesToRead, (readValueId, cbNode) => {
      self._historyReadSingleNode(readValueId, historyReadDetails, timestampsToReturn, (err, result) => {
        if (err && !result) {
          result = new HistoryReadResult({ statusCode: StatusCodes.BadInternalError });
        }
        historyData.push(result);
        async.setImmediate(cbNode); // it's not guaranteed that the historical read process is really asynchronous
      });
    }, (err) => {
      assert(historyData.length === nodesToRead.length);
      callback(err, historyData);
    });
  }

  /**
   * @method bindMethod
   * @param nodeId {NodeId} the node id of the method
   * @param func
   * @param func.inputArguments               {Array<Variant>}
   * @param func.context                      {Object}
   * @param func.callback                     {Function}
   * @param func.callback.err                 {Error}
   * @param func.callback.callMethodResult    {CallMethodResult}
   */
  __internal_bindMethod(nodeId, func) {
    const self = this;
    assert(_.isFunction(func));
    assert(nodeId instanceof NodeId);

    const methodNode = self.addressSpace.findNode(nodeId);
    if (!methodNode) {
      return;
    }
    if (methodNode && methodNode.bindMethod) {
      methodNode.bindMethod(func);
    } else {
      // xx console.log((new Error()).stack);
      console.log("WARNING:  cannot bind a method with id ".yellow + nodeId.toString().cyan + ". please check your nodeset.xml file or add this node programmatically".yellow);
      console.log(trace_from_this_projet_only(new Error()));
    }
  }

  getOldestUnactivatedSession() {
    const self = this;
    const tmp = _.filter(self._sessions, session => session.status === "new");
    if (tmp.length === 0) {
      return null;
    }
    let session = tmp[0];
    for (let i = 1; i < session.length; i++) {
      const c = tmp[i];
      if (session.creationDate.getTime() < c.creationDate.getTime()) {
        session = c;
      }
    }
    return session;
  }

  /**
   * create a new server session object.
   * @class ServerEngine
   * @method createSession
   * @param  [options] {Object}
   * @param  [options.sessionTimeout = 1000] {Number} sessionTimeout
   * @param  [options.clientDescription] {ApplicationDescription}
   * @return {ServerSession}
   */
  createSession(options) {
    options = options || {};

    const self = this;

    self.serverDiagnosticsSummary.cumulatedSessionCount += 1;

    self.clientDescription = options.clientDescription || new ApplicationDescription({});

    const sessionTimeout = options.sessionTimeout || 1000;

    assert(_.isNumber(sessionTimeout));

    const session = new ServerSession(self, self.cumulatedSessionCount, sessionTimeout);

    const key = session.authenticationToken.toString();

    self._sessions[key] = session;

    // see spec OPC Unified Architecture,  Part 2 page 26 Release 1.02
    // TODO : When a Session is created, the Server adds an entry for the Client
    // in its SessionDiagnosticsArray Variable


    session.on("new_subscription", (subscription) => {
      self.serverDiagnosticsSummary.cumulatedSubscriptionCount += 1;

      // add the subscription diagnostics in our subscriptions diagnostics array
    });
    session.on("subscription_terminated", (subscription) => {

      // remove the subscription diagnostics in our subscriptions diagnostics array

    });

    // OPC Unified Architecture, Part 4 23 Release 1.03
    // Sessions are terminated by the Server automatically if the Client fails to issue a Service request on the Session
    // within the timeout period negotiated by the Server in the CreateSession Service response. This protects the
    // Server against Client failures and against situations where a failed underlying connection cannot be
    // re-established. Clients shall be prepared to submit requests in a timely manner to prevent the Session from
    // closing automatically. Clients may explicitly terminate sessions using the CloseSession Service.
    session.on("timeout", () => {
      // the session hasn't been active for a while , probably because the client has disconnected abruptly
      // it is now time to close the session completely
      self.serverDiagnosticsSummary.sessionTimeoutCount += 1;
      session.sessionName = session.sessionName || "";

      console.log("Server: closing SESSION ".cyan, session.status, session.sessionName.yellow, " because of timeout = ".cyan, session.sessionTimeout, " has expired without a keep alive".cyan);
      const channel = session.channel;
      if (channel) {
        console.log("channel = ".bgCyan, channel.remoteAddress, " port = ", channel.remotePort);
      }

      // If a Server terminates a Session for any other reason, Subscriptions  associated with the Session,
      // are not deleted. => deleteSubscription= false
      self.closeSession(session.authenticationToken, /* deleteSubscription=*/false,/* reason =*/"Timeout");
    });

    return session;
  }

  /**
   * @method closeSession
   * @param authenticationToken
   * @param deleteSubscriptions {Boolean} : true if sessions's subscription shall be deleted
   * @param {String} [reason = "CloseSession"] the reason for closing the session (shall be "Timeout", "Terminated" or "CloseSession")
   *
   *
   * what the specs say:
   * -------------------
   *
   * If a Client invokes the CloseSession Service then all Subscriptions associated with the Session are also deleted
   * if the deleteSubscriptions flag is set to TRUE. If a Server terminates a Session for any other reason, Subscriptions
   * associated with the Session, are not deleted. Each Subscription has its own lifetime to protect against data loss
   * in the case of a Session termination. In these cases, the Subscription can be reassigned to another Client before
   * its lifetime expires.
   */
  closeSession(authenticationToken, deleteSubscriptions, reason) {
    const self = this;

    reason = reason || "CloseSession";
    assert(_.isString(reason));
    assert(reason === "Timeout" || reason === "Terminated" || reason === "CloseSession" || reason === "Forcing");

    debugLog("ServerEngine.closeSession ", authenticationToken.toString(), deleteSubscriptions);

    const key = authenticationToken.toString();
    const session = self.getSession(key);
    assert(session);

    if (!deleteSubscriptions) {
      if (!self._orphanPublishEngine) {
        self._orphanPublishEngine = new ServerSidePublishEngine({ maxPublishRequestInQueue: 0 });
      }
      ServerSidePublishEngine.transferSubscriptions(session.publishEngine, self._orphanPublishEngine);
    }

    session.close(deleteSubscriptions, reason);

    assert(session.status === "closed");

    // TODO make sure _closedSessions gets cleaned at some point
    self._closedSessions[key] = session;

    delete self._sessions[key];
  }

  findSubscription(subscriptionId) {
    const self = this;

    console.log("findSubscription  ", subscriptionId);
    const subscriptions = [];
    _.map(self._sessions, (session) => {
      if (subscriptions.length) return;
      const subscription = session.publishEngine.getSubscriptionById(subscriptionId);
      if (subscription) {
        console.log("foundSubscription  ", subscriptionId, " in session", session.sessionName);
        subscriptions.push(subscription);
      }
    });
    if (subscriptions.length) {
      assert(subscriptions.length === 1);
      return subscriptions[0];
    }
    return self.findOrphanSubscription(subscriptionId);
  }

  findOrphanSubscription(subscriptionId) {
    const self = this;

    if (!self._orphanPublishEngine) {
      return null;
    }
    return self._orphanPublishEngine.getSubscriptionById(subscriptionId);
  }

  deleteOrphanSubscription(subscription) {
    const self = this;
    assert(self.findSubscription(subscription.id));

    const c = self._orphanPublishEngine.subscriptionCount;
    subscription.terminate();
    assert(self._orphanPublishEngine.subscriptionCount === c - 1);
    return StatusCodes.Good;
  }

  /**
   *
   * @param session           {ServerSession}
   * @param subscriptionId    {IntegerId}
   * @param sendInitialValues {Boolean}
   * @return                  {TransferResult}
   */
  transferSubscription(session, subscriptionId, sendInitialValues) {
    const self = this;
    assert(session instanceof ServerSession);
    assert(_.isNumber(subscriptionId));
    assert(_.isBoolean(sendInitialValues));

    if (subscriptionId <= 0) {
      return new TransferResult({ statusCode: StatusCodes.BadSubscriptionIdInvalid });
    }

    const subscription = self.findSubscription(subscriptionId);
    if (!subscription) {
      return new TransferResult({ statusCode: StatusCodes.BadSubscriptionIdInvalid });
    }
    // // now check that new session has sufficient right
    // if (session.authenticationToken.toString() != subscription.authenticationToken.toString()) {
    //     console.log("ServerEngine#transferSubscription => BadUserAccessDenied");
    //     return new TransferResult({ statusCode: StatusCodes.BadUserAccessDenied });
    // }
    if (session.publishEngine === subscription.publishEngine) {
      // subscription is already in this session !!
      return new TransferResult({ statusCode: StatusCodes.BadNothingToDo });
    }

    const nbSubscriptionBefore = session.publishEngine.subscriptionCount;

    ServerSidePublishEngine.transferSubscription(subscription, session.publishEngine, sendInitialValues);

    assert(subscription.publishEngine === session.publishEngine);
    assert(session.publishEngine.subscriptionCount === nbSubscriptionBefore + 1);

    // TODO If the Server transfers the Subscription to the new Session, the Server shall issue a
    // TODO StatusChangeNotification notificationMessage with the status code Good_SubscriptionTransferred
    // TODO to the old Session.

    return new TransferResult({
      statusCode: StatusCodes.Good,
      availableSequenceNumbers: subscription.getAvailableSequenceNumbers()
    });
  }

  /**
   * retrieve a session by its authenticationToken.
   *
   * @method getSession
   * @param authenticationToken
   * @param activeOnly
   * @return {ServerSession}
   */
  getSession(authenticationToken, activeOnly) {
    const self = this;
    if (!authenticationToken || (authenticationToken.identifierType && (authenticationToken.identifierType.value !== NodeIdType.BYTESTRING.value))) {
      return null;     // wrong type !
    }
    const key = authenticationToken.toString();
    let session = self._sessions[key];
    if (!activeOnly && !session) {
      session = self._closedSessions[key];
    }
    return session;
  }

  /**
   * @method browsePath
   * @param browsePath
   * @return {BrowsePathResult}
   */
  browsePath(browsePath) {
    return this.addressSpace.browsePath(browsePath);
  }

  /**
   *
   * performs a call to ```asyncRefresh``` on all variable nodes that provide an async refresh func.
   *
   * @method refreshValues
   * @param nodesToRefresh {Array<Object>}  an array containing the node to consider
   * Each element of the array shall be of the form { nodeId: <xxx>, attributeIds: <value> }.
   *
   * @param callback {Function}
   * @param callback.err {null|Error}
   * @param callback.data {Array} : an array containing value read
   * The array length matches the number of  nodeIds that are candidate for an async refresh (i.e: nodes that are of type
   * Variable with asyncRefresh func }
   *
   * @async
   */
  refreshValues(nodesToRefresh, callback) {
    const self = this;

    const objs = {};
    for (let i = 0; i < nodesToRefresh.length; i++) {
      const nodeToRefresh = nodesToRefresh[i];
      // only consider node  for which the caller wants to read the Value attribute
      // assuming that Value is requested if attributeId is missing,
      if (nodeToRefresh.attributeId && nodeToRefresh.attributeId !== AttributeIds.Value) {
        continue;
      }
      // ... and that are valid object and instances of Variables ...
      const obj = self.addressSpace.findNode(nodeToRefresh.nodeId);
      if (!obj || !(obj instanceof UAVariable)) {
        continue;
      }
      // ... and that have been declared as asynchronously updating
      if (!_.isFunction(obj.refreshFunc)) {
        continue;
      }
      const key = obj.nodeId.toString();
      if (objs[key]) {
        continue;
      }

      objs[key] = obj;
    }
    if (Object.keys(objs).length == 0) {
      // nothing to do
      return callback(null, []);
    }
    // perform all asyncRefresh in parallel
    async.map(objs, (obj, inner_callback) => {
      obj.asyncRefresh(inner_callback);
    }, (err, arrResult) => {
      callback(err, arrResult);
    });
  }

  get startTime() {
    return this.serverStatus.startTime;
  }

  get currentTime() {
    return this.serverStatus.currentTime;
  }

  get buildInfo() {
    return this.serverStatus.buildInfo;
  }

  /**
   * the number of active sessions
   * @property currentSessionCount
   * @type {Number}
   */
  get currentSessionCount() {
    return this.serverDiagnosticsSummary.currentSessionCount;
  }

  /**
   * the cumulated number of sessions that have been opened since this object exists
   * @property cumulatedSessionCount
   * @type {Number}
   */
  get cumulatedSessionCount() {
    return this.serverDiagnosticsSummary.cumulatedSessionCount;
  }

  /**
   * the number of active subscriptions.
   * @property currentSubscriptionCount
   * @type {Number}
   */
  get currentSubscriptionCount() {
    return this.serverDiagnosticsSummary.currentSubscriptionCount;
  }
  /**
   * the cumulated number of subscriptions that have been created since this object exists
   * @property cumulatedSubscriptionCount
   * @type {Number}
   */
  get cumulatedSubscriptionCount() {
    return this.serverDiagnosticsSummary.cumulatedSubscriptionCount;
  }

  get rejectedSessionCount() {
    return this.serverDiagnosticsSummary.rejectedSessionCount;
  }

  get rejectedRequestsCount() {
    return this.serverDiagnosticsSummary.rejectedRequestsCount;
  }

  get sessionAbortCount() {
    return this.serverDiagnosticsSummary.sessionAbortCount;
  }
  get sessionTimeoutCount() {
    return this.serverDiagnosticsSummary.sessionTimeoutCount;
  }

  get publishingIntervalCount() {
    return this.serverDiagnosticsSummary.publishingIntervalCount;
  }
  /**
 * the name of the server
 * @property serverName
 * @type String
 */
  get serverName() {
    return this.serverStatus.buildInfo.productName;
  }

  /**
   * the server urn
   * @property serverNameUrn
   * @type String
   */
  get serverNameUrn() {
    return this._applicationUri;
  }

  /**
   * the urn of the server namespace
   * @property serverNamespaceName
   * @type String
   */
  get serverNamespaceUrn() {
    return this._applicationUri; // "urn:" + this.serverName;
  }
}


function disposeAddressSpace() {
  if (this.addressSpace) {
    this.addressSpace.dispose();
    delete this.addressSpace;
  }
  this._shutdownTask = [];
}


// binding methods
function getMonitoredItemsId(inputArguments, context, callback) {
  assert(_.isArray(inputArguments));
  assert(_.isFunction(callback));

  assert(context.hasOwnProperty("session"), " expecting a session id in the context object");

  const session = context.session;
  if (!session) {
    return callback(null, { statusCode: StatusCodes.BadInternalError });
  }

  const subscriptionId = inputArguments[0].value;
  const subscription = session.getSubscription(subscriptionId);
  if (!subscription) {
    return callback(null, { statusCode: StatusCodes.BadSubscriptionIdInvalid });
  }
  const result = subscription.getMonitoredItems();
  assert(result.statusCode);
  assert(_.isArray(result.serverHandles));
  assert(_.isArray(result.clientHandles));
  assert(result.serverHandles.length === result.clientHandles.length);
  const callMethodResult = new CallMethodResult({
    statusCode: result.statusCode,
    outputArguments: [
      { dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: result.serverHandles },
      { dataType: DataType.UInt32, arrayType: VariantArrayType.Array, value: result.clientHandles }
    ]
  });
  callback(null, callMethodResult);
}


function __bindVariable(self, nodeId, options) {
  options = options || {};
  // must have a get and a set property
  assert(_.difference(["get", "set"], _.keys(options)).length === 0);

  const obj = self.addressSpace.findNode(nodeId);
  if (obj && obj.bindVariable) {
    obj.bindVariable(options);
    assert(_.isFunction(obj.asyncRefresh));
    assert(_.isFunction(obj.refreshFunc));
  } else {
    // xx console.log((new Error()).stack);
    console.log("Warning: cannot bind object with id ", nodeId.toString(), " please check your nodeset.xml file or add this node programmatically");
  }
}


const standard_nodeset_file = constructFilename("nodesets/Opc.Ua.NodeSet2.xml");
const mini_nodeset_filename = constructFilename("lib/server/mini.Node.Set2.xml");
const part8_nodeset_filename = constructFilename("nodesets/Opc.Ua.NodeSet2.Part8.xml");
const di_nodeset_filename = constructFilename("nodesets/Opc.Ua.Di.NodeSet2.xml");
const adi_nodeset_filename = constructFilename("nodesets/Opc.Ua.Adi.NodeSet2.xml");

export {
  adi_nodeset_filename,
  mini_nodeset_filename,
  part8_nodeset_filename,
  di_nodeset_filename,
  standard_nodeset_file,
  ServerEngine
};

