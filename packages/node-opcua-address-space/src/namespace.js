const assert = require("node-opcua-assert").assert;
const QualifiedName = require("node-opcua-data-model").QualifiedName;
/**
 *
 * @params {Object}
 */
function UANamespace(options) {

    const self = this;
    assert(typeof options.namespaceUri === "string");
    assert(options.addressSpace.constructor.name === "AddressSpace");
    assert(typeof options.index === "number");
    self.namespaceUri = options.namespaceUri;
    self.__addressSpace = options.addressSpace;
    self.index= options.index;
}

UANamespace.prototype._getNextAvailableId = function()
{

};

const NodeId  = require("node-opcua-nodeid").NodeId;

function _adjust_options(self,options) {
    const ns = self.__addressSpace.getNamespaceIndex(self.namespaceUri);
    if (!options.nodeId) {
        const id = self._getNextAvailableId();
        options.nodeId =new NodeId(NodeId.NodeIdType.NUMERIC,id,ns);
    }
    options.nodeId = NodeId.coerce(options.nodeId);
    if (typeof options.browseName ==="string") {
        options.browseName = new QualifiedName({
            name: options.browseName,
            namespaceIndex: ns
        });
    }
    return options;
}
UANamespace.prototype.addVariable = function(options)
{
    const self = this;
    _adjust_options(self,options);
    return self.__addressSpace.addVariable(options);
};
UANamespace.prototype.addVariableType = function(options)
{
    const self = this;
    _adjust_options(self,options);
    return self.__addressSpace.addVariableType(options);

};
UANamespace.prototype.addObject = function(options)
{
    const self = this;
    _adjust_options(self,options);
    return self.__addressSpace.addObject(options);

};
UANamespace.prototype.addObjectType = function(options)
{
    const self = this;
    _adjust_options(self,options);
    return self.__addressSpace.addObjectType(options);
};
UANamespace.prototype.addMethod = function(options)
{
    const self = this;
    _adjust_options(self,options);
    return self.__addressSpace.addMethod(options);

};

exports.Namespace = UANamespace;

