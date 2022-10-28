-- prepare-sql: create table sample.test as select 1 as id, '1' as val
-- backend: postgres
-- inputs: sample.test
-- outputs: a.b

-- 'xtarget' cannot be recognized, should be comment
-- xtarget=variables

-- 'xx' is not a valid target type, should be illegal word
-- target=xx

-- target=variables
select 1 as a, 2 as b

-- target=variables, if=func(a, b, ${cd})
select 1 as a, 2 as b

-- 'cd?abc' is not a valid variable name, will be an invalid word
-- ' xx abc' should not exist, will be invalid word
-- target=template.abc, if=func(a, b, ${cd?abc}) xx abc
a=#{right_table}.abc and '#{a}' > 1

-- target=temp.abc
select * from sample.test where ${abc(right_table=${a})}

-- target=check.func_call(${a}, bc), if=func(a, b, ${cd})

-- target=log.shoule_log_things
select * from abc limit 2

-- target=output.a.b
select * from abc
