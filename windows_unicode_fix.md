# Windows Unicode Encoding Fix

## Issue

When running AccountantAI on Windows, you might encounter Unicode encoding errors like:

```
UnicodeEncodeError: 'charmap' codec can't encode character '\u2713' in position 0: character maps to <undefined>
```

These errors occur because Windows console by default uses a non-Unicode encoding (usually cp1252), which doesn't support special characters like checkmarks (✓), arrows (→), warning symbols (⚠), etc.

## Solution

The application has been updated to handle these encoding issues in several ways:

1. **Automatic UTF-8 Configuration**: The application now tries to set the Windows console to use UTF-8 encoding
2. **Smart Symbol Selection**: Special Unicode characters are replaced with ASCII alternatives when UTF-8 encoding isn't available
3. **Encoding Error Handling**: All file operations now explicitly use UTF-8 encoding with error handling

## Changes Made

1. Added UTF-8 configuration for Windows console:
   ```python
   if platform.system() == "Windows":
       try:
           import ctypes
           # Set console code page to UTF-8
           ctypes.windll.kernel32.SetConsoleCP(65001)
           ctypes.windll.kernel32.SetConsoleOutputCP(65001)
           # Force UTF-8 for stdout
           sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='backslashreplace')
           sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='backslashreplace')
       except Exception as e:
           # Fall back to ASCII symbols
           pass
   ```

2. Created a platform-aware symbol system:
   ```python
   def get_symbols():
       """Get appropriate symbols based on platform and encoding support"""
       if platform.system() != "Windows":
           # Use Unicode symbols on non-Windows platforms
           return {
               'success': "✓",
               'error': "✗",
               'warning': "⚠",
               'arrow': "→"
           }
       
       try:
           # Test if console can handle Unicode
           if sys.stdout.encoding.lower() == 'utf-8':
               return {
                   'success': "✓",
                   'error': "✗",
                   'warning': "⚠",
                   'arrow': "→"
               }
       except:
           pass
       
       # Fallback to ASCII alternatives for Windows
       return {
           'success': "[OK]",
           'error': "[X]",
           'warning': "[!]",
           'arrow': "->"
       }
   ```

3. Updated all file operations to use UTF-8 encoding:
   ```python
   with open(checkpoint_path, 'w', encoding='utf-8') as f:
       json.dump(processed_paths, f)
   ```

## Manual Fix for Windows Command Prompt

If you're still experiencing encoding issues, you can manually set your Windows command prompt to use UTF-8:

1. Open Command Prompt
2. Run the following command:
   ```
   chcp 65001
   ```
3. Use a font that supports Unicode (like Consolas)

## If Issues Persist

If encoding issues persist despite these fixes, please create an issue on the GitHub repository with:
- The exact error message
- Windows version details
- Python version
- Command prompt or terminal application being used
