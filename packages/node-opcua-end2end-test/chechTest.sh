 
 #!/bin/bash
echo "this scripts verifies that all u_test_* have been included in a main test"
 cd test/end_to_end 
 find . -name "u_test*" | sed -e s/\..s$//g | sort  > /tmp/A.txt
 grep "\(./*u_test*\)" *umbre* | sed  -e 's/.*("\(.*\)").*test);/\1/g' | sort > /tmp/B.txt
 diff -b /tmp/A.txt /tmp/B.txt 
 echo "done"

