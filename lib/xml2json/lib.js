/* global ReaderState */
"use strict";
/**
 * @module xml2json
 */

var xml;

// use node-expat for speed if installed
// otherwise fall back to ersatz-node-expat , a 100% javascript xml parser based on node-xml, but slower...
try {
    xml = require("node-expat");
    console.log("FAST: using node-expat");
}
catch (err) {
    require("colors");
    console.warn("\n Warning : your current installation is using ersatz-node-expat a full javascript version of node-expat".yellow);
    console.warn("           This version is slightly slower than node-expat but doesn't require a C++ build during installation".yellow);
    console.warn("");
    console.warn("           You can get slightly better performance if you install node-expat".yellow);
    console.warn("              $ npm install node-expat".yellow.bold);
    console.warn("");
    console.warn("           Note: this may require some additional packages to be installed on your system".yellow);

    xml = require("ersatz-node-expat");
}

var fs = require("fs");
var assert = require("better-assert");
var _ = require("underscore");

/**
 * @static
 * @private
 * @method _coerceParser
 * @param parser {map<ReaderState|options>}
 * @return {map}
 */
function _coerceParser(parser) {

    for (var name in parser) {
        if (parser.hasOwnProperty(name)) {
            if (!(parser[name] instanceof ReaderState)) {
                parser[name] = new ReaderState(parser[name]);
            }
        }
    }
    return parser;
}

/**
 * @class ReaderState
 * @private
 * @param options
 * @param [options.parser=null]  {map<ReaderState|options}}
 * @param [options.init|null]    {Function}
 * @param [options.finish]       {Function}
 * @param [options.startElement] {Function}
 * @param [options.endElement]   {Function}
 * @constructor
 */
function ReaderState(options) {

    // ensure options object has only expected properties
    options.parser = options.parser || {};
    var fields = _.keys(options);
    var invalid_fields = _.difference(fields, ["parser", "init", "finish", "startElement", "endElement"]);
    assert(invalid_fields.length === 0);

    this._init = options.init;
    this._finish = options.finish;
    this._startElement = options.startElement;
    this._endElement = options.endElement;

    this.parser = _coerceParser(options.parser);
}

/**
 * @method _on_init
 * @param name  {String} - the name of the element
 * @param attrs {Map<String,String>}
 * @protected
 */
ReaderState.prototype._on_init = function (name, attrs) {
    this.attrs = attrs;
    assert(this.attrs);
    if (this._init) {
        this._init(name, attrs);
    }
};

/**
 * @method _on_startElement
 * @param name  {String} - the name of the element
 * @param attrs {Map<String,String>}
 * @protected
 */
ReaderState.prototype._on_startElement = function (name, attrs) {

    if (this.parser.hasOwnProperty(name)) {
        this.engine._promote(this.parser[name], name, attrs);
    } else if (this._startElement) {
        this._startElement(name, attrs);
    }
};

/**
 * @method _on_endElement
 * @param name {String}
 * @protected
 */
ReaderState.prototype._on_endElement = function (name) {
    assert(this.attrs);
    //xx if (this._endElement) { this._endElement(name); }
    if (this.parent && this.parent._endElement) {
        this.parent._endElement(name);
    }
    if (name === this.name) {
        if (this._finish) {
            this._finish();
        }
        // this is the end
        this.engine._demote(this);
    }
};

/**
 * @method _on_text
 * @param text {String} the text found inside the element
 * @protected
 */
ReaderState.prototype._on_text = function (text) {
    this.text = text;
};


/**
 * @class Xml2Json
 * @param options {ReaderState} - the state machine as  a ReaderState node.
 * @param [options.parser=null]  {ReaderState}
 * @param [options.init|null]    {Function}
 * @param [options.finish]       {Function}
 * @param [options.startElement] {Function}
 * @param [options.endElement]   {Function}
 * @constructor
 *
 * @example

 var parser = new Xml2Json({
        parser: {
            'person': {
                init: function(name,attrs) {
                    this.parent.root.obj = {};
                    this.obj =  this.parent.root.obj;
                    this.obj['name'] = attrs['name'];
                },
                parser: {
                    'address': {
                        finish: function(){
                            this.parent.obj['address'] = this.text;
                        }
                    }
                }
            }
        }
    });

 var xml_string =  "<employees>" +
 "   <person name='John'>" +
 "     <address>Paris</address>" +
 "   </person>" +
 "</employees>";

 parser.parseString(xml_string, function() {
        parser.obj.should.eql({name: 'John',address: 'Paris'});
        done();
    });
 */
function Xml2Json(options) {

    var state = new ReaderState(options);

    state.root = this;

    this.state_stack = [];
    this.current_state = null;
    this._promote(state);
}

Xml2Json.prototype._promote = function (new_state, name, attr) {
    attr = attr || {};
    new_state.name = name;
    new_state.parent = this.current_state;
    new_state.engine = this;

    this.state_stack.push(this.current_state);
    this.current_state = new_state;
    this.current_state._on_init(name, attr);
};

Xml2Json.prototype._demote = function (cur_state) {
    assert(this.current_state === cur_state);
    this.current_state = this.state_stack.pop();
};

Xml2Json.prototype._prepareParser = function (callback) {

    var self = this;
    var parser = new xml.Parser();

    parser.on("startElement", function (name, attrs) {
        self.current_state._on_startElement(name, attrs);
    });
    parser.on("endElement", function (name) {
        self.current_state._on_endElement(name);
    });
    parser.on("text", function (text) {
        self.current_state._on_text(text);
    });
    parser.on("close", function () {
        if (callback) {
            callback();
        }
    });
    return parser;
};


/**
 * @method parseString
 * @param xml_text {String} - the xml string to parse.
 * @param callback {Callback}
 * @async
 */
Xml2Json.prototype.parseString = function (xml_text, callback) {
    var parser = this._prepareParser(callback);
    parser.write(xml_text);
    parser.end();

};

/**
 * @method  parse
 * @async
 * @param xmlFile {String} - the name of the xml file to parse.
 * @param callback {Callback}
 */
Xml2Json.prototype.parse = function (xmlFile, callback) {
    var parser = this._prepareParser(callback);
    var Bomstrip = require("bomstrip");
    fs.createReadStream(xmlFile, {autoClose: true, encoding: "utf8"})
        .pipe(new Bomstrip())
        .pipe(parser);
};


exports.Xml2Json = Xml2Json;
