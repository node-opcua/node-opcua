"use strict";
require("requirish")._(module);

var opcua = require("index.js");
var AttributeIds = opcua.AttributeIds;
//xx var AttributeNameById = opcua.AttributeNameById;
var BrowseDirection = opcua.browse_service.BrowseDirection;
var BrowseDescription = opcua.browse_service.BrowseDescription;
var async = require("async");
var _ = require("underscore");
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var resolveNodeId = opcua.resolveNodeId;
var NodeId = opcua.NodeId;
var StatusCodes = opcua.StatusCodes;
var assert = require("better-assert");

var utils = require("lib/misc/utils");
var debugLog = utils.make_debugLog(__filename);
//xx var doDebug = utils.checkDebugFlag(__filename);
//
// some server do not expose the ReferenceType Node in their address space
// ReferenceType are defined by the OPCUA standard and can be prepopulated in the crawler.
// Pre-populating the ReferenceType node in the crawler will also reduce the network traffic.
//
var ReferenceTypeIds = require("lib/opcua_node_ids").ReferenceTypeIds;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;


/*=
 *
 * @param arr
 * @param maxNode
 * @private
 * @return {*}
 */
function _fetch_elements(arr, maxNode) {
    assert(_.isArray(arr));
    assert(arr.length > 0);
    var high_limit = ( maxNode <= 0) ? arr.length : maxNode;
    var tmp = arr.splice(0, high_limit);
    assert(tmp.length > 0);
    return tmp;
}

/**
 * @class NodeCrawler
 * @param session
 * @constructor
 */
function NodeCrawler(session) {

    var self = this;

    self.session = session;

    self.browseNameMap = {};
    self._nodesToReadEx = [];
    self._objectCache = {};
    self._objectToBrowse = [];
    self._objMap = {};

    this._initialize_referenceTypeId();

    self.q = async.queue(function (task, callback) {

        // use process next tick to relax the stack frame
        setImmediate(function () {
            task.func.call(self, task, function () {
                self.resolve_deferred_browseNode();
                self.resolve_deferred_readNode();
                callback();
            });
        });

    }, 1);

    // MaxNodesPerRead from Server.ServerCapabilities.OperationLimits
    // VariableIds.ServerType_ServerCapabilities_OperationLimits_MaxNodesPerRead
    self.maxNodesPerRead = 0;

    //  MaxNodesPerBrowse from Server.ServerCapabilities.OperationLimits
    // VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse;
    self.maxNodesPerBrowse = 0; // 0 = no limits
}

util.inherits(NodeCrawler, EventEmitter);

NodeCrawler.prototype._initialize_referenceTypeId = function () {

    var self = this;

    function append_prepopulated_reference(browseName) {

        var nodeId = makeNodeId(ReferenceTypeIds[browseName], 0);
        assert(nodeId);
        var ref_index = nodeId.toString();
        var obj = {
            nodeId: nodeId,
            browseName: {name: browseName},
            references: []
        };
        self._objectCache[ref_index] = obj;
    }

    //  References
    //  +->(hasSubtype) NoHierarchicalReferences
    //                  +->(hasSubtype) HasTypeDefinition
    //  +->(hasSubtype) HierarchicalReferences
    //                  +->(hasSubtype) HasChild/ChildOf
    //                                  +->(hasSubtype) Aggregates/AggregatedBy
    //                                                  +-> HasProperty/PropertyOf
    //                                                  +-> HasComponent/ComponentOf
    //                                                  +-> HasHistoricalConfiguration/HistoricalConfigurationOf
    //                                 +->(hasSubtype) HasSubtype/HasSupertype
    //                  +->(hasSubtype) Organizes/OrganizedBy
    //                  +->(hasSubtype) HasEventSource/EventSourceOf
    append_prepopulated_reference("HasTypeDefinition");
    append_prepopulated_reference("HasChild");
    append_prepopulated_reference("HasProperty");
    append_prepopulated_reference("HasComponent");
    append_prepopulated_reference("HasHistoricalConfiguration");
    append_prepopulated_reference("HasSubtype");
    append_prepopulated_reference("Organizes");
    append_prepopulated_reference("HasEventSource");

};

