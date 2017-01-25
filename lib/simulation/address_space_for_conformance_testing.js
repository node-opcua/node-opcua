/**
 * @module opcua.server.simulation
 * @type {async|exports}
 * @class Simulator
 *
 */
import _ from "underscore";
import assert from "better-assert";
import path from "path";
import fs from "fs";
import { 
  coerceNodeId, 
  makeNodeId 
} from "lib/datamodel/nodeid";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import AddressSpace from "lib/address_space/AddressSpace";
import ServerEngine from "lib/server/ServerEngine";
import { 
  Variant, 
  DataType, 
  VariantArrayType 
} from "lib/datamodel/variant";
import { buildVariantArray } from "lib/datamodel/variant_tools";
import { findBuiltInType } from "lib/misc/factories_builtin_types";
import { DataValue } from "lib/datamodel/datavalue";
import * as ec from "lib/misc/encode_decode";
import { QualifiedName } from "lib/datamodel/qualified_name";
import { LocalizedText } from "lib/datamodel/localized_text";
import { standardUnits } from "lib/data_access/EUInformation";
import { makeAccessLevel } from "lib/datamodel/access_level";
const {
  randomString,
  emptyGuid,
  isValidUInt16,
  isValidBoolean } = ec;

const namespaceIndex = 411;


function defaultValidator(/* value*/) {
  return true;
}
function getValidatorFuncForType(dataType) {
  const f = ec[`isValid${dataType}`];
  return f || defaultValidator;
}
function getRandomFuncForType(dataType) {
  assert(dataType);
  dataType = dataType.key;

  const f = ec[`random${dataType}`];

  if (f) {
    return f;
  }

    // xx console.log("xxxx dataType  ",dataType);
  switch (dataType) {
    case "Variant":
      return () => new Variant();
    case "QualifiedName":
      return () => new QualifiedName({ name: randomString() });
    case "LocalizedText":
      return () => new LocalizedText({ text: randomString() });
    case "XmlElement" :
      return () => {
        const element = randomString();
        const content = randomString();
        return `<${element}>${content}</${element}>`;
      };
    default:
            // istanbul ignore next
      throw new Error(`Cannot find random${dataType}() func anywhere`);
  }
}


function _findDataType(dataTypeName) {
  const builtInDataTypeName = findBuiltInType(dataTypeName);
  const dataType = DataType[builtInDataTypeName.name];
    // istanbul ignore next
  if (!dataType) {
    throw new Error(` dataType ${dataTypeName} must exists`);
  }
  return dataType;
}

function validate_value_or_array(isArray, variantValue, validatorFunc) {
  assert(_.isFunction(validatorFunc));
  let i;
  let value;
  if (isArray) {
    const n = Math.min(10, variantValue.length);

    for (i = 0; i < n; i += 1) {
      value = variantValue[i];
            // istanbul ignore next
      if (!validatorFunc(value)) {
        throw new Error(`default value must be valid for dataType ${variantValue} at index ${i} got ${value}`);
      }
    }
  } else {
        // scalar
        // istanbul ignore next
    if (!validatorFunc(variantValue)) {
      throw new Error(`default value must be valid for dataType ${variantValue}`);
    }
  }
}

function makeVariant(dataTypeName, isArray, current_value) {
  isArray = (isArray === null) ? false : isArray;
  let arrayType = VariantArrayType.Scalar;
  if (isArray) {
    arrayType = VariantArrayType.Array;
  }
  const dataType = _findDataType(dataTypeName);
  assert(!dataType.isAbstract);

  const validatorFunc = getValidatorFuncForType(dataType);

  validate_value_or_array(isArray, current_value, validatorFunc);

  const variant = new Variant({
    dataType,
    arrayType,
    value: current_value
  });
  return variant;
}

function _add_variable(addressSpace, parent, varName, dataTypeName, current_value, isArray, extra_name) {
  assert(typeof extra_name === "string");
  assert(addressSpace instanceof AddressSpace);

  const variant = makeVariant(dataTypeName, isArray, current_value);

  const name = `${parent.browseName.toString()}_${varName}${extra_name}`;

  const nodeId = makeNodeId(name, namespaceIndex);

  const placeholder = {
    variant
  };

  const variable = addressSpace.addVariable({
    componentOf: parent,
    browseName: name,
    description: { locale: "en", text: name },
    nodeId,
    dataType: varName,
    valueRank: isArray ? 1 : -1,
    value: variant
  });
  variable._backdoor_placeholder = placeholder;
  assert(addressSpace.findNode(nodeId));
  return variable;
}


function add_variable(addressSpace, parent, name, realType, default_value, extra_name) {
  assert(typeof extra_name === "string");
  const initialValue = _.isFunction(default_value) ? default_value() : default_value;
  const variable = _add_variable(addressSpace, parent, name, realType, initialValue, false, extra_name);
  assert(variable.valueRank === -1);
  assert(variable.accessLevel.key === "CurrentRead | CurrentWrite");
  assert(variable.userAccessLevel.key === "CurrentRead | CurrentWrite");
  assert(variable.historizing === false);
  return variable;
}

