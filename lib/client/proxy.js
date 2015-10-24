"use strict";
/**
 * @module opcua.client
 */
require("requirish")._(module);

var async  =require("async");
var assert = require("better-assert");
var _ = require("underscore");
var util = require("util");
var EventEmitter = require("events").EventEmitter;


var browse_service   = require("lib/services/browse_service");
var read_service     = require("lib/services/read_service");
var call_service     = require("lib/services/call_service");

var AttributeIds     = read_service.AttributeIds;
var ReferenceTypeIds = require("lib/opcua_node_ids").ReferenceTypeIds;
var ObjectTypeIds    = require("lib/opcua_node_ids").ObjectTypeIds;
var makeNodeId       = require("lib/datamodel/nodeid").makeNodeId;
var StatusCodes      = require("lib/datamodel/opcua_status_code").StatusCodes;
var lowerFirstLetter = require("lib/misc/utils").lowerFirstLetter;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var DataType         = require("lib/datamodel/variant").DataType;
var resultMask = browse_service.makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition");
var BrowseDirection = browse_service.BrowseDirection;
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var Variant = require("lib/datamodel/variant").Variant;
var AccessLevelFlag = require("lib/datamodel/access_level").AccessLevelFlag;


var coerceNodeId = require("lib/datamodel/nodeid").coerceNodeId;

function makeRefId(referenceTypeName) {
    return makeNodeId(ReferenceTypeIds[referenceTypeName] || ObjectTypeIds[referenceTypeName]);
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

    var nodesToRead = [{
        nodeId: dataTypeId,
        attributeId: AttributeIds.BrowseName
    }];

    session.read(nodesToRead, function (err, unused, dataValues) {

        if (err) {
            return callback(err);
        }

        var dataTypeName = dataValues[0].value.value;

        if (dataTypeId.namespace === 0 && DataType.get(dataTypeId.value)) {
            var dataType =  DataType.get(dataTypeId.value);
            return callback(null, dataType);
        }

        /// example => Duration (i=290) => Double (i=11)
        // read subTypeOf
        var nodesToBrowse = [{
            // BrowseDescription
            referenceTypeId: makeRefId("HasSubtype"),
            //xx nodeClassMask: browse_service.makeNodeClassMask("ObjectType"),
            includeSubtypes: false,
            browseDirection: BrowseDirection.Inverse,
            nodeId: dataTypeId,
            resultMask: resultMask
        }];
        session.browse(nodesToBrowse, function (err, results) {
            if (err) { return callback(err); }
            var references = results[0].references;

            if (!references || references.length !== 1) {
                return callback(new Error("cannot find SuperType of " + dataTypeName.toString() ));
            }
            var nodeId = references[0].nodeId;
            return convertNodeIdToDataTypeAsync(session,nodeId,callback);
        });
    });
}

function convertNodeIdToDataType(dataTypeId) {
    return dataTypeId._dataType;
}
function UAProxyObject(proxyManager,nodeId,reference) {

    var self = this;
    self.nodeId = nodeId;
    self.proxyManager = proxyManager;
    assert(self.proxyManager.session,"expecting valid session");
    Object.defineProperty(self, "proxyManager", {
        enumerable: false,
        writable: true
    });

}

util.inherits(UAProxyObject, EventEmitter);


UAProxyObject.prototype.get= function(callback) {

    var self =this;
    assert(self.proxyManager);

    var session =self.proxyManager.session;
    assert(session);

    var nodeToRead = {
        nodeId: self.nodeId,
        attributeId: AttributeIds.Value
    };
    self.proxyManager.session.read([nodeToRead], function(err,unused,results) {
        var results = results[0];
        if (err) {
            return callback(err);
        }
        var data = results.value;
        callback(null,data);

    });
};

UAProxyObject.prototype.set = function(dataValue,callback) {
    var self =this;
    assert(self.proxyManager);

    var session =self.proxyManager.session;
    assert(session);

    var nodeToWrite = {
        nodeId: self.nodeId,
        attributeId: AttributeIds.Value,
        value: dataValue
    };
    self.proxyManager.session.write([nodeToWrite], function(err,results) {
        if (err) {
            return callback(err);
        }
        var result= results[0];
        /// console.log("xxxx r=",results.toString());
        if (result !== StatusCodes.Good) {
            callback(new Error(result.toString()));
        } else {
            callback(null);
        }

    });

};

UAProxyObject.prototype.toString = function() {

    var str = [];
    var self = this;
    str.push(" ProxyObject ");
    str.push("   browseName " + self.browseName.toString());
    str.push("   typeDefinition " + self.typeDefinition.toString());
    str.push("   $components# " + (self.$components  ? self.$components.length.toString() :0));

    return str.join("\n");
};

