"use strict";
/**
 * @module opcua.address_space.types
 */
const assert = require("node-opcua-assert").assert;
const _ = require("underscore");
const util = require("util");

const BinaryStreamSizeCalculator = require("node-opcua-binary-stream").BinaryStreamSizeCalculator;
const hexDump = require("node-opcua-debug").hexDump;
const utils = require("node-opcua-utils");


const getFactory = require("./factories_factories").getFactory;
const _defaultTypeMap = require("./factories_builtin_types")._defaultTypeMap;
const get_base_schema = require("./factories_schema_helpers").get_base_schema;


/**
 * @class BaseUAObject
 * @constructor
 */
function BaseUAObject() {

}

/**
 * Encode the object to the binary stream.
 * @class BaseUAObject
 * @method encode
 * @param stream {BinaryStream}
 */
BaseUAObject.prototype.encode = function (stream) {
    assert(stream !== null);
};

/**
 * Decode the object from the binary stream.
 * @class BaseUAObject
 * @method decode
 * @param stream {BinaryStream}
 */
BaseUAObject.prototype.decode = function (stream) {
    assert(stream !== null);
};

/**
 * Calculate the required size to store this object in a binary stream.
 * @method binaryStoreSize
 * @return {Number}
 */
BaseUAObject.prototype.binaryStoreSize = function () {
    const stream = new BinaryStreamSizeCalculator();
    this.encode(stream);
    return stream.length;
};

/**
 * @method toString
 * @return {String}
 */
BaseUAObject.prototype.toString = function () {

    const self = this;

    if (self._schema && self._schema.hasOwnProperty("toString")) {

        return self._schema.toString.apply(self, arguments);

    } else {

        if (!self.explore) {
            console.log(util.inspect(self));
            return Object.prototype.toString.apply(self,arguments);
        }

        return self.explore.apply(self,arguments);
    }
};


/**
 *
 * verify that all object attributes values are valid according to schema
 * @method isValid
 * @return {Boolean}
 */
BaseUAObject.prototype.isValid = function () {
    assert(this._schema);
    if (this._schema.isValid) {
        return this._schema.isValid(this);
    } else {
        return true;
    }
};


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

/**
 * @method decode_debug
 *
 */
BaseUAObject.prototype.decode_debug = function (stream, options) {

    const tracer = options.tracer;
    const schema = this._schema;

    tracer.trace("start", options.name + "(" + schema.name + ")", stream.length, stream.length);
    const self = this;

    for (const field of schema.fields)  {

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
                options.name = "element #" + i;

                _decode_member_(value, field, stream, options);

                tracer.trace("end_element", field.name, i);

            }
            tracer.trace("end_array", field.name, stream.length - 4);
        } else {

            options.name = field.name;
            _decode_member_(value, field, stream, options);

        }

    }

    tracer.trace("end", schema.name, stream.length, stream.length);
};


function r(str) {
    return (str + "                                ").substr(0, 30);
}

function apply_on_all_schema_fields(self, schema, data, functor , args) {
    assert(schema);
    const fields = schema.fields;
    let field;
    let i;
    const n = fields.length;
    for (i = 0; i < n; i++) {
        field = fields[i];
        functor(self, field, data , args);
    }
}

const _nb_elements = process.env.ARRAYLENGTH ? parseInt(process.env.ARRAYLENGTH) : 10;

function _array_ellypsis(value) {


    if (!value) {
        return "null []";
    } else {
        if (value.length===0) {
            return "[ /* empty*/ ]";
        }
        assert(_.isArray(value));
        const v = [];
        const m = Math.min(_nb_elements, value.length);
        for (let i = 0; i < m; i++) {
            const element = value[i];
            v.push( !utils.isNullOrUndefined(element) ? element.toString() : null);
        }
        return "[ " + v.join(",") + ( value.length > 10 ? " ... " : "") + "] (l=" + value.length + ")";
    }
}


