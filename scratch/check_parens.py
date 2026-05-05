import sys

def check_balance(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    stack = []
    line = 1
    col = 1
    in_string = None # ' or " or `
    escape = False
    
    for i, char in enumerate(content):
        if char == '\n':
            line += 1
            col = 1
        else:
            col += 1
            
        if escape:
            escape = False
            continue
            
        if char == '\\':
            escape = True
            continue
            
        if in_string:
            if char == in_string:
                in_string = None
            continue
            
        if char in "'\"`":
            in_string = char
            continue
            
        if char == '(':
            stack.append((line, col, char))
        elif char == ')':
            if not stack:
                print(f"Extra closing ')' at line {line}, col {col}")
            else:
                stack.pop()
                
    for l, c, char in stack:
        print(f"Unclosed '{char}' at line {l}, col {c}")

if __name__ == "__main__":
    check_balance('/Applications/MAMP/htdocs/padeladd4/frontend/js/controllers.js')
