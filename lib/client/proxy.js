/**
 * @module opcua.client
 */

import async from "async";
import assert from "better-assert";
import _ from "underscore";
import util from "util";
import { EventEmitter } from "events";
import { 
  makeResultMask,
  BrowseDirection,
  makeNodeClassMask
} from "lib/services/browse_service";
import { 
  AttributeIds,
  TimestampsToReturn 
} from "lib/services/read_service";
import { CallMethodRequest } from "lib/services/call_service";

import { ReferenceTypeIds } from "lib/opcua_node_ids";
import { ObjectTypeIds } from "lib/opcua_node_ids";
import { makeNodeId } from "lib/datamodel/nodeid";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { lowerFirstLetter } from "lib/misc/utils";
import { VariantArrayType } from "lib/datamodel/variant";
import { DataType } from "lib/datamodel/variant";
const resultMask = makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition");
import { NodeClass } from "lib/datamodel/nodeclass";
import { Variant } from "lib/datamodel/variant";
import { AccessLevelFlag } from "lib/datamodel/access_level";
import { NodeId } from "lib/datamodel/nodeid";
import { coerceNodeId } from "lib/datamodel/nodeid";
import ClientSession     from "lib/client/ClientSession";


function makeRefId(referenceTypeName) {
  const nodeId = makeNodeId(ReferenceTypeIds[referenceTypeName] || ObjectTypeIds[referenceTypeName]);

    // istanbul ignore next
  if (nodeId.isEmpty()) {
    throw new Error("makeRefId: cannot find ReferenceTypeName + ", referenceTypeName);
  }
  return nodeId;
}

/**
 * @method convertNodeIdToDataTypeAsync
 *
 * @param session             {ClientSession}
 * @param dataTypeId          {NodeId}
 * @param callback            {Function}
 * @param callback.err        {Error|null}
 * @param callback.dataType   {DataType}
 *
 *  @example
 *
 *      var dataTypeId  ="ns=0;i=11"; // Double
 *      convertNodeIdToDataTypeAsync(session,dataTypeId,function(err,dataType) {
 *          assert(!err && dataType === DataType.Double);
 *      });
 *
 *      var dataTypeId  ="ns=0;i=290"; // Duration => SubTypeOf Double
 *      convertNodeIdToDataTypeAsync(session,dataTypeId,function(err,dataType) {
 *          assert(!err && dataType === DataType.Double);
 *      });
 *
 * see also AddressSpace#findCorrespondingBasicDataType
 */
function convertNodeIdToDataTypeAsync(session, dataTypeId, callback) {
  const nodesToRead = [{
    nodeId: dataTypeId,
    attributeId: AttributeIds.BrowseName
  }];

  session.read(nodesToRead, (err, unused, dataValues) => {
        // istanbul ignore next
    if (err) {
      return callback(err);
    }

    const dataValue = dataValues[0];

        // istanbul ignore next
    if (dataValue.statusCode !== StatusCodes.Good) {
      console.log("convertNodeIdToDataTypeAsync: Cannot read browse name for nodeID ".red + dataTypeId.toString());
      var dataType = DataType.Null;
      return callback(null, dataType);
    }

    const dataTypeName = dataValue.value.value;

    if (dataTypeId.namespace === 0 && DataType.get(dataTypeId.value)) {
      var dataType = DataType.get(dataTypeId.value);
      return callback(null, dataType);
    }

        // / example => Duration (i=290) => Double (i=11)
        // read subTypeOf
    const nodesToBrowse = [{
            // BrowseDescription
      referenceTypeId: makeRefId("HasSubtype"),
            // xx nodeClassMask: browse_service.makeNodeClassMask("ObjectType"),
      includeSubtypes: false,
      browseDirection: BrowseDirection.Inverse,
      nodeId: dataTypeId,
      resultMask
    }];
    session.browse(nodesToBrowse, (err, results) => {
            // istanbul ignore next
      if (err) {
        return callback(err);
      }

      const references = results[0].references;

      if (!references || references.length !== 1) {
        return callback(new Error(`cannot find SuperType of ${dataTypeName.toString()}`));
      }
      const nodeId = references[0].nodeId;
      return convertNodeIdToDataTypeAsync(session, nodeId, callback);
    });
  });
}

