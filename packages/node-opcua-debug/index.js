
module.exports = {

    // --------------------
    checkDebugFlag: require("./src/make_debug_log").checkDebugFlag,
    make_debugLog: require("./src/make_debug_log").make_debugLog,
    setDebugFlag: require("./src/make_debug_log").setDebugFlag,

    // --------------------
    redirectToFile: require("./src/redirect_to_file").redirectToFile,

    hexDump: require("./src/hexDump").hexDump,

    dump: require("./src/dump_if").dump,
    dumpIf: require("./src/dump_if").dumpIf,

    makebuffer_from_trace : require("./src/makebuffer_from_trace").makebuffer_from_trace,
    inlineText: require("./src/makebuffer_from_trace").inlineText,

    getTempFilename: require("./src/get_temp_filename").getTempFilename,

    display_trace_from_this_projet_only: require("./src/display_trace").display_trace_from_this_projet_only,

    trace_from_this_projet_only: require("./src/display_trace").trace_from_this_projet_only,

};
