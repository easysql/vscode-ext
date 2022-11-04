## highlight based on token
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

## semantic analysis

### 背景：

基于变量替换实现

注意：变量中如出现引号、注释前缀时需要谨慎，因为替换之后可能出现非预期的SQL

### 定义：
字面量：宽字符集 [^,()\n'"`]
变量名：[a-zA-Z_]\w*


### 假设：

1. 函数/模板调用中间不能有comment (有comment之后很难通过正则匹配到开始和结束；字符串也难以判断，因为函数的字面量参数可以是任意字符)
2. 模板调用，空白处可以换行；函数/参数引用中间不能换行
3. 如果出现comment，当前行必须是一整个函数/模板调用/参数引用
4. 函数/模板调用、参数引用 范围内无字符串字符（如果字面量中出现，需要用变量代替）
5. 如果出现未关闭字符串，直接将当前行所有内容匹配为字符串

按照下面的算法处理，将不会识别模板调用中带comment的行

### 算法：

在当前行查找comment（处理开放字符串的情况）
- 有：
    - 对comment之前的内容按行查找其他内容（忽略注释）（此时无开放字符串）
    - 从下一行开始继续查找
- 无：
    - 是否有未关闭字符串
        - 有：
            - 将未关闭字符串及之后的识别为字符串
            - 对未关闭之前的内容，按行查找其他内容（忽略注释）
            - 从下一行开始继续查找
        - 无：
            - 找下一个函数/模板调用、参数引用、字符串
                - 字符串：
                    - 在内部查找函数/模板调用、参数引用（忽略字符串和注释）
                    - 将Any改写为字符串
                    - 从结束处开始继续查找
                - 函数/模板调用、参数引用：
                    - 按照当前方式处理
                    - 从结束处开始继续查找