function convertNodeIdToDataType(dataTypeId) {
  return dataTypeId._dataType;
}

class ProxyBaseNode extends EventEmitter {
  constructor(proxyManager, nodeId) {
    super();
    const self = this;
      /**
       * the object nodeId
       * @property nodeId
       * @type {NodeId}
       */
    self.nodeId = nodeId;

    self.proxyManager = proxyManager;
    assert(self.proxyManager.session, "expecting valid session");
    Object.defineProperty(self, "proxyManager", {
      enumerable: false,
      writable: true
    });
      /**
       * the object's components
       * @property $components
       * @type {Array<ProxyBaseNode>}
       */
    self.$components = [];

      /**
       * the object's properties
       * @property $properties
       * @type {Array<ProxyBaseNode>}
       */
    self.$properties = [];

      /**
       * the object's properties
       * @property $methods
       * @type {Array<ProxyBaseNode>}
       */
    self.$methods = [];

      /**
       * the Folder's elements
       * @property $organizes
       * @type {Array<ProxyBaseNode>}
       */
    self.$organizes = [];

      /**
       * the object's description
       * @property description
       * @type {String}
       */
    self.description = "";
      /**
       * the object's browseName
       * @property browseName
       * @type {String}
       */
    self.browseName = "";
      /**
       * the object's NodeClass
       * @property nodeClass
       * @type {NodeClass}
       */
    self.nodeClass = null;
  }

  /**
   * get a updated Value of the Variable , by using a ReadRequest
   * @method readValue
   * @param callback {Function}
   * @param callback.err {Error|null}
   * @param callback.dataValue {DataValue}
   */
  readValue(callback) {
    const self = this;
    assert(self.proxyManager);

    const session = self.proxyManager.session;
    assert(session);

    const nodeToRead = {
      nodeId: self.nodeId,
      attributeId: AttributeIds.Value
    };
    self.proxyManager.session.read([nodeToRead], (err, unused, results) => {
          // istanbul ignore next
      if (err) {
        return callback(err);
      }

      const result = results[0];
      const data = result.value;
      callback(null, data);
    });
  }

  /**
   * set the Value of the Variable, by using a WriteRequest
   * @method writeValue
   * @param dataValue {DataValue}
   * @param callback {Function}
   * @param callback.err {Error|null}
   */
  writeValue(dataValue, callback) {
    const self = this;
    assert(self.proxyManager);

    const session = self.proxyManager.session;
    assert(session);

    const nodeToWrite = {
      nodeId: self.nodeId,
      attributeId: AttributeIds.Value,
      value: dataValue
    };
    self.proxyManager.session.write([nodeToWrite], (err, results) => {
          // istanbul ignore next
      if (err) {
        return callback(err);
      }

      const result = results[0];
          // / console.log("xxxx r=",results.toString());
      if (result !== StatusCodes.Good) {
        callback(new Error(result.toString()));
      } else {
        callback(null);
      }
    });
  }

  toString() {
    const str = [];
    const self = this;
    str.push(" ProxyObject ");
    str.push(`   browseName     : ${self.browseName.toString()}`);
    str.push(`   typeDefinition : ${self.typeDefinition.toString()}`);
    str.push(`   $components#   : ${self.$components.length.toString()}`);
    str.push(`   $properties#   : ${self.$properties.length.toString()}`);

    return str.join("\n");
  }
}

class ProxyVariable extends ProxyBaseNode {
  constructor(session, nodeId) {
    super(session, nodeId);
  }
}

const ProxyObject = ProxyVariable;

class ObjectExplorer {
  constructor(options) {
    const self = this;
    self.proxyManager = options.proxyManager;
    self.name = options.name;
    self.nodeId = options.nodeId;
    self.parent = options.parent;
  }

  $resolve(callback) {
    const self = this;

    self.proxyManager.getObject(self.nodeId, (err, childObj) => {
          // istanbul ignore next
      if (err) {
        return callback(err);
      }

      self.parent[self.name] = childObj;
      self.parent.$components.push(childObj);

      callback(null);
    });
  }
}

