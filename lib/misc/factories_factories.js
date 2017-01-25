/**
 * @module opcua.miscellaneous
 * @class Factory
 * @static
 */
import assert from "better-assert";
import _ from "underscore";

const _global_factories = {};

function getFactory(type_name) {
  return _global_factories[type_name];
}

const registerFactory = (type_name, constructor) => {
  /* istanbul ignore next */
  if (getFactory(type_name)) {
    throw new Error(` registerFactory  : ${type_name} already registered`);
  }
  _global_factories[type_name] = constructor;
};

/* istanbul ignore next */
function dump() {
  console.log(" dumping registered factories");
  Object.keys(_global_factories).sort().forEach((e) => {
    console.log(" Factory ", e);
  });
  console.log(" done");
}

function callConstructor(constructor) {
  assert(_.isFunction(constructor));

  const FactoryFunction = constructor.bind(...arguments);

  return new FactoryFunction();
}

const getConstructor = (expandedId) => {
  if (!(expandedId && (expandedId.value in constructorMap))) {
    console.log("#getConstructor : cannot find constructor for expandedId ".red.bold, expandedId.toString());
    return null;
  }
  const N = constructorMap[expandedId.value];
  const n = new N();
  return constructorMap[expandedId.value];
};

function hasConstructor(expandedId) {
  if (!expandedId) { return false; }
  assert(expandedId.hasOwnProperty("value"));
  // only namespace 0 can be in constructorMap
  if (expandedId.namespace !== 0) { return false; }
  return !!constructorMap[expandedId.value];
}

function constructObject(expandedNodeId) {
  const constructor = getConstructor(expandedNodeId);
  if (!constructor) { return null; }
  return callConstructor(constructor);
}

let constructorMap = {};
function register_class_definition(classname, class_constructor) {
  registerFactory(classname, class_constructor);

  const expandedNodeId = class_constructor.prototype.encodingDefaultBinary;

  /* istanbul ignore next */
  if (expandedNodeId.value in constructorMap) {
    throw new Error(` Class ${classname} with ID ${expandedNodeId}  already in constructorMap for  ${constructorMap[expandedNodeId.value].name}`);
  }
  constructorMap[expandedNodeId.value] = class_constructor;
}

export {
  getFactory,
  register_class_definition,
  dump,
  callConstructor,
  getConstructor,
  hasConstructor,
  constructObject
};
