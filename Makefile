

test-cov: coverage

# c8 reads .c8rc.json. --all is deliberately absent: it reports every file matching the
# include globs whether or not it ran, which added ~3100 never-loaded .ts rows at 0% and
# dragged the headline figure down to something that measured the source-to-compiled file
# ratio rather than the tests.
coverage:
	pnpm exec c8 node --expose-gc ${SECURITY_REVERT_CVE_2023_46809} --max_old_space_size=8192 ./packages/run_all_mocha_tests.js
	pnpm exec c8 report --reporter=lcov --reporter=html