function readUAStructure(proxyManager, obj, callback) {
  const session = proxyManager.session;

    //   0   Object
    //   1   Variable
    //   2   Method
  const nodeId = obj.nodeId;
  const nodesToBrowse = [

        // Components (except Methods)
    {
            // BrowseDescription
      referenceTypeId: makeRefId("HasComponent"),
      nodeClassMask: makeNodeClassMask("Object | Variable"), // we don't want Method here
      includeSubtypes: true,
      browseDirection: BrowseDirection.Forward,
      nodeId,
      resultMask
    },
        // Properties
    {
            // BrowseDescription
      referenceTypeId: makeRefId("HasProperty"),
            // nodeClassMask: browse_service.makeNodeClassMask("Variable"),
      includeSubtypes: true,
      browseDirection: BrowseDirection.Forward,
      nodeId,
      resultMask
    },

        // Methods
    {
            // BrowseDescription
      referenceTypeId: makeRefId("HasComponent"),
      nodeClassMask: makeNodeClassMask("Method"),
      includeSubtypes: true,
      browseDirection: BrowseDirection.Forward,
      nodeId,
      resultMask
    },
        // TypeDefinition
    {
            // BrowseDescription
      referenceTypeId: makeRefId("HasTypeDefinition"),
      includeSubtypes: true,
      browseDirection: BrowseDirection.Both,
      nodeId,
      resultMask

    },
        // FromState
    {
            // BrowseDescription
      referenceTypeId: makeRefId("FromState"),
      includeSubtypes: true,
      browseDirection: BrowseDirection.Forward,
      nodeId,
      resultMask
    },
        // ToState
    {
            // BrowseDescription
      referenceTypeId: makeRefId("ToState"),
      includeSubtypes: true,
      browseDirection: BrowseDirection.Forward,
      nodeId,
      resultMask
    },
        // (for folders ) Organizes
    {
            // BrowseDescription
      referenceTypeId: makeRefId("Organizes"),
      includeSubtypes: true,
      browseDirection: BrowseDirection.Forward,
      nodeId,
      resultMask
    }
  ];


    /**
     * construct a callable method
     *
     * @param obj
     * @param reference
     * @param callback
     */
  function add_method(obj, reference, callback) {
    const name = lowerFirstLetter(reference.browseName.name);

    obj[name] = function functionCaller(inputArgs, callback) {
      assert(_.isFunction(callback));
            // convert input arguments into Variants
      const inputArgsDef = obj[name].inputArguments;


      const inputArguments = inputArgsDef.map((arg) => {
        const dataType = convertNodeIdToDataType(arg.dataType);

        const arrayType = (arg.valueRank === 1) ? VariantArrayType.Array : VariantArrayType.Scalar;

                // xx console.log("xxx ",arg.toString());
        const propName = lowerFirstLetter(arg.name);

        const value = inputArgs[propName];
        if (value === undefined) {
          throw new Error(`expecting input argument ${propName}`);
        }
        if (arrayType === VariantArrayType.Array) {
          if (!_.isArray(value)) {
            throw new Error("expecting value to be an Array or a TypedArray");
          }
        }

        return new Variant({ arrayType, dataType, value });
      });

      const methodToCall = new CallMethodRequest({
        objectId: obj.nodeId,
        methodId: reference.nodeId,
        inputArguments
      });

            // xx console.log(" calling ",methodToCall.toString());

      const methodsToCall = [methodToCall];

      session.call(methodsToCall, (err, result /* , diagInfo */) => {
                // istanbul ignore next
        if (err) {
          return callback(err);
        }

        if (result[0].statusCode !== StatusCodes.Good) {
          return callback(new Error(`Error ${result[0].statusCode.toString()}`));
        }
        assert(result[0].outputArguments.length === obj[name].outputArguments.length);
        const outputArgs = {};

        const outputArgsDef = obj[name].outputArguments;

        _.zip(outputArgsDef, result[0].outputArguments).forEach((pair) => {
          const arg = pair[0];
          const variant = pair[1];

          const propName = lowerFirstLetter(arg.name);
          outputArgs[propName] = variant.value;
        });
        callback(err, outputArgs);
      });
    };


    function extractDataType(arg, callback) {
      if (arg.dataType._dataType) {
        return callback(); // already converted
      }

      convertNodeIdToDataTypeAsync(session, arg.dataType, (err, dataType) => {
        if (!err) {
          assert(dataType.hasOwnProperty("value"));
          arg.dataType._dataType = dataType;
        }
        callback(err);
      });
    }


    session.getArgumentDefinition(reference.nodeId, (err, inputArguments, outputArguments) => {
            // istanbul ignore next
      if (err) {
        return callback(err);
      }

      obj[name].inputArguments = inputArguments;
      obj[name].outputArguments = outputArguments;

      async.series([
        (callback) => {
          async.each(obj[name].inputArguments, extractDataType, callback);
        },
        (callback) => {
          async.each(obj[name].outputArguments, extractDataType, callback);
        }
      ], callback);
    });

    const methodObj = {
      nodeId: reference.nodeId,
      executableFlag: false,
      browseName: name,
      func: obj[name]
    };
    obj.$methods[name] = methodObj;

    proxyManager._monitor_execution_flag(methodObj, () => {

    });
  }

  function add_component(obj, reference, callback) {
    const name = lowerFirstLetter(reference.browseName.name || "");

    proxyManager.getObject(reference.nodeId, (err, childObj) => {
            // istanbul ignore else
      if (!err) {
        var childObj = new ObjectExplorer({
          proxyManager,
          nodeId: reference.nodeId,
          name,
          parent: obj
        });
        obj[name] = childObj;
        obj.$components.push(childObj);

        childObj.$resolve(callback);
      } else {
        callback(err);
      }
    });
  }

  function addFolderElement(obj, reference, callback) {
    const name = lowerFirstLetter(reference.browseName.name || "");

    const childObj = new ObjectExplorer({
      proxyManager,
      nodeId: reference.nodeId,
      name,
      parent: obj
    });
    obj[name] = childObj;
    obj.$organizes.push(childObj);
    childObj.$resolve(callback);
  }

  function add_property(obj, reference, callback) {
    const name = lowerFirstLetter(reference.browseName.name || "");

    obj[name] = new ProxyVariable(proxyManager, reference.nodeId, reference);
    obj.$properties[name] = obj[name];

    callback(null);
  }

  function add_typeDefinition(obj, references, callback) {
    references = references || [];
    if (references.length !== 1) {
      console.log(" cannot find type definition", references.length);
      return callback();
    }
    const reference = references[0];
    assert(!obj.typeDefinition, "type definition can only be set once");
    obj.typeDefinition = reference.browseName.name || "";
    callback();
  }

  function addFromState(obj, reference, callback) {
    proxyManager.getObject(reference.nodeId, (err, childObj) => {
      obj.$fromState = childObj;
      callback(err);
    });
  }

  function addToState(obj, reference, callback) {
    proxyManager.getObject(reference.nodeId, (err, childObj) => {
      obj.$toState = childObj;
      callback(err);
    });
  }


  session.browse(nodesToBrowse, (err, results) => {
    function t(references) {
      return references.map(r => `${r.browseName.name} ${r.nodeId.toString()}`);
    }

        // istanbul ignore next
    if (err) {
      return callback(err);
    }

        // xx console.log("Components", t(results[0].references));
        // xx console.log("Properties", t(results[1].references));
        // xx console.log("Methods", t(results[2].references));
    async.series([

      (callback) => {
        async.map(results[0].references, add_component.bind(null, obj), callback);
      },

      (callback) => {
        async.map(results[1].references, add_property.bind(null, obj), callback);
      },

      (callback) => {
        async.map(results[2].references, add_method.bind(null, obj), callback);
      },

      (callback) => {
        add_typeDefinition.bind(null, obj)(results[3].references, callback);
      },

      (callback) => { // FromState
                // fromState
        const reference = results[4].references ? results[4].references[0] : null;
                // fromState
        if (reference) {
          return addFromState(obj, reference, callback);
        }
        callback();
      },
      (callback) => { // ToState
        const reference = results[5].references ? results[5].references[0] : null;
                // fromState
        if (reference) {
          return addToState(obj, reference, callback);
        }
        callback();
      },
      (callback) => { // Organizes
        async.map(results[6].references, addFolderElement.bind(null, obj), callback);
      }

    ], callback);
  });
}

