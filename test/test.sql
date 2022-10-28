-- backend: postgres

-- 'xtarget' cannot be recognized, should be comment
-- xtarget=variables

-- 'xx' is not a valid target type, should be illegal word
-- '-- target' should be keyword
-- '=' should be operator
-- target=xx

-- 'select' under target should be keyword
-- target=temp.abc
select 1 as a, 2 as b

-----------variables|list_variables start-----------

-- 'variables' should be keyword
-- target=variables

-- '.xx' should be illegal word
-- target=variables.xx

-- 'xx xx' should be illegal word
-- target=variables xx xx

-- ',' should be separator.if
-- 'if' should be keyword
-- '=' should be operator
-- 'func' should be function name
-- 'a' should be a literal
-- 'b' should be a literal
-- '${cd}' should be variable reference, and 'ab' should be variable name
-- target=variables, if=func(a, b, ${cd})

-- 'cd?abc' should be illegal
-- 'xx abc' should be illegal
-- target=variables, if=func(a, b, ${cd?abc}) xx abc

-----------variables|list_variables end-----------

-----------template|log|check|action start-----------

-- 'template' should not be a keyword
-- target=template

-- 'template' should be a keyword
-- 'abc' should be a step-name keyword
-- target=template.abc

-- '.xx bb' should be illegal word
-- target=template.abc.xx bb

-- '.xx bb' should be illegal word
-- target=template.abc.xx bb

-- should be the same as variables with if
-- target=template.abc, if=func(a, b, ${cd?abc}) xx abc

-----------template|log|action end-----------

-----------temp|cache|broadcast start----------

-- 'temp' should not be a keyword
-- target=temp

-- 'temp' should be a keyword
-- 'abc' should be a step-name keyword
-- target=temp.abc

-- '.xx bb' should be illegal word
-- target=temp.abc.xx bb

-- should be the same as variables with if
-- target=cache.abc, if=func(a, b, ${cd?abc}) xx abc

-----------temp|cache|broadcast end----------

-----------output start----------

-- 'output' should not be a keyword
-- target=output

-- 'output' should be a keyword
-- 'abc' should be a recognized
-- target=output.abc

-- 'output' should be a keyword
-- 'db' should be a db-name constant
-- 'table' should be a table-name constant
-- target=output.db.table xx

-- 'output' should be a keyword
-- 'db' should be a db-name constant
-- 'schema' should be a schema-name constant
-- 'table' should be a table-name constant
-- target=output.db.schema.table

-- '.xx xx' should be illegal word
-- target=output.db.schema.table.xx xx

-- should be the same as variables with if
-- target=output.db.table, if=func(a, b, ${cd?abc}) xx abc

-- should be the same as variables with if
-- target=output.db.schema.table, if=func(a, b, ${cd?abc}) xx abc

-----------output end----------

-----------check start----------

-- 'check' should not be a keyword
-- target=check

-- 'check' should be a keyword
-- 'check_name' should be step-name
-- target=check.check_name

-- '.xx xx' should be illegal word
-- target=check.check_name.xx xx , xx

-- 'func' should be function name
-- '${ab}' should be variable reference, and 'ab' should be variable name
-- 'cc$123-.ab?c' should be a literal
-- '${D_abc_890}' should be variable reference, and 'D_abc_890' should be variable name
-- target=check.func(${ab}, cc$123-.ab?c, ${D_abc_890})

-- 'func1' should be function name
-- target=check.func1()

-- should be the same as variables with if
-- target=check.check_name, if=func(a, b, ${cd?abc}) xx abc

-- should be the same as variables with if
-- target=check.func(${ab}, cc$123-.ab?c, ${D_abc_890}), if=func(a, b, ${cd?abc}) xx abc


-----------check end----------

-----------func start----------

-- 'xx xxa' should be an unrecognized word
-- target=func.xx xxa

-- 'func' should be a keyword
-- 'func_name' should be function name
-- '${ab}' should be variable reference, and 'ab' should be variable name
-- 'cc$123-.ab?c' should be a literal
-- '${D_abc_890}' should be variable reference, and 'D_abc_890' should be variable name
-- target=func.func_name(${ab}, cc$123-.ab?c, ${D_abc_890})

