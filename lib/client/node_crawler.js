var opcua = require("../../");
var AttributeIds = opcua.AttributeIds;
var AttributeNameById = opcua.AttributeNameById;
var BrowseDirection = opcua.BrowseDirection;
var async = require("async");
var _ = require("underscore");
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var resolveNodeId = opcua.resolveNodeId;
var NodeId = opcua.NodeId;
var StatusCodes = opcua.StatusCodes;

/**
 * @class NodeCrawler
 * @param session
 * @constructor
 */
function NodeCrawler(session) {

    var self = this;

    self.session = session;

    self.browseNameMap = {};
    self._nodesToReadEx =[];

    self._objectCache    = {};
    self._objectToBrowse = [];

    self._objMap = {};

    self.q = async.queue(function (task, callback) { setImmediate(function() {task.func(callback); });  }, 1);

}
util.inherits(NodeCrawler, EventEmitter);


NodeCrawler.prototype.set_cache_NodeAttribute = function(nodeId,attributeId,value){
    var self = this;
    var index =  nodeId.toString() + "_" + attributeId.toString();
    //xx console.log(" xxxxx setting ".red.bold,nodeId.toString(),attributeId,value);
    self.browseNameMap[index] = value;
};
NodeCrawler.prototype.has_cache_NodeAttribute = function(nodeId,attributeId){
    var self = this;
    var index =  nodeId.toString() + "_" + attributeId.toString();
    return self.browseNameMap.hasOwnProperty(index);
};
NodeCrawler.prototype.get_cache_NodeAttribute = function(nodeId,attributeId){
    var self = this;
    var index =  nodeId.toString() + "_" + attributeId.toString();
    return self.browseNameMap[index];
};


/**
 * method _defer_readNode
 * @param nodeId
 * @param {function} callback
 * @param {Error|null} callback.err
 * @param {string} callback.browseName
 * @private
 */
NodeCrawler.prototype._defer_readNode =   function (nodeId,attributeId,callback) {
    var self = this;

    nodeId = resolveNodeId(nodeId);
    assert(nodeId instanceof NodeId);

    var index =  nodeId.toString() + "_" + attributeId.toString();

    if (self.has_cache_NodeAttribute(nodeId,attributeId)) {
        callback(null,self.get_cache_NodeAttribute(nodeId,attributeId));
    } else {

        self.browseNameMap[index] = "?";
        self._nodesToReadEx.push({
            nodeToRead: {
                nodeId: nodeId,
                attributeId: AttributeIds.BrowseName
            },
            callback: function(dataValue){

                self.set_cache_NodeAttribute(nodeId,attributeId,dataValue);

                callback(null,dataValue);
            }
        });
    }
};

/**
 *
 * @param callback
 * @private
 */
