```json
// The below config does not work
// multi-line template reference  -> not valid, since it will break the other syntax
{
    "begin": "(?<=[,(])",
    "end": "(?=[,(])",
    "patterns": [
    {
        "begin": "(?<=[,(])",
        "end": "(?==)",
        "name": "variable.parameter.name.tpl.easysql"
    },
    { "match": "=", "name": "keyword.operator.assignment.easysql" },
    {
        "begin": "(?<==)",
        "name": "constant.other.literal.easysql",
        "end": "(?=[,(])"
    }
    ]
},
```
