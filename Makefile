

test-cov: istanbul

istanbul:
	npx -y c8 --all node --expose-gc ${SECURITY_REVERT_CVE_2023_46809} --max_old_space_size=8192 ./packages/run_all_mocha_tests.js  
	npx -y c8 report --reporter=lcov --reporter=html 
