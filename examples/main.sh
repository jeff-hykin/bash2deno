#!/bin/bash

# ========== VARIABLE ASSIGNMENT ==========
name="Alice"
export name="Alice"
readonly app_version="1.2.3"
number=42
greeting="Hello, $name!"
file_count=$(ls | wc -l)
unset number

# ========== SET OPTIONS ==========
set -euo pipefail  # Exit on error, undefined var is error, and pipe fails propagate

# ========== FUNCTION DEFINITION ==========
say_hello() {
  local who="${1:-World}"  # Default parameter
  echo "Hello\", $who!"
}

# ========== ALIASES ==========
alias ll='ls -lah'
alias greet='say_hello'

# ========== CONTROL FLOW ==========

# IF-ELSE
if [[ "$name" == "Alice" ]]; then
  echo "Hi Alice!"
elif [[ "$name" == "Bob" ]]; then
  echo "Hi Bob!"
else
  echo "Who are you?"
fi

echo "Are you sure?";read ANSWER;echo
if [ ! "$ANSWER" =~ ^[Yy] ]
then
    exit 1
fi

# if curl exists
if [ -n "$(command -v "curl")" ]
then
    curl -s https://example.com
fi

# if name_of_command doesnt exist
if [ -z "$(command -v "name_of_command")" ]
then
    : hji
fi

# FOR LOOP
for i in {1..3}; do
  echo "Loop #$i"
done
# for each argument (in a argument-might-have-spaces friendly way)
for arg in "$@"; do
    echo "$arg"
done

# WHILE LOOP
counter=0
while [[ $counter -lt 3 ]]; do
  echo "Counter: $counter"
  ((counter++))
done

# ========== PARAMETER EXPANSION ==========

echo unquoted
echo unquoted two
echo unquoted\ with\ spaces
echo newline\
    continued # trailing comment
echo splat*
echo doubleSplat**
echo range{1..3}
echo range{1..10..2}
echo 'single quote'
echo 'single quote\
    '
echo 'single quote'"'"'hi'
echo $'single dollar'
echo quote'connection'
echo "double quote"
echo double" quote connection"
echo "double quote with escapes \""
echo "double $dollar"
echo "double subshell $(echo hi)"
echo $dollar'connection'
echo `backticks`
echo "Greeting: ${greeting}"
echo "Greeting upper: ${greeting^^}"      # Uppercase
echo "Greeting length: ${#greeting}"      # Length
echo "Default fallback: ${undefined_var:-DefaultVal}" # Default if unset
filename="archive.tar.gz"
echo "Base name: ${filename%%.*}"         # Remove longest match from end
echo "Extension: ${filename##*.}"         # Remove longest match from start

# ========== REDIRECTS ==========

echo "User processes:"
ps aux
ps aux > /dev/null
ps aux &>/dev/null
ps aux &>>/dev/null
ps aux &>>"./somefile"
ps aux &>>"./somefile$number"
ps aux &>>"./somefile${number}"
ps aux 1>&2 2>/dev/null
tar -cf >(ssh remote_server tar xf -) .
ls somefile thatdoesnotexist 1>/dev/null 2>err

# ========== PIPES ==========
ps aux | grep "$USER"
ps aux | echo "$USER"
echo aux | echo "$USER"
# alsdkjfasdj
ps aux | grep "$USER" | grep -v "double pipe";
# alsdkjfasdj
ps aux | grep "$USER" | grep -v "double pipe and" > /dev/null;
# hi
ps aux &>/dev/null | grep "$USER";
ps aux 1>&2 2>/dev/null | grep "$USER";
ps aux | grep "$USER" | grep -v grep;
# TODO: tree-sitter parser doesn't like this part without semicolons for some reason
cat <<< 'hello';
diff <(ls dir1) <(ls dir2);
paste <(ls dir1) <(ls dir2);

# ========== CHAINING ==========
mkdir -p /tmp/demo || echo hi
mkdir -p /tmp/demo && echo "Created demo dir" && echo "Created demo dir" && echo "Created demo dir"
mkdir -p /tmp/demo && echo "Created demo dir" || echo "Failed to create dir"
mkdir -p /tmp/demo && echo "Created demo dir" || echo "Created demo dir" && echo "Created demo dir"

# ========== ESCAPING ==========

echo "This is a quote: \" and this is a backslash: \\"

# ========== CALL FUNCTION ==========
say_hello "$name"
greet "Bob"

# ========== END ==========
echo "Script completed successfully!"
