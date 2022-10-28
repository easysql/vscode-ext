# Easy SQL extension for Visual Studio Code

This is the VS code extension for Easy SQL. With it, we can highlight ETLs written in Easy SQL.

## Usage

Once installed in Visual Studio Code, the language feature will be enabled in every '.sql' file.

An example of hightlight screenshot is as below:

![Highlight screenshot](test/sample.png)

In order to make EasySQL related keyword more obvious, we can customize the colors a little. A recommended settings is as below:

```json
{
  ...
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "keyword.target, keyword.config, keyword.prepare-sql, keyword.include",
        "settings": {
          "fontStyle": "bold"
        }
      }
    ]
  }
  ...
}
```

We can add this configuration to user settings.json to make it work. (Open command palette, search for `Open User Settings json`, add the content above to the opened `settings.json` file.)
This will make the keyword bold.

## Features

- Hightlight keywords, function calls, variable reference, templates variables, template reference, conditional targets and other items in ETL.

## Known Issues

- Strings with '--' inside affects variable/template highlight.
- Variable/template reference highlight inside strings does not work.

## Release Notes

Basic highlight for ETLs written in Easy SQL.

### 1.0.0

Syntax highlight.

## For more information

- [Easy SQL](https://github.com/easysql/easy_sql)
- [Easy SQL syntax](https://easy-sql.readthedocs.io/en/latest/easy_sql/syntax.html)

**Enjoy!**
