function trace_from_this_projet_only(err) {

    var str = [];
    str.push(" display_trace_from_this_project_only = ".cyan.bold);
    if (err) {
        str.push(err.message);
    }
    err = err || new Error();
    var stack = err.stack;
    if (stack) {
        stack = (stack.split("\n").filter(function (el) {
            return el.match(/node-opcua/) && !el.match(/node_modules/);
        }));
        //xx stack.shift();
        str.push(stack.join("\n").yellow);
    } else {
        str.push(" NO STACK TO TRACE !!!!".red);
    }
    return str.join("\n");
}

exports.trace_from_this_projet_only = trace_from_this_projet_only;

function display_trace_from_this_projet_only(err) {
    console.log(trace_from_this_projet_only(err));
}
exports.display_trace_from_this_projet_only = display_trace_from_this_projet_only;