-- should be the same as variables with if
-- target=func.func_name(${ab}, cc$123-.ab?c, ${D_abc_890}), if=func(a, b, ${cd?abc}) xx abc

-----------func end----------


-----------var-reference-in-body start----------

-- '${a}' '${a,bc}' should be var reference in all cases
-- '${fn(a,bc)}', '${fn()}', '${fn(a,${bc})}' should be var reference func in all cases
-- TODO: '${fnx()}' should be var reference func
-- TODO: var reference inside string should be var reference
-- target=variables
select
    ${a} as a
    , ${a,bc} as abc
    , ${fn(a,bc)} as abc
    , ${fn()} as abc
    , ${fn(a,${bc})} as abc
    'a--bc' as b, ${fnx()} as abc
    , 'a${a,bc}' as abcd
    , "a${a,bc}d" as abcde
    , `${a,bc}d` as abcde
    , `${fn(a,bc)}d` as abcde

-----------var-reference-in-body end----------

-----------template-definition start----------

-- '#{right_table}' '#{a}' should be template variable reference
-- '${abc}', '${f(abc)}' should be variable reference
-- '${abc,}' should be illegal variable reference
-- TODO: teplate var inside string should be template var reference
-- target=template.abc
a=#{right_table}.abc and '#{a}' > 1
or ${abc} = 1 or ${f(abc)} = 1 and  ${abc,} = 1

-----------template-definition start----------

-----------template-reference-in-body start----------

-- '@{a}' '@{a,bc}' should be template reference in all cases
-- '@{t1(a=1,bc=${xx})}' should be template reference
-- '@{t1(a=1,asdf=,bc=${x})}' should be template reference
-- '@{t1(a=1,asdf=,bc=${f(x)})}' should be template reference, 'f(x)' within it should be invalid word
-- '@{t1(xx\nxx)}' should be multi-line template reference
-- TODO: teplate var inside string should be template var reference
-- target=variables
select
    @{t1(a=1, b=2)} as a
    , @{a} as abc, @{a, bc} as abc
    --, @{a, bc} as abc
    , @{a, bc} as abc
    , @{t1(a=1,bc=${xx})} as abcde
    , @{t1(a=1,
        asdf=
        ,bc=${x})} as abcde
    ,@{abc(a=1, b=2, c=1,d=2)}
    -- , @{t1(a=1,asdf=,bc=${f(x)})} as abcde -- comment out this line, since it will affect the highlighting of content below
    , 'a@{a,bc}' as abcd
    , "a@{a,bc}d" as abcde
    , `@{a,bc}d` as abcde
    , `@{t1(a,bc)}d` as abcde
    , `@{t1(a=1,bc=${xx})}d` as abcde
    , `@{t1(a=1,bc=${xx)})}d` as abcde


-----------template-reference-in-body end----------

----------- config start--------------

-- 'backend' should be keyword
-- 'spark' should be constant
-- backend: spark

-- 'owner' should be keyword
-- abc', 'bcd' should be constant
-- '!?asdfasdf, asdf' should be invalid
-- owner: abc, bdc!?asdfasdf, asdf

-- 'schedule' should be keyword
-- 'asdf(day=asdf)' should be constant
-- schedule: asdf(day=asdf)

-- 'config' should be keyword
-- 'easy_sql.abc' should be constant
-- '=' should be operator
-- 'abc=bcdasdf' should be constant
-- config: easy_sql.abc=abc=bcdasdf

-- 'abc' should be constant
-- config: dataplat.abc=abc

-- 'inputs' should be keyword
-- 'a' should be db-name constant
-- '.' should be operator
-- 'bc' should be table-name
-- inputs: a.bc,c.d

-- 'd' should be schema-name
-- outputs: a.bc, c.de, c.d.e

-- 'prepare-sql' should be keyword
-- 'drop database if exists sample cascade' should be sql
-- prepare-sql: create table sample.test as select 1 as id, '1' as val

----------- config end--------------


----------- include start--------------
-- include=/a/bc.sql
----------- include end--------------