NodeCrawler.prototype._resolve__deferred_readNode = function(callback) {


    var self = this;
    if( self._nodesToReadEx.length==0) {
        callback();
        return;
    }
    //xx console.log("_resolve__deferred_readNode " ,self._nodesToReadEx.length );

    var _nodesToReadEx = self._nodesToReadEx;
    self._nodesToReadEx = [];

    var nodesToRead = _nodesToReadEx.map(function(e){ return  e.nodeToRead;});

    self.session.read(nodesToRead, function (err,nodesToRead,results,diagnostics) {

        if (!err) {

            _.zip(_nodesToReadEx, results).forEach(function (pair) {
                var _nodeToReadEx = pair[0];

                var dataValue = pair[1];
                assert(dataValue.hasOwnProperty('statusCode'));
                if (dataValue.statusCode === StatusCodes.Good) {
                    //xx var nodeId      = _nodeToReadEx.nodeToRead.nodeId;
                    //xx var attributeId =  _nodeToReadEx.nodeToRead.attributeId;
                    //xx var index =  nodeId.toString() + "_" + attributeId.toString();
                    // console.log(" XXXXX".blue, dataValue.value.value);
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

NodeCrawler.prototype.resolve__deferred_readNode = function() {

    var self = this;

    if(self._nodesToReadEx.length>0) {
        self.q.push({
            params: {},
            func: function(callback) { self._resolve__deferred_readNode(callback);}
        }, function(err) {
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
NodeCrawler.prototype._defer_browse_node = function (nodeId,callback) {

    var self = this;

    var index =  resolveNodeId(nodeId).toString();

    if (self._objectCache.hasOwnProperty(index)) {

        var object=self._objectCache[index];
        assert(object.browseName.name !== "pending");
        callback(null,object);

    } else {

        var element = {
            nodeId: nodeId,
            browseName: {name:"pending"},
            //references by types
            references: null
        };

        assert(!self._objectCache.hasOwnProperty(index));
        self._objectCache[index] =  element;

        self._objectToBrowse.push({
            nodeId: nodeId,
            //browseDirection : BrowseDirection.Forward
            //attributeId: AttributeIds.BrowseName
            callback: function(object){
                assert( object === element);
                assert( object.references !== null);
                assert(object.browseName.name !== "pending");
                callback(null,object);
            },
            element: element
        });
    }
};


NodeCrawler.prototype._resolve_deferred_browse_node = function(callback) {

    var self = this;

    if( self._objectToBrowse.length==0) {
        callback();
        return;
    }
    //xx console.log("xxxxx _resolve_deferred_browse_node " ,self._objectToBrowse.length );

    var _objectsToBrowse = self._objectToBrowse;
    self._objectToBrowse = [];

    var nodesToBrowse = _objectsToBrowse.map(function(e){ return { nodeId: e.nodeId};});

    self.session.browse(nodesToBrowse, function (err, results,diagnostics) {

        if (!err) {
            _.zip(_objectsToBrowse,results).forEach(function(pair){
                var _objectToBrowse = pair[0];

                var index = _objectToBrowse.nodeId.toString();
                var obj = self._objectCache[index];
                assert( obj === _objectToBrowse.element);

                obj.references = pair[1].references;

                self._defer_readNode(obj.nodeId,AttributeIds.BrowseName,function(err,browseName){

                    //xx console.log(" XXXXXXXXXXX setting name = ".yellow, browseName , " on ",obj.nodeId.toString());
                    obj.browseName = browseName;

                    _objectToBrowse.callback(obj);
                })

            });

            self.kick();

        }
        callback(err);

    });
};

NodeCrawler.prototype.resolve_deferred_browse_node = function() {

    var self = this;
    if(self._objectToBrowse.length>0) {
        self.q.push({
            params: {},
            func: function(callback){
                self. _resolve_deferred_browse_node(callback);
            }
        },function(err) {
        });
    }
};


NodeCrawler.prototype.kick = function() {
    var self = this;
    self.resolve_deferred_browse_node();
    self.resolve__deferred_readNode();
    // make sure at least one task get executed
    self.q.push({func:function(callback){callback();}});
};

/**
 * @crawl
 * @param nodeId
 * @param user_data
 */
NodeCrawler.prototype.crawl = function(nodeId,user_data,end_callback) {

    assert(_.isFunction(end_callback));

    var self = this;

    var _visited_node = {};

    self.q.drain = function() {
        //xx console.log('all items have been processed');
        self.emit("end");
        end_callback();
    };

    function emit_on_crawled(element) {
        self.emit("browsed",element,user_data);
    }

    function _crawl(nodeId ) {

        nodeId = resolveNodeId(nodeId);

        var index =  nodeId.toString();

        if (_visited_node.hasOwnProperty(index)) {
            //xx console.log("skipping already visited",index);
            return;// already visited
        }
        // mark as visited to avoid infinite recursion
        _visited_node[index] = true;

        self._defer_browse_node(nodeId,function(err,object){
            if (!err) {
                //xxx console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",object.browseName);
                object.references.forEach(function(reference){

                    // this one comes for free
                    if (!self.has_cache_NodeAttribute(reference.nodeId,AttributeIds.BrowseName)){
                        self.set_cache_NodeAttribute(reference.nodeId,AttributeIds.BrowseName,reference.browseName);
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

NodeCrawler.prototype.read = function(nodeId,callback) {


    var self = this;

    try {
        nodeId = resolveNodeId(nodeId);
    } catch(err) {
        callback(err);
    }

    function _resolve_reference_to_object(obj,callback) {
        async.mapSeries(
            obj.references,
            // iterator
            function (item, inner_callback) {
                self.read(item.nodeId, function (err, transformed_obj) {
                    inner_callback(err, transformed_obj);
                })
            },
            function (err, result) {
                obj.references = _.zip(obj.references,result).map(function(pair){
                    var r = pair[0];
                    var o = pair[1];
                    return {
                        referenceType: r.referenceTypeId.displayText(),
                        object: o
                    };
                });
                callback(err, obj);
            }
        );
    }
    var index = nodeId.toString();
    if (!self._objMap.hasOwnProperty(index)) {
        self.crawl(nodeId, {}, function done() {


            if (self._objectCache.hasOwnProperty(index)) {
                var object = self._objectCache[index];
                assert(object.browseName.name !== "pending");
                var obj = {
                    browseName: object.browseName.name,
                    references: object.references
                };
                self._objMap[index] = obj;
                _resolve_reference_to_object(obj,callback);

            } else {
                callback(new Error("Cannot find nodeid" + index))
            }

        });
    } else {
        var object = self._objMap[index];
        callback(null, object);
    }

};

exports.NodeCrawler = NodeCrawler;