function UAProperty(session,nodeId) {
    UAProxyObject.apply(this, arguments);
}
util.inherits(UAProperty,UAProxyObject);

var UAComponent = UAProperty;

function readComponents(proxyManager, obj, callback) {

    var session = proxyManager.session;

    //   0   Object
    //   1   Variable
    //   2   Method
    var nodeId = obj.nodeId;
    var nodesToBrowse = [

        // Components
        {
            // BrowseDescription
            referenceTypeId: makeRefId("HasComponents"),
            nodeClassMask: browse_service.makeNodeClassMask("Object | Variable"),
            includeSubtypes: true,
            browseDirection: BrowseDirection.Forward,
            nodeId: nodeId,
            resultMask: resultMask
        },
        // Properties
        {
            // BrowseDescription
            referenceTypeId: makeRefId("HasProperty"),
            //nodeClassMask: browse_service.makeNodeClassMask("Variable"),
            includeSubtypes: true,
            browseDirection: BrowseDirection.Forward,
            nodeId: nodeId,
            resultMask: resultMask
        },

        // Methods
        {
            // BrowseDescription
            referenceTypeId: makeRefId("HasComponent"),
            nodeClassMask: browse_service.makeNodeClassMask("Method"),
            includeSubtypes: true,
            browseDirection: BrowseDirection.Forward,
            nodeId: nodeId,
            resultMask: resultMask
        },
        // TypeDefinition
        {
            // BrowseDescription
            referenceTypeId: makeRefId("HasTypeDefinition"),
            //xx nodeClassMask: browse_service.makeNodeClassMask("ObjectType"),
            //xx includeSubtypes: true,
            browseDirection: BrowseDirection.Both,
            nodeId: nodeId,
            resultMask: resultMask

        },
        // FromState
        {
            // BrowseDescription
            referenceTypeId: makeRefId("FromState"),
            //xx nodeClassMask: browse_service.makeNodeClassMask("ObjectType"),
            //xx includeSubtypes: true,
            browseDirection: BrowseDirection.Forward,
            nodeId: nodeId,
            resultMask: resultMask
        },
        // ToState
        {
            // BrowseDescription
            referenceTypeId: makeRefId("ToState"),
            //xx nodeClassMask: browse_service.makeNodeClassMask("ObjectType"),
            //xx includeSubtypes: true,
            browseDirection: BrowseDirection.Forward,
            nodeId: nodeId,
            resultMask: resultMask
        }
    ];



    /**
     * construct a callable methods
     *
     * @param obj
     * @param reference
     * @param callback
     */
    function add_method(obj, reference, callback) {

        var name = lowerFirstLetter(reference.browseName.name);

        obj[name] = function functionCaller(inputArgs, callback) {

            // convert input arguments into Variants
            var inputArgsDef = obj[name].inputArguments;


            var inputArguments = inputArgsDef.map(function (arg) {

                var dataType = convertNodeIdToDataType(arg.dataType);

                var arrayType = ( arg.valueRank === 1) ? VariantArrayType.Array : VariantArrayType.Scalar;

                //xx console.log("xxx ",arg.toString());
                var propName = lowerFirstLetter(arg.name);

                var value = inputArgs[propName];
                if (value === undefined) {
                    throw new Error("expecting input argument " + propName);
                }
                if (arrayType === VariantArrayType.Array) {
                    if (!_.isArray(value)) {
                        throw new Error("expecting value to be an Array or a TypedArray");
                    }
                }

                return new Variant({ arrayType: arrayType, dataType: dataType, value: value });
            });

            var methodToCall = new call_service.CallMethodRequest({
                objectId: obj.nodeId,
                methodId: reference.nodeId,
                inputArguments: inputArguments
            });

            var methodsToCall = [methodToCall];

            //xx console.log(" methodToCall = ".yellow, methodToCall.toString());

            session.call(methodsToCall, function (err, result, diagInfo) {


                if (err) {
                    return callback(err);
                }
                //xx console.log("Here I am");
                //xx console.log("result = ", result[0].toString());
                if (result[0].statusCode !== StatusCodes.Good) {
                    return callback(new Error("Error " + result[0].statusCode.toString()));
                }
                assert(result[0].outputArguments.length === obj[name].outputArguments.length);
                var outputArgs = {};

                var outputArgsDef = obj[name].outputArguments;

                _.zip(outputArgsDef,result[0].outputArguments).forEach(function(pair) {
                    var arg = pair[0];
                    var variant= pair[1];

                    var propName = lowerFirstLetter(arg.name);
                    outputArgs[propName] = variant.value;

                });
                callback(err, outputArgs);

            });
        };

        function extractDataType(arg, callback) {

            if (arg.dataType._dataType) {
                return callback(); // already converted
            }

            convertNodeIdToDataTypeAsync(session, arg.dataType, function (err, dataType) {
                if (!err) {
                    assert(dataType.hasOwnProperty("value"));
                    arg.dataType._dataType = dataType;
                }
                callback(err);
            });
        }


        session.getArgumentDefinition(reference.nodeId, function (err, inputArguments, outputArguments) {

            if (!err) {

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

            } else {
                callback(err);
            }
        });

    }

    function add_component(obj,reference,callback) {

        var name = lowerFirstLetter(reference.browseName.name||"");

        proxyManager.getObject(reference.nodeId,function(err,childObj) {

            if (err) { return callback(err); }
            obj[name] = childObj;

            obj.$components = obj.$components || [];
            obj.$components.push(childObj);

            callback(null)
        });

    }

    function add_property(obj, reference, callback) {

        var name = lowerFirstLetter(reference.browseName.name||"");
        obj[name] = new UAProperty(proxyManager,reference.nodeId,reference);

        callback(null);
    }

    function add_typeDefinition(obj,references,callback) {
        if(references.length !== 1) {
            console.log(" cannot find type definition",references.length);
            return callback();
        }
        var reference = references[0];
        assert(!obj.typeDefinition,"type definition can only be set once");
        var name = reference.browseName.name||"";
        obj.typeDefinition = name;
        callback();
    }

    function addFromState(obj,reference,callback) {
        proxyManager.getObject(reference.nodeId,function(err,childObj) {
            obj.$fromState = childObj;
            callback(err);
        });
    }

    function addToState(obj,reference,callback) {
        proxyManager.getObject(reference.nodeId,function(err,childObj) {
            obj.$toState = childObj;
            callback(err);
        });
    }

    session.browse(nodesToBrowse, function (err, results) {
        function t(references) {
            return references.map(function (r) {
                return r.browseName.name + " " + r.nodeId.toString();
            });
        }

        if (!err) {

            //xx console.log("Components", t(results[0].references));
            //xx console.log("Properties", t(results[1].references));
            //xx console.log("Methods", t(results[2].references));
            async.series([

                function(callback) { async.map(results[0].references, add_component.bind(null,obj),callback); },

                function(callback) { async.map(results[1].references, add_property.bind(null,obj),callback); },

                // now enrich our object with nice callable async methods
                function(callback) { async.map(results[2].references, add_method.bind(null, obj), callback); },

                // now set typeDefinition
                function(callback) {  add_typeDefinition.bind(null,obj)(results[3].references,callback); },

                //
                function(callback) {
                    // fromState
                    var reference = results[4].references ? results[4].references[0]: null;
                    // fromState
                    if (reference) {
                        return addFromState(obj,reference,callback);
                    }
                    callback();
                },
                function(callback) {
                    var reference = results[5].references ? results[5].references[0]: null;
                    // fromState
                    if (reference) {
                        return addToState(obj,reference,callback);
                    }
                    callback();
                }

            ],callback);


        } else {
            console.log("ERR = ", err.message);
            callback(err);
        }
    });
}

