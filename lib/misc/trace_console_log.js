/* global console */
// a simple client that is design to crash in the middle of a connection
// once a item has been monitored
function trace_console_log() {
    const log1 = global.console.log;
    global.console.log = function () {
        const t = (new Error()).stack.split("\n")[2];
        if (t.match(/opcua/) && !t.match(/node_modules/)) {
            log1.call(console, t.cyan);
        }
        log1.apply(console, arguments);
    };
}
trace_console_log();

