"use strict";
/**
 * @module opcua.client
 */


const async = require("async");
const assert = require("node-opcua-assert").assert;
const _ = require("underscore");
const util = require("util");
const EventEmitter = require("events").EventEmitter;


const read_service = require("node-opcua-service-read");
const call_service = require("node-opcua-service-call");

const AttributeIds = require("node-opcua-data-model").AttributeIds;
const AccessLevelFlag = require("node-opcua-data-model").AccessLevelFlag;
const makeResultMask = require("node-opcua-data-model").makeResultMask;
const BrowseDirection = require("node-opcua-data-model").BrowseDirection;
const NodeClass = require("node-opcua-data-model").NodeClass;
const makeNodeClassMask = require("node-opcua-data-model").makeNodeClassMask;

const ReferenceTypeIds = require("node-opcua-constants").ReferenceTypeIds;
const ObjectTypeIds = require("node-opcua-constants").ObjectTypeIds;

const NodeId = require("node-opcua-nodeid").NodeId;
const makeNodeId = require("node-opcua-nodeid").makeNodeId;
const coerceNodeId = require("node-opcua-nodeid").coerceNodeId;

const StatusCodes = require("node-opcua-status-code").StatusCodes;

const lowerFirstLetter = require("node-opcua-utils").lowerFirstLetter;

const Variant = require("node-opcua-variant").Variant;
const VariantArrayType = require("node-opcua-variant").VariantArrayType;
const DataType = require("node-opcua-variant").DataType;


const ClientSession = require("node-opcua-client").ClientSession;
const ClientSubscription = require("node-opcua-client").ClientSubscription;

const resultMask = makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition");

function makeRefId(referenceTypeName) {
    const nodeId = makeNodeId(ReferenceTypeIds[referenceTypeName] || ObjectTypeIds[referenceTypeName]);

    // istanbul ignore next
    if (nodeId.isEmpty()) {
        throw new Error("makeRefId: cannot find ReferenceTypeName + ", referenceTypeName);
    }
    return nodeId;
}

exports.makeRefId = makeRefId;

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

    const nodeToRead = {
        nodeId: dataTypeId,
        attributeId: AttributeIds.BrowseName
    };

    session.read(nodeToRead, function (err, dataValue) {

        // istanbul ignore next
        if (err) {
            return setImmediate(function(){callback(err);});
        }

        let dataType;
        // istanbul ignore next
        if (dataValue.statusCode !== StatusCodes.Good) {
            //Xx console.log("convertNodeIdToDataTypeAsync: Cannot read browse name for nodeID ".red + dataTypeId.toString());
            dataType = DataType.Null;
            return setImmediate(function(){callback(null, dataType);});
        }

        const dataTypeName = dataValue.value.value;

        if (dataTypeId.namespace === 0 && DataType.get(dataTypeId.value)) {
            dataType = DataType.get(dataTypeId.value);
            return setImmediate(function(){callback(null, dataType);});
        }

        /// example => Duration (i=290) => Double (i=11)
        // read subTypeOf
        const nodeToBrowse = {
            // BrowseDescription
            referenceTypeId: makeRefId("HasSubtype"),
            //xx nodeClassMask: makeNodeClassMask("ObjectType"),
            includeSubtypes: false,
            browseDirection: BrowseDirection.Inverse,
            nodeId: dataTypeId,
            resultMask: resultMask
        };
        session.browse(nodeToBrowse, function (err, browseResult) {
            // istanbul ignore next
            if (err) {
                return callback(err);
            }

            const references = browseResult.references;

            if (!references || references.length !== 1) {
                return callback(new Error("cannot find SuperType of " + dataTypeName.toString()));
            }
            const nodeId = references[0].nodeId;
            return convertNodeIdToDataTypeAsync(session, nodeId, callback);
        });
    });
}

function convertNodeIdToDataType(dataTypeId) {
    return dataTypeId._dataType;
}

