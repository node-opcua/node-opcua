e="^assert$|^crypto$|^util$|^events$|^fs$|^path$|^os$|^net$|^_generated_"

# script use to extract dependencies from package.json
extract_dep="var a=JSON.parse(fs.readFileSync('package.json','ascii'));console.log(Object.keys(a.dependencies||{}).join('\n'));"
extract_devdep="var a=JSON.parse(fs.readFileSync('package.json','ascii'));console.log(Object.keys(a.devDependencies||{}).join('\n'));"


r1="s/.*(require\(\"([^/]*)(\/.*)?\"\)).*/\2/g"

# extract all requires packages used in production from source file
prod_require=`egrep -s -e "require\(\"[^\.].*\)" -R src _generated_ index.js schemas bin | sed -E "$r1" | sort | uniq  | grep -Ev $e`
# extract all require packages declared in production from dependencies in package.json
prod_json=$(node -e "$extract_dep")

# extract all node-opcua related requires in production code
prod_require_l=`egrep -s -e "require\(\"node-opcua.*\)" -R src _generated_ index.js schemas bin | sed -E "$r1" | sort | uniq  | grep -Ev $e`

dev_require=`egrep -s -e "require\(\"[^\.].*\)" -R test _test_generated test_helpers  generate.js | sed -E "$r1" | sort | uniq  | grep -Ev $e`
dev_json=$(node -e "$extract_devdep")

dev_require_l=`egrep -s -e "require\(\"node-opcua.*\)" -R test _test_generated test_helpers generate.js | sed -E "$r1" | sort | uniq  | grep -Ev $e`


# echo "req            =>\n "$prod_require
# echo "req node-opcua =>\n "$prod_require_l
# echo "req in package =>\n "$prod_json

fprod_require=/tmp/a.txt
fprod_json=/tmp/b.txt
fdev_require=/tmp/c.txt
fdev_json=/tmp/d.txt
fdev_require_sanitized=/tmp/e.txt
fdev_json_sanitized=/tmp/f.txt

# ------------------------------------------------------------
echo $prod_require | tr ' ' '\n' | sort > $fprod_require
echo $prod_json    | tr ' ' '\n' | sort > $fprod_json 

echo $dev_require  | tr ' ' '\n' | sort > $fdev_require
echo $dev_json     | tr ' ' '\n' | sort > $fdev_json

# package that are in devdependencies after removing package already in dependencies
comm -31 $fprod_require $fdev_require > $fdev_require_sanitized
comm -31 $fprod_json    $fdev_json    > $fdev_json_sanitized

#
echo 
echo "* missing packages in package.json#dependencies"
comm -32 $fprod_require $fprod_json 
echo 
echo "* unnecessray packages in package.json#dependencies"
comm -31 $fprod_require $fprod_json

# ------------------------ Package in devdependencies ( after excluding package already in dependencies)
echo
echo "* missing package in package.json#devDependencies"
comm -32 $fdev_require_sanitized $fdev_json_sanitized
echo
echo "* unnecessary package in package.json#devDependencies"
comm -31 $fdev_require_sanitized $fdev_json_sanitized




