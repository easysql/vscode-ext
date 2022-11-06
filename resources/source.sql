-- backend: spark

-- target=check.ensure_table_partition_exists(${__step__}, ${data_date}, some_table)

-- target=check.ensure_table_partition_exists(${__step__}, partition_value, table, *tables, ...)

-- target=temp.some_temp_table, if=equal_ignore_case(${a}, ${b})
select *
from some_input_table
where pt='${get_first_partition(${table_var})}'
    and a=${some_user_defined_func()}

-- target=log.log_data_count
select count(1) as count_data from some_temp_table

-- target=output.some_db.some_table
select * from some_temp_table