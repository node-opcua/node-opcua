"use strict";
/**
 * @module services.translate-browse-path
 */
module.exports = {
    /**
     * @method makeBrowsePath
     */
    makeBrowsePath: require("./src/make_browse_path").makeBrowsePath,
    makeRelativePath: require("./src/make_relative_path").makeRelativePath,
    constructBrowsePathFromQualifiedName: require("./src/tools_browse_path").constructBrowsePathFromQualifiedName,


    RelativePathElement: require("./_generated_/_auto_generated_RelativePathElement").RelativePathElement,
    RelativePath:  require("./_generated_/_auto_generated_RelativePath").RelativePath,
    BrowsePath: require("./_generated_/_auto_generated_BrowsePath").BrowsePath,
    TranslateBrowsePathsToNodeIdsRequest:  require("./_generated_/_auto_generated_TranslateBrowsePathsToNodeIdsRequest").TranslateBrowsePathsToNodeIdsRequest,

    BrowsePathTarget: require("./_generated_/_auto_generated_BrowsePathTarget").BrowsePathTarget,
    BrowsePathResult: require("./_generated_/_auto_generated_BrowsePathResult").BrowsePathResult,
    TranslateBrowsePathsToNodeIdsResponse: require("./_generated_/_auto_generated_TranslateBrowsePathsToNodeIdsResponse").TranslateBrowsePathsToNodeIdsResponse,

};
