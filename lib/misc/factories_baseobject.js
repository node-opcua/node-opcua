/**
 * @module opcua.address_space.types
 */

import { BinaryStreamSizeCalculator } from "lib/misc/binaryStream";
import assert from "better-assert";
import _ from "underscore";
import { hexDump } from "lib/misc/utils";
import { getFactory } from "lib/misc/factories_factories";
import { _defaultTypeMap } from "lib/misc/factories_builtin_types";
import { get_base_schema } from "lib/misc/factories_schema_helpers";
import { isNullOrUndefined } from "lib/misc/utils";

/**
 * @class BaseUAObject
 * @constructor
 */
class BaseUAObject {
  /**
   * Encode the object to the binary stream.
   * @class BaseUAObject
   * @method encode
   * @param stream {BinaryStream}
   * @param options {BinaryStream}
   */
  encode() /* stream,options*/{

  }

  /**
   * Decode the object from the binary stream.
   * @class BaseUAObject
   * @method decode
   * @param stream {BinaryStream}
   * @param options {Object}
   */
  decode() /* stream,options*/{

  }

  /**
   * Calculate the required size to store this object in a binary stream.
   * @method binaryStoreSize
   * @return {Number}
   */
  binaryStoreSize(options) {
    const stream = new BinaryStreamSizeCalculator();
    this.encode(stream, options);
    return stream.length;
  }

  /**
   * @method toString
   * @return {String}
   */
  toString(...args) {
    const self = this;

    if (self._schema && self._schema.hasOwnProperty("toString")) {
      return self._schema.toString.apply(self, args);
    } 
    if (!self.explore) {
      console.log(require("util").inspect(self));
      return Object.prototype.toString.apply(self,args);
    }
    return self.explore(...args);
  }

  /**
   *
   * verify that all object attributes values are valid according to schema
   * @method isValid
   * @return {Boolean}
   */
  isValid() {
    assert(this._schema);
    if (this._schema.isValid) {
      return this._schema.isValid(this);
    } 
    return true;
  }

  /**
   * @method decode_debug
   *
   */
  decode_debug(stream, options) {
    const tracer = options.tracer;
    const schema = this._schema;

    tracer.trace("start", `${options.name}(${schema.name})`, stream.length, stream.length);
    const self = this;
    schema.fields.forEach((field) => {
      const value = self[field.name];

      if (field.isArray) {
        const cursor_before = stream.length;
        let nb = stream.readUInt32();
        if (nb === 0xFFFFFFFF) {
          nb = 0;
        }
        options.name = field.name + [];

        tracer.trace("start_array", field.name, nb, cursor_before, stream.length);
        for (let i = 0; i < nb; i++) {
          tracer.trace("start_element", field.name, i);
          options.name = `element #${i}`;

          _decode_member_(value, field, stream, options);

          tracer.trace("end_element", field.name, i);
        }
        tracer.trace("end_array", field.name, stream.length - 4);
      } else {
        options.name = field.name;
        _decode_member_(value, field, stream, options);
      }
    });

    tracer.trace("end", schema.name, stream.length, stream.length);
  }

  explore(...args) {
    const self = this;
    const data = { padding: " ", lines: [] };
    data.lines.push(`{${(` /*${this._schema.name}*/`).cyan}`);
    apply_on_all_schema_fields(self, self._schema, data, _exploreObject,args);
    data.lines.push("};");
    return data.lines.join("\n");
  }

  toJSON(...args) {
    const self = this;

    assert(this._schema);
    if (this._schema.toJSON) {
      return this._schema.toJSON.apply(this, args);
    } 
          // xx return Object.toJSON.apply(this,arguments);
    assert(self._schema);
    const schema = self._schema;
    const options = {};
    _visit_schema_chain(self, schema, options, _JSONify);
    return options;
  }

  clone() /* options,optionalfilter,extraInfo*/{
    const self = this;

    const params = {};
    function construct_param(schema, options) {
          /* jshint validthis: true */
      const self = this;

      schema.fields.forEach((field) => {
        const f = self[field.name];
        if (f === null || f === undefined) {
          return;
        }
        if (field.isArray) {
          options[field.name] = self[field.name];
        } else {
          options[field.name] = self[field.name];
        }
      });
    }
    construct_param.call(this,self._schema,params);

    return new self.constructor(params);
  }
}


function _decode_member_(value, field, stream, options) {
  const tracer = options.tracer;
  const cursor_before = stream.length;
  const fieldType = field.fieldType;

  if (field.category === "basic") {
    value = field.schema.decode(stream);
    tracer.trace("member", options.name, value, cursor_before, stream.length, fieldType);
  } else if (field.category === "enumeration") {
    value = field.schema.decode(stream);
    tracer.trace("member", options.name, value, cursor_before, stream.length, fieldType);
  } else {
    assert(field.category === "complex");
    assert(_.isFunction(field.schema));
    const Constructor = field.schema;
    value = new Constructor();
    value.decode_debug(stream, options);
  }
  return value;
}


function r(str) {
  return (`${str}                                `).substr(0, 30);
}

function apply_on_all_schema_fields(self, schema, data, callback , args) {
  assert(schema);
  const fields = schema.fields;
  let field;
  let i;
  const n = fields.length;
  for (i = 0; i < n; i++) {
    field = fields[i];
    callback(self, field, data , args);
  }
}

const _nb_elements = process.env.ARRAYLENGTH ? parseInt(process.env.ARRAYLENGTH) : 10;

