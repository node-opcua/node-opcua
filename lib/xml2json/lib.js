
var util = require('util');
var xml = require("node-expat");
var fs = require("fs");
var assert = require("better-assert");


/**
 *
 * @param options_or_reader_state {*|ReaderState}
 * @returns {ReaderState}
 */
function coerceReaderState(options_or_reader_state) {

    if (!(options_or_reader_state instanceof ReaderState)) {
        return new ReaderState(options_or_reader_state);
    }
    var reader = options_or_reader_state;
    for( var name in reader.parser) {
        if (reader.parser.hasOwnProperty(name)) {
            reader.parser[name] = coerceReaderState(reader.parser[name]);
        }
    }
    return reader;
}

/**
 *
 * @param options
 * @constructor
 */
function ReaderState(options){
    this.parser= options.parser || {};
    this._init  = options.init;
    this._finish  = options.finish;
    this._startElement = options.startElement;
    this._endElement = options.endElement;

    var reader = this;
    for( var name in reader.parser) {
        if (reader.parser.hasOwnProperty(name)) {
            reader.parser[name] = coerceReaderState(reader.parser[name]);
        }
    }
}

ReaderState.prototype.init= function(name,attrs) {
    this.attrs = attrs;
    assert(this.attrs);
    if (this._init) {
        this._init(name,attrs);
    }
};

ReaderState.prototype.startElement= function(name,attrs) {

    if (this.parser.hasOwnProperty(name)) {
        this.engine._promote(this.parser[name],name,attrs);
    } else  if (this._startElement) {
        this._startElement(name,attrs);
    }
};
ReaderState.prototype.endElement= function(name) {
    assert(this.attrs);
    if (this._endElement) {
        this._endElement(name);
    }
    if (name==this.name) {
        if (this._finish) {
            this._finish();
        }
        // this is the end
        this.engine._demote(this);
    }
};

ReaderState.prototype.onText = function(text){
    this.text = text;
};


/**
 *
 * @param state
 * @constructor
 */
function Xml2Json(state) {

    state = coerceReaderState(state);

    this.state_stack = [];
    this.current_state = null;
    this._promote(state);
}

Xml2Json.prototype._promote = function (new_state,name,attr) {
    attr = attr || {};
    new_state.name = name;
    new_state.parent = this.current_state;
    new_state.engine = this;

    this.state_stack.push(this.current_state);
    this.current_state = new_state;
    this.current_state.init(name,attr);
};

Xml2Json.prototype._demote = function(cur_state) {
    assert(this.current_state===cur_state);
    this.current_state = this.state_stack.pop();
};

Xml2Json.prototype._prepareParser = function() {
    var self = this;
    var parser = new xml.Parser();
    parser.on('startElement',function(name,attrs)   {
        self.current_state.startElement(name,attrs);
    });
    parser.on('endElement',  function(name)         {
        self.current_state.endElement(name);
    });
    parser.on('text',        function(text)         {
        self.current_state.onText(text);
    });
    return parser;
};


Xml2Json.prototype.parseString = function(xml_text) {
    var parser = this._prepareParser();
    parser.write(xml_text);
};


Xml2Json.prototype.parse = function(xmlFile) {
    var parser = this._prepareParser();
    parser.write(fs.readFileSync(xmlFile));
};


exports.Xml2Json = Xml2Json;
