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

-----------variables|list_variables end-----------

-----------template|log|check|action start-----------

-- 'template' should not be a keyword
-- target=template

-- 'template' should be a keyword
-- 'abc' should be a step-name keyword
-- target=template.abc

-- '.xx bb' should be illegal word
-- target=template.abc.xx bb

-----------template|log|action end-----------

-----------temp|cache|broadcast start----------

-- 'temp' should not be a keyword
-- target=temp

-- 'temp' should be a keyword
-- 'abc' should be a step-name keyword
-- target=temp.abc

-- '.xx bb' should be illegal word
-- target=temp.abc.xx bb

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
-- target=output.db.table

-- 'output' should be a keyword
-- 'db' should be a db-name constant
-- 'schema' should be a schema-name constant
-- 'table' should be a table-name constant
-- target=output.db.schema.table

-- '.xx xx' should be illegal word
-- target=output.db.schema.table.xx xx

-----------output end----------

-----------check start----------

-- 'check' should not be a keyword
-- target=check

-- 'check' should be a keyword
-- 'check_name' should be step-name
-- target=check.check_name

-- '.xx xx' should be illegal word
-- target=check.check_name.xx xx

-- 'func' should be function name
-- '${ab}' should be variable reference, and 'ab' should be variable name
-- 'cc$123-.ab?c' should be a literal
-- '${D_abc_890}' should be variable reference, and 'D_abc_890' should be variable name
-- target=check.func(${ab}, cc$123-.ab?c, ${D_abc_890})

-- 'func1' should be function name
-- target=check.func1()

-----------check end----------

-----------func start----------

-- 'xx xxa' should be an unrecognized word
-- TODO: 'xxa' better be illegal words
-- target=func.xx xxa

-- 'func' should be a keyword
-- 'func_name' should be function name
-- '${ab}' should be variable reference, and 'ab' should be variable name
-- 'cc$123-.ab?c' should be a literal
-- '${D_abc_890}' should be variable reference, and 'D_abc_890' should be variable name
-- target=func.func_name(${ab}, cc$123-.ab?c, ${D_abc_890})

-----------func end----------
