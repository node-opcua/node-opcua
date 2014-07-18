var opcua = require("../../");
var AttributeIds = opcua.AttributeIds;
//xx var AttributeNameById = opcua.AttributeNameById;
var BrowseDirection = opcua.browse_service.BrowseDirection;
var async = require("async");
var _ = require("underscore");
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var resolveNodeId = opcua.resolveNodeId;
var NodeId = opcua.NodeId;
var StatusCodes = opcua.StatusCodes;
var assert = require("better-assert");

var utils = require("../misc/utils");
var debugLog = utils.make_debugLog(__filename);
var doDebug = utils.checkDebugFlag(__filename);

var HasTypeDefinition = resolveNodeId("HasTypeDefinition");

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

    self.q = async.queue(function (task, callback) {
       task.func(callback);
    }, 10);

}
util.inherits(NodeCrawler, EventEmitter);


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
 * method _defer_readNode
 * @param nodeId
 * @param attributeId
 * @param {function} callback
 * @param {Error|null} callback.err
 * @param {string} callback.browseName
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
 *
 * @param callback
 * @private
 */
NodeCrawler.prototype._resolve__deferred_readNode = function (callback) {


    var self = this;
    if (self._nodesToReadEx.length === 0) {
        callback();
        return;
    }
    debugLog(" NodeCrawler".cyan , "_resolve__deferred_readNode with " ,self._nodesToReadEx.length , " nodes to read");

    var _nodesToReadEx = self._nodesToReadEx;
    self._nodesToReadEx = [];

    var nodesToRead = _nodesToReadEx.map(function (e) {
        return  e.nodeToRead;
    });

    self.session.read(nodesToRead, function (err, nodesToRead, results, diagnostics) {

        if (!err) {

            _.zip(_nodesToReadEx, results).forEach(function (pair) {
                var _nodeToReadEx = pair[0];

                var dataValue = pair[1];
                assert(dataValue.hasOwnProperty('statusCode'));
                if (dataValue.statusCode === StatusCodes.Good) {
                    _nodeToReadEx.callback(dataValue.value.value);
                } else {
                    _nodeToReadEx.callback({name: dataValue.statusCode.key});
                }

            });
        }
        self.kick();
        callback(err);

    });
};

NodeCrawler.prototype.resolve__deferred_readNode = function () {

    var self = this;

    if (self._nodesToReadEx.length > 0) {
        self.q.push({
            params: {},
            func: function (callback) {
                self._resolve__deferred_readNode(callback);
            }
        }, function (err) {
        });
    }
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
        callback(null, object);

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
            browseDirection : BrowseDirection.Forward,
            //attributeId: AttributeIds.BrowseName
            callback: function (object) {
                assert(object === element);
                assert(object.references !== null);
                assert(object.browseName.name !== "pending");
                callback(null, object);
            },
            element: element
        });
    }
};


NodeCrawler.prototype._resolve_deferred_browse_node = function (callback) {

    var self = this;

    if (self._objectToBrowse.length === 0) {
        callback();
        return;
    }
    debugLog(" NodeCrawler".cyan , " _resolve_deferred_browse_node with " ,self._objectToBrowse.length , " nodes to browse");

    var _objectsToBrowse = self._objectToBrowse;
    self._objectToBrowse = [];

    var nodesToBrowse = _objectsToBrowse.map(function (e) {
        return { nodeId: e.nodeId};
    });

    self.session.browse(nodesToBrowse, function (err, results, diagnostics) {

        if (!err) {
            _.zip(_objectsToBrowse, results).forEach(function (pair) {
                var _objectToBrowse = pair[0];

                var index = _objectToBrowse.nodeId.toString();
                var obj = self._objectCache[index];
                assert(obj === _objectToBrowse.element);

                obj.references = pair[1].references;

                self._defer_readNode(obj.nodeId, AttributeIds.BrowseName, function (err, browseName) {

                    debugLog(" NodeCrawler".cyan , " setting name = ".yellow, browseName , " on ",obj.nodeId.toString());
                    obj.browseName = browseName;

                    _objectToBrowse.callback(obj);
                });

            });

            self.kick();

        }
        callback(err);

    });
};

NodeCrawler.prototype.resolve_deferred_browse_node = function () {

    var self = this;
    if (self._objectToBrowse.length > 0) {
        self.q.push({
            params: {},
            func: function (callback) {
                self._resolve_deferred_browse_node(callback);
            }
        }, function (err) {
        });
    }
};