/**
 *
 * @param proxyManager
 * @param nodeId
 * @param options
 * @param callback {Function}
 * @param callback.err
 * @param callback.clientObject
 *
 */
function getObject(proxyManager, nodeId, options, callback) {
  const session = proxyManager.session;

  nodeId = coerceNodeId(nodeId);

  if (nodeId.isEmpty()) {
    return callback(new Error(" Invalid empty node in getObject"));
  }

  const nodesToRead = [
    {
      nodeId,
      attributeId: AttributeIds.BrowseName
    },
    {
      nodeId,
      attributeId: AttributeIds.Description
    },
    {
      nodeId,
      attributeId: AttributeIds.NodeClass
    }
  ];

  function read_accessLevels(clientObject, callback) {
    const nodesToRead = [
      {
        nodeId,
        attributeId: AttributeIds.Value
      },
      {
        nodeId,
        attributeId: AttributeIds.UserAccessLevel
      },
      {
        nodeId,
        attributeId: AttributeIds.AccessLevel
      }
    ];
    session.read(nodesToRead, 1, (err, node2reads, results) => {
      if (results[0].statusCode === StatusCodes.Good) {
        clientObject.dataValue = AccessLevelFlag.get(results[0].value);
      }
      if (results[1].statusCode === StatusCodes.Good) {
                // xx console.log("AccessLevel ", results[3].value.toString())
        clientObject.userAccessLevel = AccessLevelFlag.get(results[1].value.value);
      }
      if (results[2].statusCode === StatusCodes.Good) {
        clientObject.accessLevel = AccessLevelFlag.get(results[2].value.value);
      }
      callback(err);
    });
  }

  let clientObject;

  async.series([

    (callback) => {
            // readAttributes like browseName and references
      session.read(nodesToRead, 1, (err, node2reads, results) => {
        if (!err) {
          if (results[0].statusCode === StatusCodes.BadNodeIdUnknown) {
            console.log(" INVALID NODE ", nodeId.toString());
            return callback(new Error(`Invalid Node ${nodeId.toString()}`));
          }

          clientObject = new ProxyObject(proxyManager, nodeId);

                    // /x console.log("xxxx ,s",results.map(function(a){ return a.toString();}));

          clientObject.browseName = results[0].value.value;
          clientObject.description = (results[1].value ? results[1].value.value : "");
          clientObject.nodeClass = NodeClass.get(results[2].value.value);
                    // xx console.log("xxx nodeClass = ",clientObject.nodeClass.toString());

          if (clientObject.nodeClass === NodeClass.Variable) {
            return read_accessLevels(clientObject, callback);
          }
        }
        callback(err);
      });
    },
    (callback) => {
            // install monitored item
      if (clientObject.nodeClass === NodeClass.Variable) {
                // xx console.log("xxxx -> ???", clientObject.nodeId.toString(), clientObject.nodeClass.toString());
        return proxyManager._monitor_value(clientObject, callback);
      }
      callback();
    },


    (callback) => {
      readUAStructure(proxyManager, clientObject, callback);
    }
  ], (err) => {
        // istanbul ignore next
    if (err) {
      return callback(err);
    }

    callback(null, clientObject);
  });
}