function add_variable_array(addressSpace, parent, dataTypeName, default_value, realTypeName, arrayLength, extra_name) {
  assert(typeof dataTypeName === "string");
  assert(typeof realTypeName === "string");

    // istanbul ignore next
  if (!DataType[realTypeName]) {
    console.log("dataTypeName", dataTypeName);
    console.log("realTypeName", realTypeName);
  }

  assert(DataType[realTypeName], " expecting a valid real type");
  arrayLength = arrayLength || 10;

  const local_defaultValue = _.isFunction(default_value) ? default_value() : default_value;

  const current_value = buildVariantArray(DataType[realTypeName], arrayLength, local_defaultValue);

  const variable = _add_variable(addressSpace, parent, dataTypeName, realTypeName, current_value, true, extra_name);

  assert(variable.accessLevel.key === "CurrentRead | CurrentWrite");
  assert(variable.userAccessLevel.key === "CurrentRead | CurrentWrite");
  assert(variable.historizing === false);
}


function add_mass_variables_of_type(addressSpace, parent, dataTypeName, default_value, realType) {
    // Mass Mass_Boolean -> Mass_Boolean_Boolean_00 ...
  const nodeName = `Scalar_Mass_${dataTypeName}`;

    // xx console.log("xxxx adding mass variable ", nodeName);
  const scalarMass_Type = addressSpace.addObject({
    organizedBy: parent,
    browseName: nodeName,
    description: "This folder will contain 100 items per supported data-type.",
    nodeId: makeNodeId(nodeName, namespaceIndex)
  });
  for (let i = 0; i <= 99; i++) {
    const extra_name = `_${(`00${i.toString()}`).substr(-2)}`;
    const local_defaultValue = _.isFunction(default_value) ? default_value() : default_value;
    _add_variable(addressSpace, scalarMass_Type, dataTypeName, realType, local_defaultValue, false, extra_name);
  }
}
function add_mass_variables(addressSpace, scalarFolder) {
  const scalarMass = addressSpace.addFolder(scalarFolder, {
    browseName: "Scalar_Mass",
    description: "This folder will contain 100 items per supported data-type.",
    nodeId: makeNodeId("Scalar_Mass", namespaceIndex)
  });

  typeAndDefaultValue.forEach((e) => {
    const dataType = e.type;
    const realType = e.realType || dataType;
    add_mass_variables_of_type(addressSpace, scalarMass, dataType, e.defaultValue, realType);
  });
}

/**
 * @method build_address_space_for_conformance_testing
 * @param addressSpace {ServerEngine}
 * @param options
 * @param options.mass_variable {Boolean}
 */
let build_address_space_for_conformance_testing;


const DateTime_Min = new Date();

let typeAndDefaultValue = [
    { type: "Boolean", defaultValue: false },
    { type: "ByteString", defaultValue: new Buffer("OPCUA") },
    { type: "DateTime", defaultValue: DateTime_Min },
    { type: "Double", defaultValue: 0.0 },
    { type: "Float", defaultValue: 0.0 },
    { type: "Guid", defaultValue: emptyGuid },
    { type: "SByte", defaultValue: 0 },
    { type: "Int16", defaultValue: 0 },
    { type: "Int32", defaultValue: 0 },
  {
    type: "NodeId",
    defaultValue() {
      return coerceNodeId(`ns=${namespaceIndex};g=00000000-0000-0000-0000-000000000023`);
    }
  },
    { type: "String", defaultValue: "OPCUA" },
    { type: "Byte", defaultValue: 0 },
    { type: "UInt16", defaultValue: 0 },
    { type: "UInt32", defaultValue: 0 },
    { type: "Duration", realType: "Double", defaultValue: 0.0 },
    { type: "Number", realType: "UInt16", defaultValue: 0 },// Number is abstract
    { type: "Integer", realType: "Int64", defaultValue: 0 },// because Integer is abstract , we choose Int32
    { type: "UInteger", realType: "UInt64", defaultValue: 0 },
  {
    type: "UtcTime",
    realType: "DateTime",
    defaultValue() {
      return new Date();
    }
  },
// xx        {  type: "Int64",         defaultValue:  0},
    { type: "LocaleId", realType: "String", defaultValue: "" },
  {
    type: "LocalizedText",
    defaultValue() {
      return new LocalizedText({});
    }
  },


  {
    type: "QualifiedName",
    defaultValue() {
      return new QualifiedName();
    }
  },
    { type: "Time", realType: "String", defaultValue: "00:00:00" },
    { type: "UInt64", defaultValue: [0, 0] },
    { type: "Int64", defaultValue: [0, 0] },
    // xx {type: "Variant",   realType:   "Variant", defaultValue:  {} },
    { type: "XmlElement", defaultValue: "<string1>OPCUA</string1>" },
    { type: "ImageBMP", realType: "ByteString" },
    { type: "ImageGIF", realType: "ByteString" },
    { type: "ImageJPG", realType: "ByteString" },
    { type: "ImagePNG", realType: "ByteString" },
    // {type: "Enumeration", realType: "UInt32" , defaultValue:0}
];


