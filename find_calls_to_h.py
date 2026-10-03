with open('public/assets/Pojue-DJRstSia.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'\bH\(', text)]
for idx in matches:
    print("--- Call to H() at", idx, "---")
    print(text[max(0, idx-100):min(len(text), idx+200)])