NodeCrawler.prototype._readOperationalLimits = function (callback) {

    var self = this;
    var n1 = makeNodeId(opcua.VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRead);
    var n2 = makeNodeId(opcua.VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse);
    var nodesToRead = [
        {nodeId: n1, attributeId: AttributeIds.Value},
        {nodeId: n2, attributeId: AttributeIds.Value}
    ];
    self.session.read(nodesToRead, function (err, nodeIds, results) {
        if (!err) {
            if (results[0].statusCode === StatusCodes.Good) {
                self.maxNodesPerRead = results[0].value.value;
            }
            // ensure we have a sensible maxNodesPerRead value in case the server doesn't specify one
            self.maxNodesPerRead = self.maxNodesPerRead || 200;

            if (results[1].statusCode === StatusCodes.Good) {
                self.maxNodesPerBrowse = results[1].value.value;
            }
            // ensure we have a sensible maxNodesPerBrowse value in case the server doesn't specify one
            self.maxNodesPerBrowse = self.maxNodesPerBrowse || 100;
        }
        callback(err);
    });
};

NodeCrawler.prototype.set_cache_NodeAttribute = function (nodeId, attributeId, value) {
    var self = this;
    var index = nodeId.toString() + "_" + attributeId.toString();
    self.browseNameMap[index] = value;
};

NodeCrawler.prototype.has_cache_NodeAttribute = function (nodeId, attributeId) {
    var self = this;
    var index = nodeId.toString() + "_" + attributeId.toString();
    return self.browseNameMap.hasOwnProperty(index);
};

NodeCrawler.prototype.get_cache_NodeAttribute = function (nodeId, attributeId) {
    var self = this;
    var index = nodeId.toString() + "_" + attributeId.toString();
    return self.browseNameMap[index];
};

/**
 * request a read operation for a Node+Attribute in the future, provides a callback
 *
 * @method _defer_readNode
 * @param nodeId {NodeId}
 * @param attributeId {AttributeId}
 * @param {function} callback
 * @param {Error|null} callback.err
 * @param {string} callback.dataValue
 * @private
 */
NodeCrawler.prototype._defer_readNode = function (nodeId, attributeId, callback) {
    var self = this;

    nodeId = resolveNodeId(nodeId);
    assert(nodeId instanceof NodeId);

    var index = nodeId.toString() + "_" + attributeId.toString();

    if (self.has_cache_NodeAttribute(nodeId, attributeId)) {
        callback(null, self.get_cache_NodeAttribute(nodeId, attributeId));
    } else {

        self.browseNameMap[index] = "?";
        self._nodesToReadEx.push({
            nodeToRead: {
                nodeId: nodeId,
                attributeId: AttributeIds.BrowseName
            },
            callback: function (dataValue) {
                self.set_cache_NodeAttribute(nodeId, attributeId, dataValue);
                callback(null, dataValue);
            }
        });
    }
};

/**
 * perform pending read Node operation
 * @method _resolve_deferred_readNode
 * @param callback {Function}
 * @private
 */
NodeCrawler.prototype._resolve_deferred_readNode = function (callback) {

    var self = this;
    if (self._nodesToReadEx.length === 0) {
        // nothing to read
        callback();
        return;
    }

    var _nodesToReadEx = _fetch_elements(self._nodesToReadEx, self.maxNodesPerRead);

    var nodesToRead = _nodesToReadEx.map(function (e) {
        return e.nodeToRead;
    });

    self.session.read(nodesToRead, function (err, nodesToRead, results /*, diagnostics*/) {

        if (!err) {

            _.zip(_nodesToReadEx, results).forEach(function (pair) {
                var _nodeToReadEx = pair[0];

                var dataValue = pair[1];
                assert(dataValue.hasOwnProperty("statusCode"));
                if (dataValue.statusCode === StatusCodes.Good) {
                    _nodeToReadEx.callback(dataValue.value.value);
                } else {
                    _nodeToReadEx.callback({name: dataValue.statusCode.key});
                }

            });
        }
        callback(err);
    });
};

