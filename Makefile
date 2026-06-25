

test-cov: istanbul

istanbul:
	npx -y c8 --all node --expose-gc ${SECURITY_REVERT_CVE_2023_46809} --max_old_space_size=8192 ./packages/run_all_mocha_tests.js  
	npx -y c8 report --reporter=lcov --reporter=html 

# literate_programming stuff
LP= "../node_modules/.bin/literate-programming"
LP_WIN= "..\\node_modules\\.bin\\literate-programming.cmd"


examples:
	( cd documentation ; $(LP) creating_a_server.md )
	( cd documentation ; $(LP) creating_a_client_typescript.md )
	( cd documentation ; $(LP) creating_a_client_callback.md )
	( cd documentation ; $(LP) create_a_weather_station.md )
	( cd documentation ; $(LP) server_with_da_variables.md )
	( cd documentation ; $(LP) server_with_method.md )


