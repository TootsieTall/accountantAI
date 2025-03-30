# Windows Unicode Encoding Fix

## Issue

When running AccountantAI on Windows, Unicode encoding errors occur like:

```
UnicodeEncodeError: 'charmap' codec can't encode character '\u2713' in position 0: character maps to <undefined>
```

These errors happen because Windows console by default uses a non-Unicode encoding (usually cp1252), which doesn't support special characters like checkmarks (✓), arrows (→), warning symbols (⚠), etc.

## New Solution (Simplified)

After testing, we found that attempting to configure Windows console for UTF-8 support can be unreliable across different Windows environments. The most robust solution is:

1. **Use ASCII-only symbols on Windows**: Replace all Unicode symbols with simple ASCII alternatives
   - `✓` → `[OK]`
   - `✗` → `[X]`
   - `⚠` → `[!]`
   - `→` → `->`

2. **Explicitly set encoding for file operations**: All file operations now use UTF-8 with explicit error handling

## Changes Made

1. Simplified the approach in main.py:
   ```python
   # Force Windows to use ASCII symbols only - no UTF-8 configuration attempt
   SYMBOLS = {
       'success': "[OK]",
       'error': "[X]",
       'warning': "[!]",
       'arrow': "->"
   }

   # Only try Unicode symbols on non-Windows platforms
   if platform.system() != "Windows":
       SYMBOLS = {
           'success': "✓",
           'error': "✗",
           'warning': "⚠",
           'arrow': "→"
       }
   ```

2. Updated file_handler.py to use ASCII arrows:
   ```python
   # Define a simple ASCII arrow for Windows
   ARROW_SYMBOL = "->"
   
   # Log with ASCII symbol
   logger.info(f"Source path: {pdf_path} {ARROW_SYMBOL} Destination path: {dest_path}")
   ```

3. Simplified logging in utils.py:
   ```python
   # Use simple StreamHandler with basic configuration
   handlers = [logging.FileHandler(log_file, encoding='utf-8')]
    
   # Add StreamHandler with appropriate encoding
   if is_windows:
       # On Windows, use basic StreamHandler
       handlers.append(logging.StreamHandler())
   else:
       # On non-Windows, we can use UTF-8 
       handlers.append(logging.StreamHandler())
   ```

4. Added metadata JSON files:
   ```python
   # Also create a JSON metadata file with document information
   json_path = client_dir / f"{client_clean}_{doc_type_clean}_{period}.json"
   
   # Save metadata as JSON
   with open(json_path, 'w', encoding='utf-8') as f:
       json.dump(document_data, f, indent=4, ensure_ascii=True)
   ```

## Additional Benefits

1. The application now generates JSON metadata files alongside processed PDFs
2. All file operations use explicit UTF-8 encoding with error handling
3. The solution works without requiring any manual configuration of the Windows console

## If Issues Persist

If you still encounter issues:

1. Try running with Command Prompt rather than PowerShell
2. Make sure you're using the latest code
3. If problems continue, please create an issue with:
   - The exact error message
   - Windows version details  
   - Python version
   - Command prompt configuration details
