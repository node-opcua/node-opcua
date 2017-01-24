import { AttributeIds } from "lib/services/read_service";
import { BrowseDirection, BrowseDescription, makeResultMask } from "lib/services/browse_service";
// xx var AttributeNameById = opcua.AttributeNameById;
import async from "async";
import _ from "underscore";
import util from "util";
import { EventEmitter } from "events";
import { NodeId, resolveNodeId } from "lib/datamodel/nodeid";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import assert from "better-assert";
import { VariableIds } from "lib/opcua_node_ids";

import { lowerFirstLetter } from "lib/misc/utils";


// xx var doDebug = utils.checkDebugFlag(__filename);
//
// some server do not expose the ReferenceType Node in their address space
// ReferenceType are defined by the OPCUA standard and can be prepopulated in the crawler.
// Pre-populating the ReferenceType node in the crawler will also reduce the network traffic.
//
import { ReferenceTypeIds } from "lib/opcua_node_ids";

import { makeNodeId } from "lib/datamodel/nodeid";
import { 
  make_debugLog,
  checkDebugFlag
} from "lib/misc/utils";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

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
  const high_limit = (maxNode <= 0) ? arr.length : maxNode;
  const tmp = arr.splice(0, high_limit);
  assert(tmp.length > 0);
  return tmp;
}

/**
 * @class NodeCrawler
 * @param session
 * @constructor
 */
