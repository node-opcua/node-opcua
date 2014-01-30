
var BinaryStream = require("../lib/nodeopcua").BinaryStream;
var ec = require("../lib/encode_decode");
var factories = require("../lib/factories");
var buffer_ellipsis =require("../lib/utils").buffer_ellipsis;
var color = require("colors");
var hexy = require("hexy");

var spaces = "                                                                                                                   ";
function packet_analyzer(buffer,id)
{

  var info  = {

  };
  var cur_node = info;
  var queue = [];
  var padding = 0;

  var pad = function() { return "         ".substr(0,padding); }

  var options = {
        tracer: {
            trace: function(operation,name,value,start,end)  {

                str  = "";
                str2 = "";
                if (operation === "start") {

                    cur_node[name] = {};
                    queue.push(cur_node);
                    cur_node = cur_node[name];
                    cur_node.buffer_start = start;
                    str =  pad() +  ""+ name;
                    padding += 2;

                } else  if (operation === "end") {
                    cur_node.buffer_end = end;
                    cur_node = queue.pop();
                    padding -= 2;

                } else if (operation == "start_array") {
                    cur_node[name] = {};
                    queue.push(cur_node);
                    cur_node = cur_node[name];
                    cur_node.buffer_start = start;
                    str = pad() + "." + name + " (length = "+ value + ") "+  "[";

                    padding += 2;

                } else if (operation == "end_array") {
                    cur_node.buffer_end = end;
                    cur_node = queue.pop();
                    padding -= 2;
                    str = pad() + "]";

                } else if (operation == "member") {
                    // console.log("!!!!!!!!!!!!!!!!!!!!!!!!",start,end);
                    var n = 0;
                    strBuf = "";
                    n= end -start;
                    var b = buffer.slice(start,end);

                    strBuf = buffer_ellipsis(b);

                    function f(n,width) {
                        var s = "" + n
                        return (s+  "      ").substr(0,Math.max(s.length,width));
                    }
                    str  = (pad() + "." + name + " :" + spaces).substr(0,35) ;
                    console.log(str);

                    var hexDump = "";
                    if (value instanceof Buffer) {

                        hexDump = hexy.hexy(value, { width: 32 });
                        value = "<BUFFER>"
                        console.log(hexDump);
                    }
                    str  =  pad() + ("     "+value).green ;

                    str2 = "s:".cyan+ f(start,4) +" e:".cyan + f(end,4) + " n:".cyan+ f(n,4) + " " + strBuf.yellow;
                    str = (str + spaces).substr(0,80) + str2;

                }
                console.log(str);
            }
        }
  };

  // read nodeId

  var stream = new BinaryStream(buffer);

  var objMessage = undefined;
  if (!id) {
      id = ec.decodeExpandedNodeId(stream);
  } else if (typeof id === "object" && id._description) {
      objMessage = id;
  }

  objMessage = objMessage || factories.constructObject(id);

  options.name = "message";
  objMessage.decode(stream,options);

  //  console.log(JSON.stringify(objMessage,null," "));

}


exports.packet_analyzer = packet_analyzer;
