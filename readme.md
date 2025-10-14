# Bash2Deno

Make your Bash scripts easier to read, cross-platform, and faster by automatically converting them to Deno.

<img width="1461" height="827" alt="Screen Shot 2025-10-13 at 8 55 15 PM" src="https://github.com/user-attachments/assets/983a310a-c570-4f5c-950a-56e974232be1" />

## How to Use

There's an online version here: https://jeff-hykin.github.io/shell_convert/

You can also run it programmatically:

```js
import { translate } from "https://esm.sh/gh/jeff-hykin/shell_convert@1.0.0/main/api.js"
let code = translate(`echo "Hello World!"`)
```

## How it Works

This uses [tree-sitter](https://tree-sitter.github.io/tree-sitter/) to parse the code, and uses [dax](https://github.com/dsherret/dax) at runtime to make the code map nicely to bash.


#### Limitations

While most bash code will work, there are a few things that are not currently supported:

- Case statements
- Bash Functions
- Heredocs
- Bash Arrays
- Advanced parameter expansion