class NodeCrawler extends EventEmitter {
  constructor(session) {
    super();
    const self = this;

    self.session = session;

    self.browseNameMap = {};
    self._nodesToReadEx = [];
    self._objectCache = {};
    self._objectToBrowse = [];
    self._objMap = {};

    this._initialize_referenceTypeId();

    self.q = async.queue((task, callback) => {
          // use process next tick to relax the stack frame
      setImmediate(() => {
        task.func.call(self, task, () => {
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

  _initialize_referenceTypeId() {
    const self = this;

    function append_prepopulated_reference(browseName) {
      const nodeId = makeNodeId(ReferenceTypeIds[browseName], 0);
      assert(nodeId);
      const ref_index = nodeId.toString();
      const obj = {
        nodeId,
        browseName: { name: browseName },
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
  }

  _readOperationalLimits(callback) {
    const self = this;
    const n1 = makeNodeId(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRead);
    const n2 = makeNodeId(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse);
    const nodesToRead = [
          { nodeId: n1, attributeId: AttributeIds.Value },
          { nodeId: n2, attributeId: AttributeIds.Value }
    ];
    self.session.read(nodesToRead, (err, nodeIds, results) => {
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
  }

  set_cache_NodeAttribute(nodeId, attributeId, value) {
    const self = this;
    const index = `${nodeId.toString()}_${attributeId.toString()}`;
    self.browseNameMap[index] = value;
  }

  has_cache_NodeAttribute(nodeId, attributeId) {
    const self = this;
    const index = `${nodeId.toString()}_${attributeId.toString()}`;
    return self.browseNameMap.hasOwnProperty(index);
  }

  get_cache_NodeAttribute(nodeId, attributeId) {
    const self = this;
    const index = `${nodeId.toString()}_${attributeId.toString()}`;
    return self.browseNameMap[index];
  }

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

  _defer_readNode(nodeId, attributeId, callback) {
    const self = this;

    nodeId = resolveNodeId(nodeId);
    assert(nodeId instanceof NodeId);

    const index = `${nodeId.toString()}_${attributeId.toString()}`;

    if (self.has_cache_NodeAttribute(nodeId, attributeId)) {
      callback(null, self.get_cache_NodeAttribute(nodeId, attributeId));
    } else {
      self.browseNameMap[index] = "?";
      self._nodesToReadEx.push({
        nodeToRead: {
          nodeId,
          attributeId
        },
        callback(dataValue) {
          self.set_cache_NodeAttribute(nodeId, attributeId, dataValue);
          callback(null, dataValue);
        }
      });
    }
  }

  /**
   * perform pending read Node operation
   * @method _resolve_deferred_readNode
   * @param callback {Function}
   * @private
   */
  _resolve_deferred_readNode(callback) {
    const self = this;
    if (self._nodesToReadEx.length === 0) {
          // nothing to read
      callback();
      return;
    }

    const _nodesToReadEx = _fetch_elements(self._nodesToReadEx, self.maxNodesPerRead);

    const nodesToRead = _nodesToReadEx.map(e => e.nodeToRead);

    self.session.read(nodesToRead, (err, nodesToRead, results /* , diagnostics*/) => {
      if (!err) {
        _.zip(_nodesToReadEx, results).forEach((pair) => {
          const _nodeToReadEx = pair[0];

          const dataValue = pair[1];
          assert(dataValue.hasOwnProperty("statusCode"));
          if (dataValue.statusCode === StatusCodes.Good) {
            if (dataValue.value === null) {
              _nodeToReadEx.callback(null);
            }          else {
              _nodeToReadEx.callback(dataValue.value.value);
            }
          } else {
            _nodeToReadEx.callback({ name: dataValue.statusCode.key });
          }
        });
      }
      callback(err);
    });
  }

  _resolve_deferred(comment, collection, method) {
    const self = this;

    if (collection.length > 0) {
      self._push_task(`adding operation ${comment}`, {
        params: {},
        func(task, callback) {
          method.call(self, callback);
        }
      });
    }
  }

  resolve_deferred_readNode() {
    this._resolve_deferred("read_node", this._nodesToReadEx, this._resolve_deferred_readNode);
  }

  resolve_deferred_browseNode() {
    this._resolve_deferred("browse_node", this._objectToBrowse, this._resolve_deferred_browseNode);
  }

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
  _defer_browse_node(nodeId, callback) {
    const self = this;

    const index = resolveNodeId(nodeId).toString();

    if (self._objectCache.hasOwnProperty(index)) {
      const object = self._objectCache[index];
      assert(object.browseName.name !== "pending");
      return callback(null, object);
    } 
    const element = {
      nodeId,
      browseName: { name: "pending" },
              // references by types
      references: null
    };

    assert(!self._objectCache.hasOwnProperty(index));
    self._objectCache[index] = element;

    self._objectToBrowse.push({
      nodeId,
      browseDirection: BrowseDirection.Forward,
              // attributeId: AttributeIds.BrowseName
      callback(object) {
        object.references = object.references || [];
        assert(object === element);
        assert(object.browseName.name !== "pending");
        callback(null, object);
      },
      element
    });
  }

  _process_browse_response(task, callback) {
      /* jshint validthis: true */
    const self = this;

    const _objectsToBrowse = task.param._objectsToBrowse;
    const results = task.param.results;

    _.zip(_objectsToBrowse, results).forEach((pair) => {
      const _objectToBrowse = pair[0];

      const index = _objectToBrowse.nodeId.toString();
      const obj = self._objectCache[index];
      assert(obj === _objectToBrowse.element);

      obj.references = pair[1].references;

      async.series([

        (callback) => {
          self._defer_readNode(obj.nodeId, AttributeIds.BrowseName, (err, browseName) => {
            debugLog(" NodeCrawler".cyan, " setting name = ".yellow, browseName, " on ", obj.nodeId.toString(), err ? err.message : null);
            obj.browseName = browseName;
            callback();
          });
        },
        (callback) => {
                // only if nodeClass is Variable
                // read dataType and DataType if node is a variable
          self._defer_readNode(obj.nodeId, AttributeIds.DataType, (err, dataType) => {
            if (!(dataType instanceof NodeId)) {
              return callback();
            }
            debugLog(" NodeCrawler".cyan, " setting DataType = ".yellow, dataType, " on ", obj.nodeId.toString(), err ? err.message : null);
            obj.dataType = dataType;


            self._defer_readNode(dataType, AttributeIds.BrowseName,(err, dataTypeBrowseName) => {
              obj.dataTypeName = dataTypeBrowseName.toString();
              callback();
            });
          });
        },
        (callback) => {
          self._defer_readNode(obj.nodeId, AttributeIds.Value, (err, dataValue) => {
            debugLog(" NodeCrawler".cyan, " setting Value = ".yellow, dataValue, " on ", obj.nodeId.toString(), err ? err.message : null);
            obj.dataValue = dataValue;
            callback();
          });
        }

      ],(err) => {
        _objectToBrowse.callback(obj);
      }
        );
    });
    callback();
  }

  _resolve_deferred_browseNode(callback) {
    const self = this;

    if (self._objectToBrowse.length === 0) {
      callback();
      return;
    }

    const _objectsToBrowse = _fetch_elements(self._objectToBrowse, self.maxNodesPerBrowse);

    const nodesToBrowse = _objectsToBrowse.map(e => new BrowseDescription({
      browseDirection: BrowseDirection.Forward,
      nodeId: e.nodeId,
      resultMask
    }));

    self.session.browse(nodesToBrowse, (err, results /* , diagnostics*/) => {
      if (!err) {
        assert(results.length === nodesToBrowse.length);
        self._shift_task("process browse result", {
          param: {
            _objectsToBrowse,
            results
          },
          func: NodeCrawler.prototype._process_browse_response
        });
      } else {
        console.log("ERROR = ", err);
      }
      callback(err);
    });
  }

  _shift_task(name, task) {
    const self = this;
    assert(_.isFunction(task.func));
    task.comment = `S:${name}`;
    assert(task.func.length === 2);
    self.q.unshift(task);
  }

  _push_task(name, task) {
    const self = this;
    assert(_.isFunction(task.func));
    task.comment = `P:${name}`;
    assert(task.func.length === 2);
    self.q.push(task);
  }

  _emit_on_crawled(element) {
    const self = this;
    self.emit("browsed", element);
  }

  _crawl(task, callback) {
      /* jshint validthis: true */
    const self = this;
    const _visited_node = self._visited_node;

    let nodeId = task.params.nodeId;

    nodeId = resolveNodeId(nodeId);

    const index = nodeId.toString();

    if (_visited_node.hasOwnProperty(index)) {
      console.log("skipping already visited", index);
      callback();
      return;// already visited
    }
      // mark as visited to avoid infinite recursion
    _visited_node[index] = true;

    self._defer_browse_node(nodeId, (err, object) => {
      if (!err) {
        let i = 0;
        for (i = 0; i < object.references.length; i++) {
          const reference = object.references[i];

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
  }

  _add_crawl_task(nodeId) {
      /* jshint validthis: true */
    const self = this;
    assert(_.isObject(self));
    const _crawled = self._crawled;
    assert(_.isObject(_crawled));

    const index = nodeId.toString();
    if (_crawled.hasOwnProperty(index)) {
      return;
    }
    _crawled[index] = 1;
    self._push_task("_crawl task", {
      params: { nodeId },
      func: NodeCrawler.prototype._crawl
    });
  }

  _inner_crawl(nodeId, user_data, end_callback) {
    const self = this;
    assert(_.isFunction(end_callback));

    self._visited_node = {};
    self._crawled = {};

    let _has_ended = false;
    self.q.drain = () => {
      if (!_has_ended) {
        _has_ended = true;
        self.emit("end");
        end_callback();
      }
    };
    self._add_crawl_task(nodeId);
  }

  /**
   * @method crawl
   * @param nodeId {NodeId}
   * @param user_data {Object}
   * @param end_callback {Function}
   */
  crawl(nodeId, user_data, end_callback) {
    assert(_.isFunction(end_callback));
    const self = this;
    self._readOperationalLimits((err) => {
      if (err) {
        return end_callback(err);
      }
      self._inner_crawl(nodeId, user_data, end_callback);
    });
  }

  read(nodeId, callback) {
    const self = this;

    try {
      nodeId = resolveNodeId(nodeId);
    } catch (err) {
      callback(err);
    }

    function simplify_object(objMap, object, final_callback) {
      assert(_.isFunction(final_callback));

      const queue = async.queue((task, callback) => {
        setImmediate(() => {
          assert(_.isFunction(task.func));
          task.func(task.data, callback);
        });
      }, 1);

      const index = object.nodeId.toString();

      function add_for_reconstruction(object, extra_func) {
        assert(_.isFunction(extra_func));
        assert(typeof object.nodeId.toString() === "string");
        queue.push({
          data: object,
          func(data, callback) {
            _reconstruct_manageable_object(data, (err, obj) => {
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

        const index = object.nodeId.toString();

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
        const obj = {
          browseName: object.browseName.name,
          nodeId: object.nodeId.toString()
        };

              // Append nodeClass
        if (object.nodeClass) {
          obj.nodeClass = object.nodeClass.toString();
        }
        if (object.dataType) {
          obj.dataType = object.dataType.toString();
          obj.dataTypeName = object.dataTypeName;
                // xx  console.log("dataTypeObj",object.dataTypeObj.browseName);
        }
        if (object.dataValue) {
          if (object.dataValue instanceof Array || object.dataValue.length > 10) {
                  // too much verbosity here
          } else {
            obj.dataValue = object.dataValue.toString();
          }
        }
        objMap[index] = obj;

        const referenceMap = obj;

        object.references = object.references || [];


        object.references.map((ref) => {
          const ref_index = ref.referenceTypeId.toString();

          const referenceType = self._objectCache[ref_index];

          if (!referenceType) {
            console.log((`Unknown reference type ${ref_index}`).red.bold);
            console.log(util.inspect(object, { colorize: true, depth: 10 }));
          }
          const reference = self._objectCache[ref.nodeId.toString()];

                  // Extract nodeClass so it can be appended
          reference.nodeClass = ref.$nodeClass;

          const refName = lowerFirstLetter(referenceType.browseName.name);

          if (refName === "hasTypeDefinition") {
            obj.typeDefinition = reference.browseName.name;
          } else {
            if (!referenceMap[refName]) {
              referenceMap[refName] = [];
            }
            add_for_reconstruction(reference, (err, mobject) => {
              if (!err) {
                referenceMap[refName].push(mobject);
              }
            });
          }
        });
        callback(null, obj);
      }

      add_for_reconstruction(object, () => {
      });

      queue.drain = () => {
        const object = self._objMap[index];
        remove_cycle(object, callback);
      };
    }

    const index = nodeId.toString();

      // check if object has already been crawled
    if (self._objMap.hasOwnProperty(index)) {
      const object = self._objMap[index];
      return callback(null, object);
    }

    self.crawl(nodeId, {}, () => {
      if (self._objectCache.hasOwnProperty(index)) {
        const object = self._objectCache[index];
        assert(object.browseName.name !== "pending");

        simplify_object(self._objMap, object, callback);
      } else {
        callback(new Error(`Cannot find nodeid${index}`));
      }
    });
  }
}

//                         "ReferenceType | IsForward | BrowseName | NodeClass | DisplayName | TypeDefinition"
const resultMask = makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition");


function remove_cycle(object, callback) {
  const visitedNodeIds = {};

  function hasBeenVisited(e) {
    const key = e.nodeId.toString();
    return visitedNodeIds[key];
  }

  function setVisited(e) {
    const key = e.nodeId.toString();
    return visitedNodeIds[key] = e;
  }

  function mark_array(arr) {
    if (!arr) { return; }
    assert(_.isArray(arr));
    for (let index = 0; index < arr.length; index++) {
      const e = arr[index];
      if (hasBeenVisited(e)) {
        return;
      } 
      setVisited(e);
      explorerObject(e);
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

export { NodeCrawler };