function _exploreObject(self, field, data, args) {

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
    const fieldType_f = ("/* " + r(fieldType, 10) + ( field.isArray ? "[]" : "  ") + " */").cyan;


    // compact version of very usual objects
    if (fieldType === "QualifiedName" && !field.isArray && value) {

        value = value.toString() || "<null>";
        str = fieldName_f + " " + fieldType_f + ": " + value.toString().green;
        data.lines.push(str);
        return;
    }
    if (fieldType === "LocalizedText" && !field.isArray && value) {
        value = value.toString() || "<null>";
        str = fieldName_f + " " + fieldType_f + ": " + value.toString().green;
        data.lines.push(str);
        return;
    }


    function _dump_simple_value(self, field, data, value, fieldType) {

        let str = "";
        if (value instanceof Buffer) {

            const _hexDump = hexDump(value);
            data.lines.push(fieldName_f + " " + fieldType_f);
            data.lines.push("BUFFER{" + _hexDump + "}");

        } else {


            if (field.isArray) {

                str = fieldName_f + " " + fieldType_f + ": " + _array_ellypsis(value,field);

            } else {
                if (fieldType === "IntegerId" || fieldType === "UInt32") {

                    value = "" + value + "               0x" + value.toString(16);

                } else if (fieldType === "DateTime" || fieldType === "UtcTime") {
                    value = (value && value.toISOString) ? value.toISOString() : value;
                } else if (typeof value === "object" && value !== null && value !== undefined) {
                    value = value.toString.apply(value,args);
                }
                str = fieldName_f + " " + fieldType_f + ": " + ((value === null || value === undefined) ? "null".blue.bold : value.toString());
            }
            data.lines.push(str);
        }

    }

    function _dump_complex_value(self,field,data,value,fieldType) {
        if (field.subtype) {

            // this is a synonymous
            fieldType = field.subType;
            _dump_simple_value(self, field, data, value, fieldType);

        } else {

            field.fieldTypeConstructor = field.fieldTypeConstructor ||  getFactory(fieldType);
            const fieldTypeConstructor = field.fieldTypeConstructor;

            const _new_desc = fieldTypeConstructor.prototype._schema;

            if (field.isArray) {
                if (value === null) {
                    data.lines.push(fieldName_f + " " + fieldType_f + ": null []");
                } else if (value.length === 0) {
                    data.lines.push(fieldName_f + " " + fieldType_f + ": [ /* empty */ ]");
                } else {
                    data.lines.push(fieldName_f + " " + fieldType_f + ": [");

                    const m = Math.min(_nb_elements, value.length);

                    for (let i = 0; i < m; i++) {
                        const element = value[i];
                        data.lines.push(padding + "  { " + ("/*" + i + "*/").cyan);

                        const data1 = {padding: padding + "    ", lines: []};
                        apply_on_all_schema_fields(element, _new_desc, data1, _exploreObject , args);
                        data.lines = data.lines.concat(data1.lines);

                        data.lines.push(padding + "  }" + ((i === value.length - 1) ? "" : ","));
                    }
                    if (m < value.length) {
                        data.lines.push(padding + " ..... ( " + value.length + " elements )");
                    }
                    data.lines.push(padding + "]");

                }

            } else {

                data.lines.push(fieldName_f + " " + fieldType_f + ": {");

                const data1 = {padding: padding + "  ", lines: []};
                apply_on_all_schema_fields(value, _new_desc, data1, _exploreObject,args);
                data.lines = data.lines.concat(data1.lines);

                data.lines.push(padding + "}");
            }
        }
    }

    switch (category) {
        case "enumeration":
            str = fieldName_f + " " + fieldType_f + ": " + value.key + " ( " + value.value + ")";
            data.lines.push(str);
            break;
        case "basic":
            _dump_simple_value(self, field, data, value, fieldType);
            break;
        case "complex":
            _dump_complex_value(self, field, data, value, fieldType);
            break;
        default:
            throw new Error("internal error: unknown kind_of_field " + category);
    }
}


BaseUAObject.prototype.explore = function () {

    const self = this;
    const data = {padding: " ", lines: []};
    data.lines.push("{" + (" /*" + this._schema.name + "*/").cyan);
    apply_on_all_schema_fields(self, self._schema, data, _exploreObject,arguments);
    data.lines.push("};");
    return data.lines.join("\n");
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

function jsonify(t,f,field,value) {

    if (_.isFunction(field.toJSON)) {
        return field.toJSON(value);
    } else if (t && t.toJSON) {
        return t.toJSON(value);
    } else if (value.toJSON) {
        return value.toJSON();
    } else {
        return f;
    }

}

function _JSONify(schema, options) {

    /* jshint validthis: true */
    const self = this;
    for (const field of schema.fields) {
        const f = self[field.name];
        if (f === null || f === undefined) {
            continue;
        }

        const t = _defaultTypeMap[field.fieldType];

        if (field.isArray) {
            options[field.name] = f.map(value => jsonify(t,f,field,value));
        } else {
            options[field.name] = jsonify(t,f,field,f);
        }
    }
}

BaseUAObject.prototype.toJSON = function () {

    const self = this;

    assert(this._schema);
    if (this._schema.toJSON) {
        return this._schema.toJSON.apply(this, arguments);
    } else {
        //xx return Object.toJSON.apply(this,arguments);
        assert(self._schema);
        const schema = self._schema;
        const options = {};
        _visit_schema_chain(self, schema, options, _JSONify);
        return options;
    }
};

BaseUAObject.prototype.clone = function (/*options,optionalfilter,extraInfo*/) {
    const self = this;

    const params = {};
    function construct_param(schema, options) {
        /* jshint validthis: true */
        const self = this;

        for (const field of schema.fields) {

            const f = self[field.name];
            if (f === null || f === undefined) {
                continue;
            }
            if (field.isArray) {
                options[field.name] = self[field.name];
            } else {
                options[field.name] = self[field.name];
            }
        }
    }
    construct_param.call(this,self._schema,params);

    return new self.constructor(params);

};


exports.BaseUAObject = BaseUAObject;