NodeCrawler.prototype._resolve_deferred = function (comment, collection, method) {
    var self = this;

    if (collection.length > 0) {
        self._push_task("adding operation " + comment, {
            params: {},
            func: function (task, callback) {
                method.call(self, callback);
            }
        });
    }
};

NodeCrawler.prototype.resolve_deferred_readNode = function () {
    this._resolve_deferred("read_node", this._nodesToReadEx, this._resolve_deferred_readNode);
};

NodeCrawler.prototype.resolve_deferred_browseNode = function () {
    this._resolve_deferred("browse_node", this._objectToBrowse, this._resolve_deferred_browseNode);
};


/**
 * perform a deferred browse
 * instead of calling session.browse directly, this function add the request to a list
 * so that request can be grouped and send in one single browse command to the server.
 *
 * @method _defer_browse_node
 * @private
 * @param nodeId
 * @param callback
 */
NodeCrawler.prototype._defer_browse_node = function (nodeId, callback) {

    var self = this;

    var index = resolveNodeId(nodeId).toString();

    if (self._objectCache.hasOwnProperty(index)) {

        var object = self._objectCache[index];
        assert(object.browseName.name !== "pending");
        return callback(null, object);

    } else {

        var element = {
            nodeId: nodeId,
            browseName: {name: "pending"},
            //references by types
            references: null
        };

        assert(!self._objectCache.hasOwnProperty(index));
        self._objectCache[index] = element;

        self._objectToBrowse.push({
            nodeId: nodeId,
            browseDirection: BrowseDirection.Forward,
            //attributeId: AttributeIds.BrowseName
            callback: function (object) {
                object.references = object.references || [];
                assert(object === element);
                assert(object.browseName.name !== "pending");
                callback(null, object);
            },
            element: element
        });
    }
};


NodeCrawler.prototype._process_browse_response = function (task, callback) {
    /* jshint validthis: true */
    var self = this;

    var _objectsToBrowse = task.param._objectsToBrowse;
    var results = task.param.results;

    _.zip(_objectsToBrowse, results).forEach(function (pair) {
        var _objectToBrowse = pair[0];

        var index = _objectToBrowse.nodeId.toString();
        var obj = self._objectCache[index];
        assert(obj === _objectToBrowse.element);

        obj.references = pair[1].references;

        self._defer_readNode(obj.nodeId, AttributeIds.BrowseName, function (err, browseName) {

            debugLog(" NodeCrawler".cyan, " setting name = ".yellow, browseName, " on ", obj.nodeId.toString(), err ? err.message : null);
            obj.browseName = browseName;

            _objectToBrowse.callback(obj);
        });
    });
    callback();
};

//                         "ReferenceType | IsForward | BrowseName | NodeClass | DisplayName | TypeDefinition"
var resultMask = opcua.browse_service.makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition");

NodeCrawler.prototype._resolve_deferred_browseNode = function (callback) {

    var self = this;

    if (self._objectToBrowse.length === 0) {
        callback();
        return;
    }

    var _objectsToBrowse = _fetch_elements(self._objectToBrowse, self.maxNodesPerBrowse);

    var nodesToBrowse = _objectsToBrowse.map(function (e) {
        return new BrowseDescription({
            browseDirection: BrowseDirection.Forward,
            nodeId: e.nodeId,
            resultMask: resultMask
        });
    });

    self.session.browse(nodesToBrowse, function (err, results /*, diagnostics*/) {

        if (!err) {
            assert(results.length === nodesToBrowse.length);
            self._shift_task("process browse result", {
                param: {
                    _objectsToBrowse: _objectsToBrowse,
                    results: results
                },
                func: NodeCrawler.prototype._process_browse_response
            });

        } else {
            console.log("ERROR = ", err);
        }
        callback(err);

    });
};

