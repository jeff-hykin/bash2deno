# Bash2Deno

Try it yourself [online](https://jeff-hykin.github.io/bash2deno/). Make Bash scripts easier to read, cross-platform, and faster by automatically converting them to Deno.

<img width="1461" height="827" alt="Screen Shot 2025-10-13 at 8 55 15 PM" src="https://github.com/user-attachments/assets/983a310a-c570-4f5c-950a-56e974232be1" />

## How to Use

Pick your preferred method, the cli tool, [online converter](https://jeff-hykin.github.io/bash2deno/), or programmatically in javascript.

### CLI

Install the cli tool:
```bash
# install deno
curl -fsSL https://deno.land/install.sh | sh
# install to-esm
deno install -n bash2deno -Afg https://esm.sh/gh/jeff-hykin/bash2deno/cli.js
```

Then run it:
```bash
bash2deno --help
bash2deno --version

# non-destructive
bash2deno -- ./file1.sh ./file2.sh

# destructive
bash2deno --inplace ./bin/file1
```

### Programmatically

```js
import { translate } from "https://esm.sh/gh/jeff-hykin/bash2deno@0.1.0.2/main/api.js"
let code = translate(`echo "Hello World!"`)
```

Or there's an online version here: https://jeff-hykin.github.io/bash2deno/

## How it Works

This uses [tree-sitter](https://tree-sitter.github.io/tree-sitter/) to parse the code, and uses [dax](https://github.com/dsherret/dax) at runtime to make the code map nicely to bash.


#### Features & Limitations

If something is not supported, it still gets translated but just as a FIXME comment containing the original bash code.

Supported:
- For loops
- While loops
- Most Redirection*
- Piping
- Chaining `&&` and `||`
- Aliases
- Unset
- Basic parameter expansion
- Special variables $*, $@, $#, $1, $2, etc
- Backticks
- Nested Command substitution
- basic prompt input (e.g. `read`)
- Command checks (`which`, `command -v`)
- Most If statements
    - String compare
    - Number compare
    - Is executable
    - Is file
    - Is directory
    - String empty 
    - String not empty
    - Negation
- Half-support for Bash Functions (can't redirect / pipe but can call with arguments)

While most bash code will work, there are a few things that are not currently supported:

- Globbing (coming soon, just waiting on [this PR](https://github.com/dsherret/dax/pull/338))
- Double redirection inside of a pipeline
- Heredocs
- Jobs and background task management
- Case statements
- The `$?` variable (Sort of supported, but async makes it not 100% accurate)
- Bash Arrays
- Advanced parameter expansion
- set pipefail
- source
- input redirects
- the `eval` or `source` command