NodeCrawler.prototype.kick = function () {
    var self = this;
    self.resolve_deferred_browse_node();
    self.resolve__deferred_readNode();
    if (self.q.length() === 0 ) {
        // make sure at least one task get executed
        self.q.push({func: function (callback) { callback(); }});
    }
};

/**
 * @crawl
 * @param nodeId
 * @param user_data
 */
NodeCrawler.prototype.crawl = function (nodeId, user_data, end_callback) {

    assert(_.isFunction(end_callback));

    var self = this;

    var _visited_node = {};

    var _has_ended = false;
    self.q.drain = function () {
        if (!_has_ended) {
            _has_ended = true;
            self.emit("end");
            end_callback();
        } else {

        }
    };

    function emit_on_crawled(element) {
        self.emit("browsed", element, user_data);
    }

    function _crawl(nodeId) {

        nodeId = resolveNodeId(nodeId);

        var index = nodeId.toString();

        if (_visited_node.hasOwnProperty(index)) {
            //xx console.log("skipping already visited",index);
            return;// already visited
        }
        // mark as visited to avoid infinite recursion
        _visited_node[index] = true;

        self._defer_browse_node(nodeId, function (err, object) {
            if (!err) {
                object.references.forEach(function (reference) {

                    // this one comes for free
                    if (!self.has_cache_NodeAttribute(reference.nodeId, AttributeIds.BrowseName)) {
                        self.set_cache_NodeAttribute(reference.nodeId, AttributeIds.BrowseName, reference.browseName);
                    }

                     _crawl(reference.referenceTypeId);
                     _crawl(reference.nodeId);
                });

                emit_on_crawled(object);
            }
        });
    }

    _crawl(nodeId);
    self.kick();
};

NodeCrawler.prototype.read = function (nodeId, callback) {


    var self = this;

    try {
        nodeId = resolveNodeId(nodeId);
    } catch (err) {
        callback(err);
    }

//    function _resolve_reference_to_object(obj, callback) {
//
//        if (!obj.references) {
//            callback(null,obj);
//            return;
//        }
//        async.mapSeries(
//            obj.references,
//            // iterator
//            function (item, inner_callback) {
//                self.read(item.nodeId, function (err, transformed_obj) {
//                    inner_callback(err, transformed_obj);
//                });
//            },
//            function (err, result) {
//                obj.references = _.zip(obj.references, result).map(function (pair) {
//                    var r = pair[0];
//                    var o = pair[1];
//                    return {
//                        referenceType: r.referenceTypeId.displayText(),
//                        object: o
//                    };
//                });
//                callback(err, obj);
//            }
//        );
//    }

    function camelize(str) {
      return str.replace (/(?:^|[-])(\w)/g, function ( _ , c) { return c ? c.toUpperCase () : ''; });
    }
    function lowerize(str) {
        return str.substring(0, 1).toLowerCase() + str.substring(1);
    }

    function _reconstruct_manageable_object(object, callback) {

        assert(_.isFunction(callback));

        var index = object.nodeId.toString();

        if (self._objMap.hasOwnProperty(index)) {
            var o = self._objMap[index];
            callback(null, o);
            return;
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
            browseName: object.browseName.name

        };

        var referenceMap = obj;

        object.references.map(function (ref) {

            var ref_index = ref.referenceTypeId.toString();
            var referenceType = self._objectCache[ref_index];
            var reference = self._objectCache[ref.nodeId.toString()];

            var refName = lowerize(referenceType.browseName.name);

            assert(typeof refName === "string");

            if (refName === "hasTypeDefinition")  {
                obj.hasTypeDefinition = reference.browseName.name;
            } else {
                if (!referenceMap[refName]) {
                    referenceMap[refName] = [];
                }
                _reconstruct_manageable_object(reference,function(err,mobject){
                    referenceMap[refName].push(mobject);
                });
            }

        });

        self._objMap[index] = obj;
        callback(null,obj);
        ///xxx _resolve_reference_to_object(obj, callback);

    }


    var index = nodeId.toString();
    if (!self._objMap.hasOwnProperty(index)) {
        self.crawl(nodeId, {}, function done() {
            if (self._objectCache.hasOwnProperty(index)) {
                var object = self._objectCache[index];
                assert(object.browseName.name !== "pending");
                _reconstruct_manageable_object(object,callback);
            } else {
                callback(new Error("Cannot find nodeid" + index));
            }

        });
    } else {
        var object = self._objMap[index];
        callback(null, object);
    }

};

exports.NodeCrawler = NodeCrawler;