NodeCrawler.prototype._shift_task = function (name, task) {
    var self = this;
    assert(_.isFunction(task.func));
    task.comment = "S:" + name;
    assert(task.func.length === 2);
    self.q.unshift(task);
};

NodeCrawler.prototype._push_task = function (name, task) {
    var self = this;
    assert(_.isFunction(task.func));
    task.comment = "P:" + name;
    assert(task.func.length === 2);
    self.q.push(task);
};

NodeCrawler.prototype._emit_on_crawled = function (element) {
    var self = this;
    self.emit("browsed", element);
};

NodeCrawler.prototype._crawl = function (task, callback) {
    /* jshint validthis: true */
    var self = this;
    var _visited_node = self._visited_node;

    var nodeId = task.params.nodeId;

    nodeId = resolveNodeId(nodeId);

    var index = nodeId.toString();

    if (_visited_node.hasOwnProperty(index)) {
        console.log("skipping already visited", index);
        callback();
        return;// already visited
    }
    // mark as visited to avoid infinite recursion
    _visited_node[index] = true;

    self._defer_browse_node(nodeId, function (err, object) {

        if (!err) {

            var i = 0;
            for (i = 0; i < object.references.length; i++) {

                var reference = object.references[i];

                // this one comes for free
                if (!self.has_cache_NodeAttribute(reference.nodeId, AttributeIds.BrowseName)) {
                    self.set_cache_NodeAttribute(reference.nodeId, AttributeIds.BrowseName, reference.browseName);
                }
                self._add_crawl_task(reference.referenceTypeId);
                self._add_crawl_task(reference.nodeId);
            }
            self._emit_on_crawled(object);
        }
    });
    callback();
};


NodeCrawler.prototype._add_crawl_task = function (nodeId) {
    /* jshint validthis: true */
    var self = this;
    assert(_.isObject(self));
    var _crawled = self._crawled;
    assert(_.isObject(_crawled));

    var index = nodeId.toString();
    if (_crawled.hasOwnProperty(index)) {
        return;
    }
    _crawled[index] = 1;
    self._push_task("_crawl task", {
        params: {nodeId: nodeId},
        func: NodeCrawler.prototype._crawl
    });

};

NodeCrawler.prototype._inner_crawl = function (nodeId, user_data, end_callback) {

    var self = this;
    assert(_.isFunction(end_callback));

    self._visited_node = {};
    self._crawled = {};

    var _has_ended = false;
    self.q.drain = function () {
        if (!_has_ended) {
            _has_ended = true;
            self.emit("end");
            end_callback();
        }
    };
    self._add_crawl_task(nodeId);
};

/**
 * @method crawl
 * @param nodeId {NodeId}
 * @param user_data {Object}
 * @param end_callback {Function}
 */
NodeCrawler.prototype.crawl = function (nodeId, user_data, end_callback) {
    assert(_.isFunction(end_callback));
    var self = this;
    self._readOperationalLimits(function (err) {

        if (err) {
            return end_callback(err);
        }
        self._inner_crawl(nodeId, user_data, end_callback);
    });
};

function lowerize(str) {
    if (str === undefined) {
        return str;
    }
    return str.substring(0, 1).toLowerCase() + str.substring(1);
}