/**
 *
 * @param session
 * @constructor
 */
class UAProxyManager {
  constructor(session) {
    const self = this;
    self.session = session;
    assert(session instanceof ClientSession);
    self._map = {};
      // create a subscription
  }

  start(callback) {
    const self = this;

    const createSubscriptionRequest = {
      requestedPublishingInterval: 100,
      requestedLifetimeCount: 10,
      requestedMaxKeepAliveCount: 2,
      maxNotificationsPerPublish: 10,
      publishingEnabled: true,
      priority: 10
    };

    self.session.createSubscription2(createSubscriptionRequest, (err, subscription) => {
      self.subscription = subscription;
      self.subscription.on("terminated", () => {
        self.subscription = null;
      });
      callback(err);
    });
  }

  stop(callback) {
    const self = this;
    if (self.subscription) {
      self.subscription.terminate();
      self.subscription.once("terminated", () => {
              // todo
              // console.log("xxxx UAProxyManager subscription terminated");
        self.subscription = null;
        callback();
      });
    } else {
      callback(new Error("UAProxyManager already stopped ?"));
    }
  }

  getObject(nodeId, callback, options) {
    const self = this;

    setImmediate(() => {
      options = options || {};
      options.depth = options.depth || 1;

      const key = nodeId.toString();

      if (self._map.hasOwnProperty(key)) {
        return callback(null, self._map[key]);
      }

      getObject(self, nodeId, options, (err, obj) => {
        if (!err) {
          self._map[key] = obj;
        }
        callback(err, obj);
      });
    });
  }