/**
 *
 * @param session
 * @param nodeId
 * @param callback {Function}
 * @param callback.err
 * @param callback.clientObject
 *
 */
function getObject(proxyManager, nodeId, reference, callback) {

    var session = proxyManager.session;

    nodeId = coerceNodeId(nodeId);

    if (nodeId.isEmpty()) {
        return callback(new Error(" Invalid empty node in getObject"));
    }

    var nodesToRead = [
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

    function read_accessLevels(clientObject,callback) {
        var nodesToRead = [
            {
                nodeId: nodeId,
                attributeId: AttributeIds.Vaue
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
        session.read(nodesToRead, 1, function (err, node2reads, results) {
            if (results[0].statusCode === StatusCodes.Good) {
                clientObject.dataValue = AccessLevelFlag.get(results[0].value);
            }
            if (results[1].statusCode === StatusCodes.Good) {
                //xx console.log("AccessLevel ", results[3].value.toString())
                clientObject.userAccessLevel = AccessLevelFlag.get(results[1].value.value);
            }
            if (results[2].statusCode === StatusCodes.Good) {
                clientObject.accessLevel = AccessLevelFlag.get(results[2].value.value);
            }
            callback(err);
        });
    }

    var clientObject;

    async.series([

        function (callback) {
            // readAttributes like browseName and references
            session.read(nodesToRead, 1, function (err, node2reads, results) {

                if (!err) {

                    if (results[0].statusCode === StatusCodes.BadNodeIdUnknown) {
                        console.log(" INVALID NODE ",nodeId.toString());
                        return callback(new Error("Invalid Node " + nodeId.toString()));
                    }

                    clientObject =new UAComponent(proxyManager,nodeId,reference);

                    ///x console.log("xxxx ,s",results.map(function(a){ return a.toString();}));

                    clientObject.browseName  = results[0].value.value;
                    clientObject.description = results[1].value.value;
                    clientObject.nodeClass   = NodeClass.get(results[2].value.value);
                    //xx console.log("xxx nodeClass = ",clientObject.nodeClass.toString());

                    if (clientObject.nodeClass === NodeClass.Variable) {

                        return read_accessLevels(clientObject,callback);

                    }
                }
                callback(err);
            });
        },
        function (callback) {

            // install monitored item
            if (clientObject.nodeClass === NodeClass.Variable) {
                //xx console.log("xxxx -> ???", clientObject.nodeId.toString(), clientObject.nodeClass.toString());
                return proxyManager._monitor_value(clientObject,callback);
            }
            callback();
        },
        function (callback) {
            readComponents(proxyManager, clientObject, callback);
        }

        //
    ], function (err) {
        if (err) {
            return callback(err);
        }
        callback(null, clientObject);
    });
}


var ClientSession = require("lib/client/client_session").ClientSession;


/**
 *
 * @param session
 * @constructor
 */
function UAProxyManager(session) {

    var self = this;
    self.session = session;
    assert(session instanceof ClientSession)
    self._map= {};
    // create a subscription

}

var ClientSubscription = require("lib/client/client_subscription").ClientSubscription;

UAProxyManager.prototype.start = function(callback)
{
    var self = this;
    self.subscription=new ClientSubscription(self.session,{
        requestedPublishingInterval: 100,
        requestedLifetimeCount:      10,
        requestedMaxKeepAliveCount:  2,
        maxNotificationsPerPublish:  10,
        publishingEnabled: true,
        priority: 10
    });
    self.subscription.on("started",function() {
        //xx console.log("xxxx UAProxyManager subscription started");
        callback();
    });
    self.subscription.on("error",function(err) {
        //xx callback(err);
    });
    self.subscription.on("terminated",function() {
        // todo
        //xx console.log("xxxx UAProxyManager subscription terminated");
    });
};

UAProxyManager.prototype.stop = function(callback) {
    var self = this;
    self.subscription.terminate();
    self.subscription.once("terminated",function() {
        // todo
        // console.log("xxxx UAProxyManager subscription terminated");
        callback();
    });
};

UAProxyManager.prototype.getObject = function(nodeId,callback) {

    var self = this;

    var key = nodeId.toString();

    if (self._map.hasOwnProperty(key)) {
        return callback(null,self._map[key]);
    }

    getObject(self,nodeId,{},function(err,obj) {

        if(!err) {
            self._map[key] = obj;
        }
        callback(err,obj);
    });
};
UAProxyManager.prototype._monitor_value = function(proxyObject,callback) {


    //xx if (proxyObject.nodeId.toString() !== "ns=0;i=2257") { return;}

    var self = this;
    var itemToMonitor = { // ReadValueId
        nodeId:      proxyObject.nodeId,
        attributeId: AttributeIds.Value
    };
    var monitoringParameters= { // MonitoringParameters
        samplingInterval: 0, /* event-based */
        discardOldest: true,
        queueSize: 10
    };
    var requestedParameters = read_service.TimestampsToReturn.Both;

    var monitoredItem = self.subscription.monitor(itemToMonitor,monitoringParameters,requestedParameters,callback);

    // console.log("xxxxxx installing monitored Item",monitoredItem.itemToMonitor.nodeId.toString(),monitoredItem.itemToMonitor.attributeId);
    //xx proxyObject.monitoredItem = monitoredItem;
    Object.defineProperty(proxyObject, "__monitoredItem", {value: monitoredItem, enumerable: false});

    proxyObject.__monitoredItem.on("changed",function(dataValue) {
        proxyObject.dataValue = dataValue;
        proxyObject.emit("value_changed",dataValue);
        // console.log("xxx Value Changed ".red,proxyObject.nodeId.toString() , proxyObject.browseName,proxyObject.dataValue.toString());
    });

};


exports.UAProxyManager = UAProxyManager;