function remove_cycle(object, callback) {


    var visitedNodeIds = {};

    function hasBeenVisited(e) {
        var key = e.nodeId.toString();
        return visitedNodeIds[key];
    }

    function setVisited(e) {
        var key = e.nodeId.toString();
        return visitedNodeIds[key] = e;
    }

    function mark_array(arr) {
        if (!arr) { return; }
        assert(_.isArray(arr));
        for (var index = 0; index < arr.length; index++) {
            var e = arr[index];
            if (hasBeenVisited(e)) {
                return;
            } else {
                setVisited(e);
                explorerObject(e);
            }
        }
    }

    function explorerObject(obj) {
        mark_array(obj.organizes);
        mark_array(obj.hasComponent);
        mark_array(obj.hasNotifier);
        mark_array(obj.hasProperty);
    }


    explorerObject(object);
    callback(null,object);
}

NodeCrawler.prototype.read = function (nodeId, callback) {

    var self = this;

    try {
        nodeId = resolveNodeId(nodeId);
    } catch (err) {
        callback(err);
    }

    function simplify_object(objMap, object, final_callback) {

        assert(_.isFunction(final_callback));

        var queue = async.queue(function (task, callback) {

            setImmediate(function () {
                assert(_.isFunction(task.func));
                task.func(task.data, callback);
            });
        }, 1);

        var index = object.nodeId.toString();

        function add_for_reconstruction(object, extra_func) {
            assert(_.isFunction(extra_func));
            assert(typeof object.nodeId.toString() === "string");
            queue.push({
                data: object,
                func: function (data, callback) {

                    _reconstruct_manageable_object(data, function (err, obj) {
                        extra_func(err, obj);
                        callback(err);
                    });
                }
            });
        }

        function _reconstruct_manageable_object(object, callback) {

            assert(_.isFunction(callback));
            assert(object);
            assert(object.nodeId);

            var index = object.nodeId.toString();

            if (objMap.hasOwnProperty(index)) {
                return callback(null, objMap[index]);
            }
            /* reconstruct a more manageable object
             * var obj = {
             *    browseName: "Objects",
             *    organises : [
             *       {
             *            browseName: "Server",
             *            hasComponent: [
             *            ]
             *            hasProperty: [
             *            ]
             *       }
             *    ]
             * }
             */
            var obj = {
                browseName: object.browseName.name,
                nodeId: object.nodeId.toString()
            };

            // Append nodeClass
            if (object.nodeClass) {
                obj.nodeClass = object.nodeClass.toString();
            }

            objMap[index] = obj;

            var referenceMap = obj;

            object.references = object.references || [];


            object.references.map(function (ref) {

                var ref_index = ref.referenceTypeId.toString();

                var referenceType = self._objectCache[ref_index];

                if (!referenceType) {
                    console.log(("Unknown reference type " + ref_index).red.bold);
                    console.log(util.inspect(object, {colorize: true, depth: 10}));
                }
                var reference = self._objectCache[ref.nodeId.toString()];

                // Extract nodeClass so it can be appended
                reference.nodeClass = ref.$nodeClass;

                var refName = lowerize(referenceType.browseName.name);

                if (refName === "hasTypeDefinition") {
                    obj.typeDefinition = reference.browseName.name;
                } else {
                    if (!referenceMap[refName]) {
                        referenceMap[refName] = [];
                    }
                    add_for_reconstruction(reference, function (err, mobject) {
                        if (!err) {
                            referenceMap[refName].push(mobject);
                        }
                    });
                }
            });
            callback(null, obj);

        }

        add_for_reconstruction(object, function () {
        });

        queue.drain = function () {
            var object = self._objMap[index];
            remove_cycle(object, callback);
        };
    }

    var index = nodeId.toString();

    // check if object has already been crawled
    if (self._objMap.hasOwnProperty(index)) {
        var object = self._objMap[index];
        return callback(null, object);
    }

    self.crawl(nodeId, {}, function () {

        if (self._objectCache.hasOwnProperty(index)) {

            var object = self._objectCache[index];
            assert(object.browseName.name !== "pending");

            simplify_object(self._objMap, object, callback);

        } else {
            callback(new Error("Cannot find nodeid" + index));
        }
    });
};

exports.NodeCrawler = NodeCrawler;