function _array_ellypsis(value,field) {
  if (!value) {
    return "null []";
  } 
  if (value.length === 0) {
    return "[ /* empty*/ ]";
  }
  assert(_.isArray(value));
  const v = [];
  const m = Math.min(_nb_elements, value.length);
  for (let i = 0; i < m; i++) {
    const element = value[i];
    v.push(!isNullOrUndefined(element) ? element.toString() : null);
  }
  return `[ ${v.join(",")}${value.length > 10 ? " ... " : ""}] (l=${value.length})`;
}


const _exploreObject = (self, field, data, args) => {
  if (!self) {
    return;
  }
  assert(self);

  let fieldType = field.fieldType;
  const fieldName = field.name;
  const category = field.category;

  const padding = data.padding;

  let value = self[fieldName];

  let str;

  const fieldName_f = r(padding + fieldName, 30).yellow;
  const fieldType_f = (`/* ${r(fieldType, 10)}${field.isArray ? "[]" : "  "} */`).cyan;


    // compact version of very usual objects
  if (fieldType === "QualifiedName" && !field.isArray && value) {
    value = value.toString() || "<null>";
    str = `${fieldName_f} ${fieldType_f}: ${value.toString().green}`;
    data.lines.push(str);
    return;
  }
  if (fieldType === "LocalizedText" && !field.isArray && value) {
    value = value.toString() || "<null>";
    str = `${fieldName_f} ${fieldType_f}: ${value.toString().green}`;
    data.lines.push(str);
    return;
  }


  const _dump_simple_value = (self, field, data, value, fieldType) => {
    let str = "";
    if (value instanceof Buffer) {
      const _hexDump = hexDump(value);
      data.lines.push(`${fieldName_f} ${fieldType_f}`);
      data.lines.push(`BUFFER{${_hexDump}}`);
    } else {
      if (field.isArray) {
        str = `${fieldName_f} ${fieldType_f}: ${_array_ellypsis(value,field)}`;
      } else {
        if (fieldType === "IntegerId" || fieldType === "UInt32") {
          value = `${value}               0x${value.toString(16)}`;
        } else if (fieldType === "DateTime" || fieldType === "UtcTime") {
          value = (value && value.toISOString) ? value.toISOString() : value;
        } else if (typeof value === "object" && value !== null) {
          value = value.toString(...args);
        }
        str = `${fieldName_f} ${fieldType_f}: ${(value === null) ? "null".blue.bold : value.toString()}`;
      }
      data.lines.push(str);
    }
  };

  switch (category) {

    case "enumeration":

      str = `${fieldName_f} ${fieldType_f}: ${value.key} ( ${value.value})`;
      data.lines.push(str);

      break;

    case "basic":
      _dump_simple_value(self, field, data, value, fieldType);
      break;

    case "complex":
      if (field.subtype) {
                // this is a synonymous
        fieldType = field.subType;
        _dump_simple_value(self, field, data, value, fieldType);
      } else {
        const _new_desc = getFactory(fieldType).prototype._schema;

        if (field.isArray) {
          if (value === null) {
            data.lines.push(`${fieldName_f} ${fieldType_f}: null []`);
          } else if (value.length === 0) {
            data.lines.push(`${fieldName_f} ${fieldType_f}: [ /* empty */ ]`);
          } else {
            data.lines.push(`${fieldName_f} ${fieldType_f}: [`);

            let i = 0;

            const m = Math.min(_nb_elements, value.length);

            for (i = 0; i < m; i++) {
              const element = value[i];
              data.lines.push(`${padding}  { ${(`/*${i}*/`).cyan}`);

              var data1 = { padding: `${padding}    `, lines: [] };
              apply_on_all_schema_fields(element, _new_desc, data1, _exploreObject , args);
              data.lines = data.lines.concat(data1.lines);

              data.lines.push(`${padding}  }${(i === value.length - 1) ? "" : ","}`);
            }
            if (m < value.length) {
              data.lines.push(`${padding} ..... ( ${value.length} elements )`);
            }
            data.lines.push(`${padding}]`);
          }
        } else {
          data.lines.push(`${fieldName_f} ${fieldType_f}: {`);

          data1 = { padding: `${padding}  `, lines: [] };
          apply_on_all_schema_fields(value, _new_desc, data1, _exploreObject,args);
          data.lines = data.lines.concat(data1.lines);

          data.lines.push(`${padding}}`);
        }
      }

      break;
    default:
      throw new Error("internal error: unknown kind_of_field");
  }
};


function _visit_schema_chain(self, schema, options, func, extra_data) {
  assert(_.isFunction(func));

    // apply also construct to baseType schema first
  const base_schema = get_base_schema(schema);
  if (base_schema) {
    _visit_schema_chain(self, base_schema, options, func, extra_data);
  }
  func.call(self, schema, options, extra_data);
}

function _JSONify(schema, options) {
    /* jshint validthis: true */
  const self = this;
  schema.fields.forEach((field) => {
    const f = self[field.name];
    if (f === null || f === undefined) {
      return;
    }

    const t = _defaultTypeMap[field.fieldType];

    function jsonify(value) {
      if (_.isFunction(field.toJSON)) {
        return field.toJSON(value);
      } else if (t && t.toJSON) {
        return t.toJSON(value);
      } else if (value.toJSON) {
        return value.toJSON();
      } 
      return f;
    }

    if (field.isArray) {
      options[field.name] = f.map(jsonify);
    } else {
      options[field.name] = jsonify(f);
    }
  });
}


export { BaseUAObject };