function add_simulation_variables(server_engine, scalarFolder) {
  assert(server_engine.addressSpace instanceof AddressSpace);
  const addressSpace = server_engine.addressSpace;

  let values_to_change = [];

  function add_simulation_variable(parent, dataTypeName, defaultValue, realTypeName) {
        // the type of the default value
    realTypeName = realTypeName || dataTypeName;

    const dataType = _findDataType(realTypeName);
    const randomFunc = getRandomFuncForType(dataType);

        // istanbul ignore next
    if (!_.isFunction(randomFunc)) {
      throw new Error(`a random function must exist for basicType ${dataTypeName}`);
    }

    const variable = _add_variable(addressSpace, parent, dataTypeName, realTypeName, defaultValue, false, "");

    const value_to_change = {
      dataType,
      variable,
      randomFunc
    };

    values_to_change.push(value_to_change);

    return variable;
  }

  const simulation = addressSpace.addObject({
    organizedBy: scalarFolder,
    browseName: "Scalar_Simulation",
    description: "This folder will contain one item per supported data-type.",
    nodeId: makeNodeId("Scalar_Simulation", namespaceIndex)
  });


    // add simulation variables
  typeAndDefaultValue.forEach((e) => {
    const dataType = e.type;
    const defaultValue = _.isFunction(e.defaultValue) ? e.defaultValue() : e.defaultValue;
    const realType = e.realType || dataType;
    add_simulation_variable(simulation, dataType, defaultValue, realType);
  });


    // add management nodes
  let interval = 2000;
  let enabled = true;
  let timer;


  function change_randomly() {
    values_to_change.forEach((element) => {
      const variant = element.variable._backdoor_placeholder.variant;
      variant.value = element.randomFunc();
      element.variable.setValueFromSource(variant);
    });
  }

  function delete_Timer() {
        // delete previous timer if any
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function install_Timer() {
    delete_Timer();
    assert(!timer);
    if (enabled) {
      timer = setInterval(() => {
        change_randomly();
      }, interval);
    }
  }

  function tearDown_Timer() {
    delete_Timer();
    values_to_change = [];
  }

    // var name = "Interval", "UInt16"
  const intervalVariable = addressSpace.addVariable({
    componentOf: simulation,
    browseName: "Interval",
    description: { locale: "en", text: "The rate (in msec) of change for all Simulated items." },
    nodeId: makeNodeId("Scalar_Simulation_Interval", namespaceIndex),
    dataType: "UInt16",
    value: new Variant({
      dataType: DataType.UInt16,
      arrayType: VariantArrayType.Scalar,
      value: interval
    })
  });

  intervalVariable.on("value_changed", (dataValue)/* ,indexRange*/ => {
    const variant = dataValue.value;
    assert(variant instanceof Variant);
    assert(isValidUInt16(variant.value) && " value must be valid for dataType");
    interval = variant.value;
    install_Timer();
  });


  const enabledVariable = addressSpace.addVariable({
    componentOf: simulation,
    browseName: "Enabled",
    description: { locale: "en", text: "Enabled" },
    nodeId: makeNodeId("Scalar_Simulation_Enabled", namespaceIndex),
    dataType: "Boolean",
    value: new Variant({
      dataType: DataType.Boolean,
      arrayType: VariantArrayType.Scalar,
      value: enabled
    })
  });
  enabledVariable.on("value_changed", (dataValue)/* ,indexRange*/ => {
    const variant = dataValue.value;
    assert(variant instanceof Variant);
    assert(isValidBoolean(variant.value) && " value must be valid for dataType");
    enabled = variant.value;
    install_Timer();
  });
  install_Timer();

  server_engine.registerShutdownTask(tearDown_Timer);
}

function add_scalar_static_variables(addressSpace, scalarFolder) {
  const scalarStatic = addressSpace.addObject({
    organizedBy: scalarFolder,
    browseName: "Scalar_Static",
    description: "This folder will contain one item per supported data-type.",
    nodeId: makeNodeId("Scalar_Static", namespaceIndex)
  });

    // add statics scalar Variables
  typeAndDefaultValue.forEach((e) => {
    const dataType = e.type;
    const realType = e.realType || dataType;
    const defaultValue = _.isFunction(e.defaultValue) ? e.defaultValue() : e.defaultValue;
    add_variable(addressSpace, scalarStatic, dataType, realType, defaultValue, "");
  });

  function setImage__(imageType, filename) {
    const fullpath = path.join(__dirname, "data", filename);
    const imageNode = addressSpace.findNode(`ns=411;s=Scalar_Static_Image${imageType}`);


    const options = {
      refreshFunc(callback) {
        fs.readFile(fullpath, (err, data) => {
          if (err) {
            return callback(null, new DataValue({
              statusCode: StatusCodes.BadInternalError,
              value: { dataType: "ByteString", value: null }
            }));
          }
          assert(data instanceof Buffer);
          callback(null, new DataValue({ value: { dataType: "ByteString", value: data } }));
        });
      }
    };
    imageNode.bindVariable(options, /* overwrite=*/true);
  }
  function setImage(imageType, filename) {
    const fullpath = path.join(__dirname, "data", filename);
    const imageNode = addressSpace.findNode(`ns=411;s=Scalar_Static_Image${imageType}`);
    fs.readFile(fullpath, (err, data) => {
      imageNode.setValueFromSource(new Variant({ dataType: DataType.ByteString, value: data }));
    });
  }
  setImage("BMP", "image.bmp");
  setImage("PNG", "tux.png");
  setImage("GIF", "gif-anime.gif");
  setImage("JPG", "tiger.jpg");


    // add statics Array Variables
  const scalarStaticArray = addressSpace.addObject({
    organizedBy: scalarFolder,
    browseName: "Scalar_Static_Array",
    description: "Single dimension, suggested size of 10-elements per array. Unsupported types will be missing from the address-space.",
    nodeId: makeNodeId("Scalar_Static_Array", namespaceIndex)
  });
    // add static Array
  typeAndDefaultValue.forEach((e) => {
    const dataType = e.type;
    const realType = e.realType || dataType;
    add_variable_array(addressSpace, scalarStaticArray, dataType, e.defaultValue, realType, 10, "");
  });
    // add static Mass
}


function add_access_right_variables(addressSpace, parentFolder) {
  const accessRight_Folder = addressSpace.addFolder(parentFolder, {
    browseName: "AccessRight",
    description: "Folder containing various nodes with different access right behavior",
    nodeId: makeNodeId("AccessRight", namespaceIndex)
  });

  const accessLevel_All_Folder = addressSpace.addFolder(accessRight_Folder, {
    browseName: "AccessLevel",
    description: "Various node with different access right behavior",
    nodeId: makeNodeId("AccessLevel", namespaceIndex)
  });


  let name;

  name = "AccessLevel_CurrentRead";
  addressSpace.addVariable({
    componentOf: accessLevel_All_Folder,
    browseName: name,
    description: { locale: "en", text: name },
    nodeId: makeNodeId(name, namespaceIndex),
    dataType: "Int32",
    valueRank: -1,

    accessLevel: "CurrentRead",
    userAccessLevel: "CurrentRead",

    value: new Variant({
      dataType: DataType.Int32,
      arrayType: VariantArrayType.Scalar,
      value: 36
    })
  });

  name = "AccessLevel_CurrentWrite";
  addressSpace.addVariable({
    componentOf: accessLevel_All_Folder,
    browseName: name,
    description: { locale: "en", text: name },
    nodeId: makeNodeId(name, namespaceIndex),
    dataType: "Int32",
    valueRank: -1,
    accessLevel: "CurrentWrite",
    userAccessLevel: "CurrentWrite",
    value: {}

  });

  name = "AccessLevel_CurrentRead_NotUser";
  addressSpace.addVariable({
    componentOf: accessLevel_All_Folder,
    browseName: name,
    description: { locale: "en", text: name },
    nodeId: makeNodeId(name, namespaceIndex),
    dataType: "Int32",
    valueRank: -1,

    accessLevel: "CurrentRead",

    userAccessLevel: "",

    value: new Variant({
      dataType: DataType.Int32,
      arrayType: VariantArrayType.Scalar,
      value: 36
    })
  });

  name = "AccessLevel_CurrentWrite_NotUser";
  addressSpace.addVariable({
    componentOf: accessLevel_All_Folder,
    browseName: name,
    description: { locale: "en", text: name },
    nodeId: makeNodeId(name, namespaceIndex),
    dataType: "Int32",
    valueRank: -1,

    accessLevel: "CurrentWrite | CurrentRead",

    userAccessLevel: "CurrentRead",

    value: new Variant({
      dataType: DataType.Int32,
      arrayType: VariantArrayType.Scalar,
      value: 36
    })
  });

  name = "AccessLevel_CurrentRead_NotCurrentWrite";
  addressSpace.addVariable({
    componentOf: accessLevel_All_Folder,
    browseName: name,
    description: { locale: "en", text: name },
    nodeId: makeNodeId(name, namespaceIndex),
    dataType: "Int32",
    valueRank: -1,

    accessLevel: "CurrentRead",

    userAccessLevel: "CurrentRead",

    value: new Variant({
      dataType: DataType.Int32,
      arrayType: VariantArrayType.Scalar,
      value: 36
    })
  });


  name = "AccessLevel_CurrentWrite_NotCurrentRead";
  addressSpace.addVariable({
    componentOf: accessLevel_All_Folder,
    browseName: name,
    description: { locale: "en", text: name },
    nodeId: makeNodeId(name, namespaceIndex),
    dataType: "Int32",
    valueRank: -1,

    accessLevel: "CurrentWrite",

    userAccessLevel: "CurrentWrite",

    value: new Variant({
      dataType: DataType.Int32,
      arrayType: VariantArrayType.Scalar,
      value: 36
    })
  });

  name = "AccessLevel_DeniedAll";
  addressSpace.addVariable({
    componentOf: accessLevel_All_Folder,
    browseName: name,
    description: { locale: "en", text: name },
    nodeId: makeNodeId(name, namespaceIndex),
    dataType: "Int32",
    valueRank: -1,

    accessLevel: "",
    userAccessLevel: "",

    value: new Variant({
      dataType: DataType.Int32,
      arrayType: VariantArrayType.Scalar,
      value: 36
    })
  });
}
function add_path_10deep(addressSpace, simulation_folder) {
  let parent = simulation_folder;
  for (let i = 1; i < 15; i++) {
    const name = `Path_${i.toString()}Deep`;

    const child = addressSpace.addObject({
      organizedBy: parent,
      browseName: name,
      description: `A folder at the top of ${i} elements`,
      typeDefinition: "FolderType",
      nodeId: makeNodeId(name, namespaceIndex)
    });
    parent = child;
  }
}
function add_very_large_array_variables(addressSpace, objectsFolder) {
    // add statics Array Variables
  const scalarStaticLargeArray = addressSpace.addObject({
    organizedBy: objectsFolder,
    browseName: "Scalar_Static_Large_Array",
    description: "Single dimension, suggested size of 100k-elements per array.",
    nodeId: makeNodeId("Scalar_Static_Large_Array", namespaceIndex)
  });
  typeAndDefaultValue.forEach((e) => {
    const dataType = e.type;
    const realType = e.realType || dataType;
    add_variable_array(addressSpace, scalarStaticLargeArray, dataType, e.defaultValue, realType, 50 * 1024, "");
  });
}
//      BaseDataVariableType
//         |
//      DataItemType
//         ^
//         |
//      +----------------+---------------------+
//      |                |                     |
// ArrayItemType   AnalogItemType         DiscreteItemType
//                                             ^
//                                             |
//                +-----------------------------+---------------------------------+
//                |                             |                                 |
//           TwoStateDiscreteType     MultiStateDiscreteType                MutliStateValueDiscreteType
//
function add_analog_data_items(addressSpace, parentFolder) {
  function _addDataItem(localParentFolder, dataType, initialValue) {
        // istanbul ignore next
    if (!(DataType[dataType])) {
      throw new Error(` Invalid dataType ${dataType}`);
    }

    const name = `${dataType}DataItem`;
    const nodeId = makeNodeId(name, namespaceIndex);

    addressSpace.addDataItem({
      componentOf: localParentFolder,
      nodeId,
      browseName: name,
      definition: "(tempA -25) + tempB",
      dataType,
      value: new Variant({
        arrayType: VariantArrayType.Scalar,
        dataType: DataType[dataType],
        value: initialValue
      })
    });
  }

  function _addAnalogDataItem(localParentFolder, dataType, initialValue) {
        // istanbul ignore next
    if (!(DataType[dataType])) {
      throw new Error(` Invalid dataType ${dataType}`);
    }

    const name = `${dataType}AnalogDataItem`;
    const nodeId = makeNodeId(name, namespaceIndex);
        // UAAnalogItem
        // add a UAAnalogItem
    addressSpace.addAnalogDataItem({

      componentOf: localParentFolder,

      nodeId,
      browseName: name,
      definition: "(tempA -25) + tempB",
      valuePrecision: 0.5,
      engineeringUnitsRange: { low: 1, high: 50 },
      instrumentRange: { low: 1, high: 50 },
      engineeringUnits: standardUnits.degree_celsius,
      dataType,
      value: new Variant({
        arrayType: VariantArrayType.Scalar,
        dataType: DataType[dataType],
        value: initialValue
      })
    });
  }

  function _addArrayAnalogDataItem(localParentFolder, dataType, initialValue) {
        // istanbul ignore next
    if (!(DataType[dataType])) {
      throw new Error(` Invalid dataType ${dataType}`);
    }
    const name = `${dataType}ArrayAnalogDataItem`;
    const nodeId = makeNodeId(name, namespaceIndex);
        // UAAnalogItem
        // add a UAAnalogItem
    addressSpace.addAnalogDataItem({

      componentOf: localParentFolder,

      nodeId,
      browseName: name,
      definition: "(tempA -25) + tempB",
      valuePrecision: 0.5,
      engineeringUnitsRange: { low: 1, high: 50 },
      instrumentRange: { low: 1, high: 50 },
      engineeringUnits: standardUnits.degree_celsius,
      dataType,
      value: new Variant({
        arrayType: VariantArrayType.Array,
        dataType: DataType[dataType],
        value: [initialValue, initialValue]
      })
    });
  }

    // add statics Array Variables
  const analogItemFolder = addressSpace.addObject({
    organizedBy: parentFolder,
    browseName: "Simulation_AnalogDataItem",
    typeDefinition: "FolderType",
    nodeId: makeNodeId("Simulation_AnalogDataItem", namespaceIndex)
  });

  const name = "DoubleAnalogDataItemWithEU";
  const nodeId = makeNodeId(name, namespaceIndex);

  addressSpace.addAnalogDataItem({

    componentOf: analogItemFolder,
    nodeId,
    browseName: name,
    definition: "(tempA -25) + tempB",
    valuePrecision: 0.5,
    engineeringUnitsRange: { low: 100, high: 200 },
    instrumentRange: { low: -100, high: +200 },
    engineeringUnits: standardUnits.degree_celsius,
    dataType: "Double",

    value: new Variant({
      dataType: DataType.Double,
      value: 19.5
    })
  });


  const data = [
        { dataType: "Double", value: 3.14 },
        { dataType: "Float", value: 3.14 },
        { dataType: "Int16", value: -10 },
        { dataType: "UInt16", value: 10 },
        { dataType: "Int32", value: -100 },
        { dataType: "UInt32", value: 100 },
        { dataType: "Int64", value: [0, 0] },
        { dataType: "UInt64", value: [0, 0] },
        { dataType: "Byte", value: 120 },
        { dataType: "SByte", value: -123 },
        { dataType: "String", value: "some string" },
        { dataType: "DateTime", value: new Date() }
  ];

  data.forEach((e) => {
    _addAnalogDataItem(analogItemFolder, e.dataType, e.value);
  });
  data.forEach((e) => {
    _addDataItem(analogItemFolder, e.dataType, e.value);
  });
  data.forEach((e) => {
    _addArrayAnalogDataItem(analogItemFolder, e.dataType, e.value);
  });
}

function getDADiscreteTypeFolder(addressSpace,parentFolder) {
  const name = "Simulation_DA_DiscreteType";
  const nodeId =  makeNodeId("Simulation_DA_DiscreteType", namespaceIndex);

  if (addressSpace.findNode(nodeId)) {
    return addressSpace.findNode(nodeId);
  }
  const node = addressSpace.addObject({
    organizedBy: parentFolder,
    typeDefinition: "FolderType",
    browseName: name,
    nodeId
  });
  return node;
}
function add_two_state_discrete_variables(addressSpace,parentFolder) {
  const DADiscreteTypeFolder = getDADiscreteTypeFolder(addressSpace,parentFolder);

  const twoStateDiscrete001 = addressSpace.addTwoStateDiscrete({
    organizedBy: DADiscreteTypeFolder,
    nodeId:  makeNodeId("TwoStateDiscrete001",namespaceIndex),
    browseName: "TwoStateDiscrete001",
    trueState: "Enabled",
    falseState:"Disabled"
  });


  const twoStateDiscrete002 = addressSpace.addTwoStateDiscrete({
    organizedBy: DADiscreteTypeFolder,
    nodeId:  makeNodeId("TwoStateDiscrete002",namespaceIndex),
    browseName: "TwoStateDiscrete002",
    trueState: "On",
    falseState:"Off",
    optionals:["TransitionTime","EffectiveDisplayName"]
  });

  const twoStateDiscrete003 = addressSpace.addTwoStateDiscrete({
    browseName: "twoStateDiscrete003",
    nodeId:  makeNodeId("TwoStateDiscrete003",namespaceIndex),
    optionals:["TransitionTime"],
    isTrueSubStateOf: twoStateDiscrete002
  });

  const twoStateDiscrete004 = addressSpace.addTwoStateDiscrete({
    organizedBy: DADiscreteTypeFolder,
    nodeId:  makeNodeId("TwoStateDiscrete004",namespaceIndex),
    browseName: "TwoStateDiscrete004",
    trueState: "InProgress",
    falseState:"Stopped"
  });

  const twoStateDiscrete005 = addressSpace.addTwoStateDiscrete({
    organizedBy: DADiscreteTypeFolder,
    nodeId:  makeNodeId("TwoStateDiscrete005",namespaceIndex),
    browseName: "TwoStateDiscrete005",
    trueState: "InProgress",
    falseState:"Stopped"
  });

  twoStateDiscrete001.setValueFromSource({ dataType: "Boolean", value: false });
  twoStateDiscrete002.setValueFromSource({ dataType: "Boolean", value: false });
  twoStateDiscrete003.setValueFromSource({ dataType: "Boolean", value: false });
  twoStateDiscrete004.setValueFromSource({ dataType: "Boolean", value: false });
  twoStateDiscrete005.setValueFromSource({ dataType: "Boolean", value: false });
}

function add_multi_state_discrete_variable(addressSpace,parentFolder) {
  const DADiscreteTypeFolder = getDADiscreteTypeFolder(addressSpace,parentFolder);

    // MultiStateDiscrete001
  const multiStateDiscrete001 = addressSpace.addMultiStateDiscrete({
    organizedBy: DADiscreteTypeFolder,
    nodeId:  makeNodeId("MultiStateDiscrete001",namespaceIndex),
    browseName: "MultiStateDiscrete001",
    enumStrings: ["Red","Orange","Green"],
    value: 1 // Orange
  });
  

    // MultiStateDiscrete002
  addressSpace.addMultiStateDiscrete({
    organizedBy: DADiscreteTypeFolder,
    nodeId:  makeNodeId("MultiStateDiscrete002",namespaceIndex),
    browseName: "MultiStateDiscrete002",
    enumStrings: ["Red","Orange","Green"],
    value: 1 // Orange
  });

    // MultiStateDiscrete002
  addressSpace.addMultiStateDiscrete({
    organizedBy: DADiscreteTypeFolder,
    nodeId:  makeNodeId("MultiStateDiscrete003",namespaceIndex),
    browseName: "MultiStateDiscrete003",
    enumStrings: ["Red","Orange","Green"],
    value: 1 // Orange
  });

    // MultiStateDiscrete002
  addressSpace.addMultiStateDiscrete({
    organizedBy: DADiscreteTypeFolder,
    nodeId:  makeNodeId("MultiStateDiscrete004",namespaceIndex),
    browseName: "MultiStateDiscrete004",
    enumStrings: ["Red","Orange","Green"],
    value: 1 // Orange
  });

    // MultiStateDiscrete002
  addressSpace.addMultiStateDiscrete({
    organizedBy: DADiscreteTypeFolder,
    nodeId:  makeNodeId("MultiStateDiscrete005",namespaceIndex),
    browseName: "MultiStateDiscrete005",
    enumStrings: ["Red","Orange","Green"],
    value: 1 // Orange
  });
}


function add_multi_state_value_discrete_variables(addressSpace, parentFolder) {
  const multistateValueDiscreteTypeFolder = addressSpace.addObject({
    organizedBy: parentFolder,
    typeDefinition: "FolderType",
    browseName: "Simulation_DA_MultiStateValueDiscreteType",
    nodeId: makeNodeId("Simulation_DA_MultiStateValueDiscreteType", namespaceIndex)
  });

  function _add_multi_state_variable(parentFolder, dataType) {
    const name = `${dataType}MultiStateValueDiscrete`;
    const nodeId = makeNodeId(name, namespaceIndex);

    const prop = addressSpace.addMultiStateValueDiscrete({
      organizedBy: parentFolder,
      browseName: name,
      nodeId,
      dataType,
      enumValues: { Red: 0xFF0000, Orange: 0xFF9933, Green: 0x00FF00, Blue: 0x0000FF },
      value: 0xFF0000 // Red
    });
  }

  const data = [
        { dataType: "Int16", value: -10 },
        { dataType: "UInt16", value: 10 },
        { dataType: "Int32", value: -100 },
        { dataType: "UInt32", value: 100 },
        { dataType: "Int64", value: [0, 0] },
        { dataType: "UInt64", value: [0, 0] },
        { dataType: "Byte", value: 120 },
        { dataType: "SByte", value: -123 }
  ];
  data.forEach((e) => {
    _add_multi_state_variable(multistateValueDiscreteTypeFolder, e.dataType);
  });
}

function add_ObjectWithMethod(addressSpace, parentFolder) {
  const namespaceIndex = 411;

  const myObject = addressSpace.addObject({
    nodeId: "ns=411;s=ObjectWithMethods",
    organizedBy: parentFolder,
    browseName: "ObjectWithMethods"
  });

  const methodNoArgs = addressSpace.addMethod(myObject, {
        // /xx modellingRule: "Mandatory",
    browseName: "MethodNoArgs",
    nodeId: makeNodeId("MethodNoArgs", namespaceIndex),
        //xx inputArguments: [],
        //xx outputArguments: []
  });
  assert(makeNodeId("MethodNoArgs", namespaceIndex).toString() === "ns=411;s=MethodNoArgs");
  assert(methodNoArgs.nodeId.toString() === "ns=411;s=MethodNoArgs");

  methodNoArgs.bindMethod((inputArguments, context, callback) => {
        // console.log(require("util").inspect(context).toString());
    const callMethodResult = {
      statusCode: StatusCodes.Good,
      outputArguments: []
    };
    callback(null, callMethodResult);
  });


  const methodIO = addressSpace.addMethod(myObject, {

        // /xx modellingRule: "Mandatory",

    browseName: "MethodIO",
    nodeId: makeNodeId("MethodIO", namespaceIndex),

    inputArguments: [
      {
        name: "ShutterLag",
        description: { text: "specifies the number of seconds to wait before the picture is taken " },
        dataType: DataType.UInt32
      }
    ],

    outputArguments: [
      {
        name: "Result",
        description: { text: "the result" },
        dataType: "Int32"
      }
    ]
  });
  methodIO.bindMethod((inputArguments, context, callback) => {
        // console.log(require("util").inspect(context).toString());
    const callMethodResult = {
      statusCode: StatusCodes.Good,
      outputArguments: [
        {
          dataType: DataType.Int32,
          value: 42
        }
      ]
    };
    callback(null, callMethodResult);
  });

  const methodI = addressSpace.addMethod(myObject, {

        // /xx modellingRule: "Mandatory",

    browseName: "MethodI",
    nodeId: makeNodeId("MethodI", namespaceIndex),

    inputArguments: [
      {
        name: "ShutterLag",
        description: { text: "specifies the number of seconds to wait before the picture is taken " },
        dataType: DataType.UInt32
      }
    ],
        //xx outputArguments: []

  });
  methodI.bindMethod((inputArguments, context, callback) => {
        // console.log(require("util").inspect(context).toString());
    const callMethodResult = {
      statusCode: StatusCodes.Good,
      outputArguments: []
    };
    callback(null, callMethodResult);
  });

  const methodO = addressSpace.addMethod(myObject, {

        // /xx modellingRule: "Mandatory",

    browseName: "MethodO",
    nodeId: makeNodeId("MethodO", namespaceIndex),

        // xx inputArguments: [],
    outputArguments: [
      {
        name: "Result",
        description: { text: "the result" },
        dataType: "Int32"
      }
    ]

  });
  methodO.bindMethod((inputArguments, context, callback) => {
        // console.log(require("util").inspect(context).toString());
    const callMethodResult = {
      statusCode: StatusCodes.Good,
      outputArguments: [
        {
          dataType: DataType.Int32,
          value: 42
        }
      ]
    };
    callback(null, callMethodResult);
  });
}


function add_eventGeneratorObject(addressSpace, parentFolder) {
  const myEvtType = addressSpace.addEventType({
    browseName: "MyEventType",
    subtypeOf: "BaseEventType" // should be implicit
  });

  const myObject = addressSpace.addObject({
    organizedBy: parentFolder,
    browseName: "EventGeneratorObject"
  });

  myObject.addReference({ referenceType: "AlwaysGeneratesEvent", nodeId: myEvtType });

  const method = addressSpace.addMethod(myObject, {
    browseName: "EventGeneratorMethod",
    inputArguments: [
      {
        name: "message",
        description: { text: "Event Message" },
        dataType: DataType.String
      },
      {
        name: "severity",
        description: { text: "Event Severity" },
        dataType: DataType.UInt32
      }
    ],
    outputArguments: []
  });

  method.bindMethod((inputArguments, context, callback) => {
        // xx console.log("In Event Generator Method");
        // xx console.log(this.toString());
        // xx console.log(context.object.toString());

        // xx console.log("inputArguments ", inputArguments[0].toString());

    const message = inputArguments[0].value || "Hello from Event Generator Object";
    const severity = inputArguments[1].value || 0;

    context.object.raiseEvent("MyEventType", {
      message: {
        dataType: DataType.LocalizedText,
        value: { text: message }
      },
      severity: {
        dataType: DataType.UInt32,
        value: severity
      }

    });
        // console.log(require("util").inspect(context).toString());
    const callMethodResult = {
      statusCode: StatusCodes.Good,
      outputArguments: []
    };
    callback(null, callMethodResult);
  });
}
export { add_eventGeneratorObject };

function add_enumeration_variable(addressSpace, parentFolder) {
  const myEnumType = addressSpace.addEnumerationType({
    browseName: "SimulationEnumerationType",
    enumeration: [
            { value: 1, displayName: "RUNNING" },
            { value: 2, displayName: "BLOCKED" },
            { value: 3, displayName: "IDLE" },
            { value: 4, displayName: "UNDER MAINTENANCE" }
    ]
  });

    // now instantiate a variable that have this type.
  const e = addressSpace.addVariable({
    organizedBy: parentFolder,
    propertyOf: addressSpace.rootFolder.objects.server.venderServerInfos,
    dataType: myEnumType,
    browseName: "RunningState",
    value: {
      get() {
        return new Variant({ dataType: DataType.Int32, value: 1 });
      }
    }
  });
}

function add_trigger_nodes(addressSpace, parentFolder) {
    // ns=411;s=TriggerNode01 ns=411;s=TriggerNode02
    // add 2 nodes that generate an event when ever they are written to.

  function _add_trigger_node(browseName, nodeId) {
    const triggerNode = addressSpace.addVariable({
      browseName,
      nodeId,
      organizedBy: parentFolder,
      dataType: "Double",
      typeDefinition: makeNodeId(68)
    });

    let value = 100.0;
    const getFunc = () => new Variant({
      dataType: DataType.Double,
      value
    });
    const setFunc = (variant) => {
      value = variant.value;

      const server = addressSpace.rootFolder.objects.server;

      server.raiseEvent("MyEventType", {
        message: {
          dataType: DataType.LocalizedText,
          value: { text: "Hello World" }
        },
        severity: {
          dataType: DataType.UInt32,
          value: 32
        }

      });
    };

    const options = {
      get: getFunc,
      set: setFunc
    };
    triggerNode.bindVariable(options);
  }

  const triggerNode01 = _add_trigger_node("TriggerNode01", "ns=411;s=TriggerNode01");

  const triggerNode02 = _add_trigger_node("TriggerNode02", "ns=411;s=TriggerNode02");
}

function add_sampleView(addressSpace) {
  addressSpace.addView({
    organizedBy: addressSpace.rootFolder.views,
    browseName: "SampleView",
    nodeId: "ns=411;s=SampleView"
  });
}
build_address_space_for_conformance_testing = (server_engine, options) => {
  options = options || {};
  options.mass_variable = options.mass_variable || false;

  assert(server_engine instanceof ServerEngine);
  assert(server_engine.addressSpace instanceof AddressSpace);
  const addressSpace = server_engine.addressSpace;
  console.log({addressSpace})
  assert(addressSpace instanceof AddressSpace);
  // const addressSpace = addressSpace;

  const objectsFolder = addressSpace.findNode("ObjectsFolder");

  const simulationFolder = addressSpace.addFolder(objectsFolder, "Simulation");

  add_access_right_variables(addressSpace, simulationFolder);

  const scalarFolder = addressSpace.addFolder(simulationFolder, {
    browseName: "Scalar",
    description: "Simply a parent folder"
  });

  add_scalar_static_variables(addressSpace, scalarFolder);
  if (options.mass_variables) {
    add_mass_variables(addressSpace, scalarFolder);
  }
  add_simulation_variables(server_engine, scalarFolder);

  add_very_large_array_variables(addressSpace, scalarFolder);

  add_analog_data_items(addressSpace, simulationFolder);

  add_path_10deep(addressSpace, simulationFolder);

  add_ObjectWithMethod(addressSpace, simulationFolder);

  add_eventGeneratorObject(addressSpace, simulationFolder);

  add_sampleView(addressSpace);

  add_enumeration_variable(addressSpace, simulationFolder);

  add_multi_state_value_discrete_variables(addressSpace, simulationFolder);

  add_two_state_discrete_variables(addressSpace,simulationFolder);

  add_multi_state_discrete_variable(addressSpace,simulationFolder);


  add_trigger_nodes(addressSpace, simulationFolder);
};
export { build_address_space_for_conformance_testing };

