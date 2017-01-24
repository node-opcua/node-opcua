/**
 * @module xml2json

 * node -> see if https://github.com/isaacs/sax-js could be used instead
 */

let xml;

// use node-expat for speed if installed
// otherwise fall back to ersatz-node-expat
// a 100% javascript xml parser based on node-xml, but slower...
try {
  // eslint-disable-next-line
  xml = require("node-expat");
  console.log("FAST: using node-expat");
} catch (err) {
  // eslint-disable-next-line
  require("colors");
  const displayWarnings = false;
  if (displayWarnings) {
    console.warn("\n Warning : your current installation is using ersatz-node-expat a full javascript version of node-expat".yellow);
    console.warn("           This version is slightly slower than node-expat but doesn't require a C++ build during installation".yellow);
    console.warn("");
    console.warn("           You can get slightly better performance if you install node-expat".yellow);
    console.warn("              $ npm install node-expat".yellow.bold);
    console.warn("");
    console.warn("           Note: this may require some additional packages to be installed on your system".yellow);
  }
  // eslint-disable-next-line  
  xml = require("ersatz-node-expat");
}

const fs = require("fs");
const assert = require("better-assert");
const _ = require("underscore");

/**
 * @static
 * @private
 * @method _coerceParser
 * @param parser {map<ReaderState|options>}
 * @return {map}
 */
function _coerceParser(parser) {
  const _parser = {};
  const self = this;
  Object.keys(parser)
    .forEach((key) => {
      _parser[key] = parser[key] instanceof ReaderState 
        ? parser[key] 
        : new ReaderState(parser[key], self);
    });

  return _parser;
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
class ReaderState {
  constructor(options, engine) {
    // ensure options object has only expected properties
    const fields = _.keys(options);
    const invalid_fields = _.difference(fields, ["parser", "init", "finish", "startElement", "endElement"]);

      /* istanbul ignore next*/
    if (invalid_fields.length !== 0) {
      console.log(" Invalid fields detected :" , invalid_fields);

      throw new Error(`Invalid filed detected in ReaderState Parser !:${invalid_fields.join(" - ")}`);
    }
    this.engine = engine;
    this._init = options.init;
    this._finish = options.finish;
    this._startElement = options.startElement;
    this._endElement = options.endElement;

    this.parser = _coerceParser(options.parser || {});
  }
  /**
   * @method _on_init
   * @param name  {String} - the name of the element
   * @param attrs {Map<String,String>}
   * @protected
   */
  _on_init(name, attrs) {
    this.attrs = attrs;
    assert(this.attrs);
    if (this._init) {
      this._init(name, attrs);
    }
  }
  /**
   * @method _on_startElement
   * @param name  {String} - the name of the element
   * @param attrs {Map<String,String>}
   * @protected
   */
  _on_startElement(name, attrs) {
    this.chunks = [];
    this.text = "";
    if (Object.keys(this.parser).includes(name)) {
      this.engine._promote(this.parser[name], name, attrs);
    } else if (this._startElement) {
      this._startElement(name, attrs);
    }
  }
  /**
   * @method _on_endElement
   * @param name {String}
   * @protected
   */
  _on_endElement(name) {
    assert(this.attrs);

    this.chunks = this.chunks || [];

    if (name === this.name) {
      if (this._finish) {
        this.text = this.chunks.join("");
        this.chunks = [];
        this._finish();
      }
    }

    if (this.parent && this.parent._endElement) {
      this.parent._endElement(name);
    }
    if (name === this.name) {
          // this is the end
      this.engine._demote(this);
    }
  }
  /**
   * @method _on_text
   * @param text {String} the text found inside the element
   * @protected
   */
  _on_text(text) {
    this.chunks = this.chunks || [];
    const _text = text.trim();
    if (_text.length === 0) { return; }
    this.chunks.push(_text);
  }
}
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
class Xml2Json {
  constructor(options) {
    const state = new ReaderState(options, this);

    state.root = this;

    this.state_stack = [];
    this.current_state = null;
    this._promote(state);
  }
  _promote(new_state, name, attr) {
    new_state.name = name;
    new_state.parent = this.current_state;
    new_state.engine = this;

    this.state_stack.push(this.current_state);
    this.current_state = new_state;
    this.current_state._on_init(name, attr || {});
  }

  _demote(cur_state) {
    assert(this.current_state === cur_state);
    this.current_state = this.state_stack.pop();
  }

  _prepareParser(callback) {
    const self = this;
    const parser = new xml.Parser();

    parser.on("startElement", (name, attrs) => {
      self.current_state._on_startElement(name, attrs);
    });
    parser.on("endElement", (name) => {
      self.current_state._on_endElement(name);
    });
    parser.on("text", (text) => {
      self.current_state._on_text(text);
    });
    parser.on("close", () => {
      if (callback) {
        callback();
      }
    });
    return parser;
  }


  /**
   * @method parseString
   * @param xml_text {String} - the xml string to parse.
   * @param callback {Callback}
   * @async
   */
  parseString(xml_text, callback) {
    const parser = this._prepareParser(callback);
    parser.write(xml_text);
    parser.end();
  }

  /**
   * @method  parse
   * @async
   * @param xmlFile {String} - the name of the xml file to parse.
   * @param callback {Callback}
   */
  parse(xmlFile, callback) {
    console.log('reading data2', xmlFile);
    const self = this;
    const readWholeFile = true;
    if (readWholeFile) {
          // slightly faster but reaquire more memory ..
      fs.readFile(xmlFile,(err, data) => {
        console.log('file read', { data,err });
        if (!err) {
          const _data = data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF
            ? data.slice(3)
            : data;
          console.log('data isss', _data);
                
          const parser = self._prepareParser(callback);
                  // xx console.log(data.substr(0,1000).yellow);
                  // xx console.log(data.substr(data.length -1000,1000).cyan);
          parser.write(_data.toString());
          parser.end();
        } else {
          callback(err);
        }
      });
    } else {
      // eslint-disable-next-line
      const Bomstrip = require("bomstrip");
      const parser = self._prepareParser(callback);
      fs.createReadStream(xmlFile, { autoClose: true, encoding: "utf8" })
              .pipe(new Bomstrip())
              .pipe(parser);
    }
  }
}


exports.Xml2Json = Xml2Json;