  _monitor_value(proxyObject, callback) {
    assert(_.isFunction(callback));
      // xx if (proxyObject.nodeId.toString() !== "ns=0;i=2257") { return;}

    const self = this;

    if (!self.subscription) {
          // some server do not provide subscription support, do not treat this as an error.
      return callback(null); // new Error("No subscription"));
    }

    const itemToMonitor = { // ReadValueId
      nodeId: proxyObject.nodeId,
      attributeId: AttributeIds.Value
    };
    const monitoringParameters = { // MonitoringParameters
      samplingInterval: 0, /* event-based */
      discardOldest: true,
      queueSize: 10
    };
    const requestedParameters = TimestampsToReturn.Both;

    const monitoredItem = self.subscription.monitor(itemToMonitor, monitoringParameters, requestedParameters, callback);

      // console.log("xxxxxx installing monitored Item",monitoredItem.itemToMonitor.nodeId.toString(),monitoredItem.itemToMonitor.attributeId);
      // xx proxyObject.monitoredItem = monitoredItem;
    Object.defineProperty(proxyObject, "__monitoredItem", { value: monitoredItem, enumerable: false });

    proxyObject.__monitoredItem.on("changed", (dataValue) => {
      proxyObject.dataValue = dataValue;
      proxyObject.emit("value_changed", dataValue);
          // console.log("xxx Value Changed ".red,proxyObject.nodeId.toString() , proxyObject.browseName,proxyObject.dataValue.toString());
    });
  }

  _monitor_execution_flag(proxyObject, callback) {
      // note : proxyObject must wrap a method
    assert(_.isFunction(callback));
    assert(proxyObject.nodeId instanceof NodeId);

    const self = this;

    if (!self.subscription) {
          // some server do not provide subscription support, do not treat this as an error.
      return callback(null); // new Error("No subscription"));
    }

    const itemToMonitor = { // ReadValueId
      nodeId: proxyObject.nodeId,
      attributeId: AttributeIds.Executable
    };

    const monitoringParameters = { // MonitoringParameters
      samplingInterval: 0, /* event-based */
      discardOldest: true,
      queueSize: 10
    };
    const requestedParameters = TimestampsToReturn.None;

    const monitoredItem = self.subscription.monitor(itemToMonitor, monitoringParameters, requestedParameters, callback);

    Object.defineProperty(proxyObject, "__monitoredItem_execution_flag", { value: monitoredItem, enumerable: false });

    proxyObject.__monitoredItem_execution_flag.on("changed", (dataValue) => {
      proxyObject.executableFlag = dataValue.value.value;
          // xx console.log(" execution flag = ", proxyObject.executableFlag , proxyObject.browseName , proxyObject.nodeId.toString());
          // xx proxyObject.emit("execution_flag_changed",proxyObject.executableFlag);
    });
  }
}


/**
 *
 * @param createSubscriptionRequest
 * @param callback
 * @param callback.err
 * @param callback.subscription
 *
 *
 * subscription.on("error',    function(err){ ... });
 * subscription.on("terminate',function(err){ ... });
 * var monitoredItem = subscription.monitor(itemToMonitor,monitoringParameters,requestedParameters,callback);
 * monitoredItem.on("changed",function( dataValue) {...});
 *
 */
ClientSession.prototype.createSubscription2 = function (createSubscriptionRequest, callback) {
  assert(_.isFunction(callback));
  const self = this;
  const ClientSubscription = require("lib/client/client_subscription").ClientSubscription;

  const subscription = new ClientSubscription(self, createSubscriptionRequest);
  subscription.on("error", (err) => {

  });
  subscription.on("started", () => {
    callback(null, subscription);
  });
};

export { UAProxyManager };
export { makeRefId };
