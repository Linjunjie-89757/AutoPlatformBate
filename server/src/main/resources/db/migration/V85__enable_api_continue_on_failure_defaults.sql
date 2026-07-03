ALTER TABLE tb_api_execution_suite
    ALTER COLUMN continue_on_failure SET DEFAULT 1;

ALTER TABLE tb_api_scenario
    ALTER COLUMN continue_on_failure SET DEFAULT 1;

UPDATE tb_api_execution_suite
SET continue_on_failure = 1
WHERE continue_on_failure = 0;

UPDATE tb_api_scenario
SET continue_on_failure = 1
WHERE continue_on_failure = 0;