function ProxyBaseNode(proxyManager, nodeId) {

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

util.inherits(ProxyBaseNode, EventEmitter);


/**
 * get a updated Value of the Variable , by using a ReadRequest
 * @method readValue
 * @param callback {Function}
 * @param callback.err {Error|null}
 * @param callback.dataValue {DataValue}
 */
ProxyBaseNode.prototype.readValue = function (callback) {

    const self = this;
    assert(self.proxyManager);

    const session = self.proxyManager.session;
    assert(session);

    const nodeToRead = {
        nodeId: self.nodeId,
        attributeId: AttributeIds.Value
    };
    self.proxyManager.session.read(nodeToRead, function (err, dataValue) {

        // istanbul ignore next
        if (err) {
            return callback(err);
        }
        const data = dataValue.value;
        callback(null, data);

    });
};


/**
 * set the Value of the Variable, by using a WriteRequest
 * @method writeValue
 * @param dataValue {DataValue}
 * @param callback {Function}
 * @param callback.err {Error|null}
 */
ProxyBaseNode.prototype.writeValue = function (dataValue, callback) {
    const self = this;
    assert(self.proxyManager);

    const session = self.proxyManager.session;
    assert(session);

    const nodeToWrite = {
        nodeId: self.nodeId,
        attributeId: AttributeIds.Value,
        value: dataValue
    };
    self.proxyManager.session.write(nodeToWrite, function (err, statusCode) {
        // istanbul ignore next
        if (err) {
            return callback(err);
        }
        if (statusCode !== StatusCodes.Good) {
            callback(new Error(statusCode.toString()));
        } else {
            callback(null);
        }
    });
};

ProxyBaseNode.prototype.toString = function () {

    const str = [];
    const self = this;
    str.push(" ProxyObject ");
    str.push("   browseName     : " + self.browseName.toString());
    str.push("   typeDefinition : " + self.typeDefinition.toString());
    str.push("   $components#   : " + self.$components.length.toString());
    str.push("   $properties#   : " + self.$properties.length.toString());

    return str.join("\n");
};

function ProxyVariable(session, nodeId) {
    ProxyBaseNode.apply(this, arguments);
}

util.inherits(ProxyVariable, ProxyBaseNode);

const ProxyObject = ProxyVariable;

function ObjectExplorer(options) {
    const self = this;
    self.proxyManager = options.proxyManager;
    self.name = options.name;
    self.nodeId = options.nodeId;
    self.parent = options.parent;
}

ObjectExplorer.prototype.$resolve = function (callback) {

    const self = this;

    self.proxyManager.getObject(self.nodeId, function (err, childObj) {

        // istanbul ignore next
        if (err) {
            return callback(err);
        }

        self.parent[self.name] = childObj;
        self.parent.$components.push(childObj);

        callback(null)
    });
};

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
            nodeId: nodeId,
            resultMask: resultMask
        },
        // Properties
        {
            // BrowseDescription
            referenceTypeId: makeRefId("HasProperty"),
            //nodeClassMask: makeNodeClassMask("Variable"),
            includeSubtypes: true,
            browseDirection: BrowseDirection.Forward,
            nodeId: nodeId,
            resultMask: resultMask
        },

        // Methods
        {
            // BrowseDescription
            referenceTypeId: makeRefId("HasComponent"),
            nodeClassMask: makeNodeClassMask("Method"),
            includeSubtypes: true,
            browseDirection: BrowseDirection.Forward,
            nodeId: nodeId,
            resultMask: resultMask
        },
        // TypeDefinition
        {
            // BrowseDescription
            referenceTypeId: makeRefId("HasTypeDefinition"),
            includeSubtypes: true,
            browseDirection: BrowseDirection.Both,
            nodeId: nodeId,
            resultMask: resultMask

        },
        // FromState
        {
            // BrowseDescription
            referenceTypeId: makeRefId("FromState"),
            includeSubtypes: true,
            browseDirection: BrowseDirection.Forward,
            nodeId: nodeId,
            resultMask: resultMask
        },
        // ToState
        {
            // BrowseDescription
            referenceTypeId: makeRefId("ToState"),
            includeSubtypes: true,
            browseDirection: BrowseDirection.Forward,
            nodeId: nodeId,
            resultMask: resultMask
        },
        // (for folders ) Organizes
        {
            // BrowseDescription
            referenceTypeId: makeRefId("Organizes"),
            includeSubtypes: true,
            browseDirection: BrowseDirection.Forward,
            nodeId: nodeId,
            resultMask: resultMask
        }
    ];


    /**
     * @method add_method
     * construct a callable method
     *
     * @param obj
     * @param reference
     * @param callback
     * @private
     */
    function add_method(obj, reference, callback) {

        const name = lowerFirstLetter(reference.browseName.name);

        obj[name] = function functionCaller(inputArgs, callback) {

            assert(_.isFunction(callback));
            // convert input arguments into Variants
            const inputArgsDef = obj[name].inputArguments || [];

            const inputArguments = inputArgsDef.map(function (arg) {

                const dataType = convertNodeIdToDataType(arg.dataType);

                const arrayType = (arg.valueRank === 1) ? VariantArrayType.Array : VariantArrayType.Scalar;

                //xx console.log("xxx ",arg.toString());
                const propName = lowerFirstLetter(arg.name);

                const value = inputArgs[propName];
                if (value === undefined) {
                    throw new Error("expecting input argument " + propName);
                }
                if (arrayType === VariantArrayType.Array) {
                    if (!_.isArray(value)) {
                        throw new Error("expecting value to be an Array or a TypedArray");
                    }
                }

                return new Variant({arrayType: arrayType, dataType: dataType, value: value});
            });

            const methodToCall = new call_service.CallMethodRequest({
                objectId: obj.nodeId,
                methodId: reference.nodeId,
                inputArguments: inputArguments
            });

            //xx console.log(" calling ",methodToCall.toString());

            session.call(methodToCall, function (err, callResult) {

                // istanbul ignore next
                if (err) {
                    return callback(err);
                }
                if (callResult.statusCode !== StatusCodes.Good) {
                    return callback(new Error("Error " + callResult.statusCode.toString()));
                }
                callResult.outputArguments = callResult.outputArguments || [];

                obj[name].outputArguments =  obj[name].outputArguments || [];

                assert(callResult.outputArguments.length === obj[name].outputArguments.length);
                const outputArgs = {};

                const outputArgsDef = obj[name].outputArguments;

                _.zip(outputArgsDef, callResult.outputArguments).forEach(function (pair) {
                    const arg = pair[0];
                    const variant = pair[1];

                    const propName = lowerFirstLetter(arg.name);
                    outputArgs[propName] = variant.value;

                });
                callback(err, outputArgs);

            });
        };


        function extractDataType(arg, callback) {

            if (arg.dataType && arg.dataType._dataType) {
                return setImmediate(callback); // already converted
            }

            convertNodeIdToDataTypeAsync(session, arg.dataType, function (err, dataType) {
                if (!err) {
                    assert(dataType.hasOwnProperty("value"));
                    arg.dataType._dataType = dataType;
                }
                callback(err);
            });
        }

        const methodObj = {
            nodeId: reference.nodeId,
            executableFlag: false,
            browseName: name,
            func: obj[name]
        };
        obj.$methods[name] = methodObj;

        async.parallel([
            function(callback) {
                session.getArgumentDefinition(reference.nodeId, function (err, args) {
                    // istanbul ignore next
                    if (err) {
                        return setImmediate(function() { callback(err); });
                    }
                    const inputArguments  = args.inputArguments;
                    const outputArguments = args.outputArguments;

                    obj[name].inputArguments = inputArguments;
                    obj[name].outputArguments = outputArguments;

                    async.series([
                        function (callback) {
                            async.each(obj[name].inputArguments, extractDataType, callback);
                        },
                        function (callback) {
                            async.each(obj[name].outputArguments, extractDataType, callback);
                        }
                    ], callback)
                });
            },
            function(callback) {
                proxyManager._monitor_execution_flag(methodObj, function () {
                    callback();
                });
            }
        ],callback);

    }

    function add_component(obj, reference, callback) {

        const name = lowerFirstLetter(reference.browseName.name || "");

        proxyManager.getObject(reference.nodeId, function (err, childObj) {

            // istanbul ignore else
            if (!err) {
                childObj = new ObjectExplorer({
                    proxyManager: proxyManager,
                    nodeId: reference.nodeId,
                    name: name,
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
            proxyManager: proxyManager,
            nodeId: reference.nodeId,
            name: name,
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

        setImmediate(callback);
    }

    function add_typeDefinition(obj, references, callback) {
        references = references || [];
        if (references.length !== 1) {
            //xx console.log(" cannot find type definition", references.length);
            return setImmediate(callback);
        }
        const reference = references[0];
        assert(!obj.typeDefinition, "type definition can only be set once");
        obj.typeDefinition = reference.browseName.name || "";
        setImmediate(callback);
    }

    function addFromState(obj, reference, callback) {
        proxyManager.getObject(reference.nodeId, function (err, childObj) {
            obj.$fromState = childObj;
            callback(err);
        });
    }

    function addToState(obj, reference, callback) {
        proxyManager.getObject(reference.nodeId, function (err, childObj) {
            obj.$toState = childObj;
            callback(err);
        });
    }


    session.browse(nodesToBrowse, function (err, browseResults) {
        function t(references) {
            return references.map(function (r) {
                return r.browseName.name + " " + r.nodeId.toString();
            });
        }

        // istanbul ignore next
        if (err) {
            return callback(err);
        }

        //xx console.log("Components", t(results[0].references));
        //xx console.log("Properties", t(results[1].references));
        //xx console.log("Methods", t(results[2].references));
        async.parallel([

            function (callback) {
                async.map(browseResults[0].references, add_component.bind(null, obj), callback);
            },

            function (callback) {
                async.map(browseResults[1].references, add_property.bind(null, obj), callback);
            },

            // now enrich our object with nice callable async methods
            function (callback) {
                async.map(browseResults[2].references, add_method.bind(null, obj), callback);
            },

            // now set typeDefinition
            function (callback) {
                add_typeDefinition.bind(null, obj)(browseResults[3].references, callback);
            },

            //
            function (callback) { // FromState
                // fromState
                const reference = browseResults[4].references ? browseResults[4].references[0] : null;
                // fromState
                if (reference) {
                    return addFromState(obj, reference, callback);
                }
                callback();
            },
            function (callback) { // ToState
                const reference = browseResults[5].references ? browseResults[5].references[0] : null;
                // fromState
                if (reference) {
                    return addToState(obj, reference, callback);
                }
                callback();
            },
            function (callback) { // Organizes
                async.map(browseResults[6].references, addFolderElement.bind(null, obj), callback);
            }

        ], callback);

    });
}

/**
 * @method getObject
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
        return setImmediate(function() {
            callback(new Error(" Invalid empty node in getObject"));
        });
    }

    const nodesToRead = [
        {
            nodeId: nodeId,
            attributeId: AttributeIds.BrowseName
        },
        {
            nodeId: nodeId,
            attributeId: AttributeIds.Description
        },
        {
            nodeId: nodeId,
            attributeId: AttributeIds.NodeClass
        }
    ];

    function read_accessLevels(clientObject, callback) {
        const nodesToRead = [
            {
                nodeId: nodeId,
                attributeId: AttributeIds.Value
            },
            {
                nodeId: nodeId,
                attributeId: AttributeIds.UserAccessLevel
            },
            {
                nodeId: nodeId,
                attributeId: AttributeIds.AccessLevel
            }
        ];
        session.read(nodesToRead, 1, function (err, dataValues) {
            if (dataValues[0].statusCode === StatusCodes.Good) {
                clientObject.dataValue = AccessLevelFlag.get(dataValues[0].value);
            }
            if (dataValues[1].statusCode === StatusCodes.Good) {
                //xx console.log("AccessLevel ", results[3].value.toString())
                clientObject.userAccessLevel = AccessLevelFlag.get(dataValues[1].value.value);
            }
            if (dataValues[2].statusCode === StatusCodes.Good) {
                clientObject.accessLevel = AccessLevelFlag.get(dataValues[2].value.value);
            }
            callback(err);
        });
    }

    let clientObject;

    async.series([

        function (callback) {
            // readAttributes like browseName and references
            session.read(nodesToRead, 1, function (err, dataValues) {

                if (!err) {

                    if (dataValues[0].statusCode === StatusCodes.BadNodeIdUnknown) {
                        //xx console.log(" INVALID NODE ", nodeId.toString());
                        return callback(new Error("Invalid Node " + nodeId.toString()));
                    }

                    clientObject = new ProxyObject(proxyManager, nodeId);

                    ///x console.log("xxxx ,s",results.map(function(a){ return a.toString();}));

                    clientObject.browseName = dataValues[0].value.value;
                    clientObject.description = (dataValues[1].value ? dataValues[1].value.value : "");
                    clientObject.nodeClass = NodeClass.get(dataValues[2].value.value);
                    //xx console.log("xxx nodeClass = ",clientObject.nodeClass.toString());

                    if (clientObject.nodeClass === NodeClass.Variable) {
                        return read_accessLevels(clientObject, callback);
                    }
                }
                callback(err);
            });
        },
        function (callback) {

            // install monitored item
            if (clientObject.nodeClass === NodeClass.Variable) {
                //xx console.log("xxxx -> ???", clientObject.nodeId.toString(), clientObject.nodeClass.toString());
                return proxyManager._monitor_value(clientObject, callback);
            }
            callback();
        },


        function (callback) {

            readUAStructure(proxyManager, clientObject, callback);
        }

        //
    ], function (err) {

        // istanbul ignore next
        if (err) {
            return callback(err);
        }

        callback(null, clientObject);
    });
}


/**
 * @class UAProxyManager
 * @param session
 * @constructor
 */
function UAProxyManager(session) {

    const self = this;
    self.session = session;
    assert(session instanceof ClientSession);
    self._map = {};
    // create a subscription

}


/**
 * @class ClientSession
 * @method createSubscription2
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

    const subscription = new ClientSubscription(self, createSubscriptionRequest);
    subscription.on("error", function (err) {

    });
    subscription.on("started", function () {
        callback(null, subscription);
    });
};

/**
 * @class UAProxyManager
 * @method start
 * @param callback
 * @async
 */
UAProxyManager.prototype.start = function (callback) {
    const self = this;

    const createSubscriptionRequest = {
        requestedPublishingInterval: 100,
        requestedLifetimeCount: 6000,
        requestedMaxKeepAliveCount: 100,
        maxNotificationsPerPublish: 1000,
        publishingEnabled: true,
        priority: 10
    };

    self.session.createSubscription2(createSubscriptionRequest, function (err, subscription) {
        self.subscription = subscription;
        self.subscription.on("terminated", function () {
            self.subscription = null;
        });
        callback(err);
    });
};

/**
 * @method stop
 * @param callback
 * @async
 */
UAProxyManager.prototype.stop = function (callback) {
    const self = this;
    if (self.subscription) {
        self.subscription.terminate(function() {
            self.subscription = null;
            callback();
        });

    } else {
        callback(new Error("UAProxyManager already stopped ?"))
    }
};

/**
 * @method getObject
 * @param nodeId
 * @param callback
 * @async
 */
UAProxyManager.prototype.getObject = function (nodeId, callback) {

    let options = {};
    const self = this;

    setImmediate(function () {
        options = options || {};
        options.depth = options.depth || 1;

        const key = nodeId.toString();

        if (self._map.hasOwnProperty(key)) {
            return callback(null, self._map[key]);
        }

        getObject(self, nodeId, options, function (err, obj) {

            if (!err) {
                self._map[key] = obj;
            }
            callback(err, obj);
        });
    });
};


UAProxyManager.prototype._monitor_value = function (proxyObject, callback) {

    assert(_.isFunction(callback));
    //xx if (proxyObject.nodeId.toString() !== "ns=0;i=2257") { return;}

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
    const requestedParameters = read_service.TimestampsToReturn.Both;

    const monitoredItem = self.subscription.monitor(itemToMonitor, monitoringParameters, requestedParameters, callback);

    // console.log("xxxxxx installing monitored Item",monitoredItem.itemToMonitor.nodeId.toString(),monitoredItem.itemToMonitor.attributeId);
    //xx proxyObject.monitoredItem = monitoredItem;
    Object.defineProperty(proxyObject, "__monitoredItem", {value: monitoredItem, enumerable: false});

    proxyObject.__monitoredItem.on("changed", function (dataValue) {
        proxyObject.dataValue = dataValue;
        proxyObject.emit("value_changed", dataValue);
        //xx console.log("xxx Value Changed ".red,proxyObject.nodeId.toString() , proxyObject.browseName,proxyObject.dataValue.toString());
    });

};

UAProxyManager.prototype._monitor_execution_flag = function (proxyObject, callback) {

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
    const requestedParameters = read_service.TimestampsToReturn.None;

    const monitoredItem = self.subscription.monitor(itemToMonitor, monitoringParameters, requestedParameters, callback);

    Object.defineProperty(proxyObject, "__monitoredItem_execution_flag", {value: monitoredItem, enumerable: false});

    proxyObject.__monitoredItem_execution_flag.on("changed", function (dataValue) {
        proxyObject.executableFlag = dataValue.value.value;
        //xx console.log(" execution flag = ", proxyObject.executableFlag , proxyObject.browseName , proxyObject.nodeId.toString());
        //xx proxyObject.emit("execution_flag_changed",proxyObject.executableFlag);
    });
};

exports.UAProxyManager = UAProxyManager;

const thenify = require("thenify");
UAProxyManager.prototype.start = thenify.withCallback(UAProxyManager.prototype.start);
UAProxyManager.prototype.stop = thenify.withCallback(UAProxyManager.prototype.stop);

UAProxyManager.prototype.getObject = thenify.withCallback(UAProxyManager.prototype.getObject);
ProxyBaseNode.prototype.readValue  = thenify.withCallback(ProxyBaseNode.prototype.readValue);
ProxyBaseNode.prototype.writeValue = thenify.withCallback(ProxyBaseNode.prototype.writeValue);
