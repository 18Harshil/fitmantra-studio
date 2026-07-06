import sys, inspect
from pathlib import Path
sys.path.insert(0, str(Path('.').resolve()))
import web_runner
src = inspect.getsource(web_runner._yield)
print('Has _sse_queue:', '_sse_queue' in src)
# Also check the file directly
with open(web_runner.__file__, 'r') as f:
    content = f.read()
print('File has _sse_queue:', '_sse_queue' in content)
print('File path:', web_runner.__file__)
