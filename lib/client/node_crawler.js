var opcua = require("../../");
var AttributeIds = opcua.AttributeIds;
var AttributeNameById = opcua.AttributeNameById;
var BrowseDirection = opcua.BrowseDirection;
var async = require("async");
var _ = require("underscore");

function NodeCrawler(session) {

    var self = this;

    self.session = session;

    // a structure that allows us to retrieve the browseName of a node knowing its nodeId
    // key is nodeId.toString();
    // value is {
    //     browseName: "Name"
    // }
    self._objectCache = {


    };
    self._objectToBrowse = [];

}

NodeCrawler.prototype._readBrowseName = function(nodeId,callback){

    var self = this;

    var nodesToRead = [
        {
            nodeId: nodeId,
            attributeId: AttributeIds.BrowseName
        }
    ];
    self.session.read(nodesToRead,function(err,nodesToRead,results) {
        if (err) {
            callback(err);
        } else {
            assert(_.isArray(results));

            _.zip(nodesToRead,results).forEach(function(pair){
                var index = pair[0].nodeId.toString();
                var value =  pair[1].value;
                //xx console.log(index,value);
                //xx var attributeName = AttributeNameById[pair[0].attributeId];
                callback(null,value.toString());

            });
        }


    });

};

var resolveNodeId = opcua.resolveNodeId;

NodeCrawler.prototype.browse = function(nodeId,main_callback) {

    var self = this;
    var index =  resolveNodeId(nodeId).toString();
    if (self._objectCache.hasOwnProperty(index)) {

        setImmediate(function () {
            callback(null,self._objectCache[index]);
        });
        return;
    }

    self._objectToBrowse.push({
        nodeId: nodeId
        //browseDirection : BrowseDirection.Forward
        //attributeId: AttributeIds.BrowseName
    });
    self._objectCache[index] =  {
        nodeId: nodeId,
        browseName: "pending",
        //references by types
        references: {

        }
    };

    self.tasks= [];

    self.tasks.push(function(callback){
        self._readBrowseName(nodeId,function(err,browseName){
            self._objectCache[index].browseName =  browseName;
            callback();
        })

    });

    self.tasks.push(function(callback){

        self.session.browse(self._objectToBrowse, function (err, results,diagnostics) {

            if (err) {
                callback(err); return;
            }

            _.zip(self._objectToBrowse,results).forEach(function(pair){

                var index = pair[0].nodeId.toString();
                //xx console.log(" xxx ",JSON.stringify(pair[1],0," "));
                //xx console.log("index",index);
                self._objectCache[index].references = pair[1].references;

            });

            self._objectToBrowse =[];

            main_callback(err,self._objectCache[index]);

        });
    });
    async.series(self.tasks,function(err){
        main_callback(err);
    });

};

exports.NodeCrawler = NodeCrawler;

