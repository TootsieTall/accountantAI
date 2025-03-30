"""
Unicode Fix Patch - Run this script to sanitize all source files and remove Unicode characters.

Usage:
    python patch.py

This script will scan all Python files in the project and replace problematic Unicode characters
with ASCII alternatives to prevent encoding errors on Windows.
"""

import os
import re
import sys
from pathlib import Path

# Define problematic Unicode characters and their replacements
REPLACEMENTS = {
    '\u2192': '->',   # → (arrow)
    '\u2713': '[OK]', # ✓ (checkmark)
    '\u2717': '[X]',  # ✗ (x mark)
    '\u26a0': '[!]',  # ⚠ (warning)
    # Add any other Unicode characters that might cause issues
}

def find_python_files(start_dir='.'):
    """Find all Python files in the given directory and subdirectories."""
    for root, _, files in os.walk(start_dir):
        for file in files:
            if file.endswith('.py'):
                yield os.path.join(root, file)

def sanitize_file(filepath):
    """Replace Unicode characters in a file with ASCII alternatives."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        for unicode_char, replacement in REPLACEMENTS.items():
            content = content.replace(unicode_char, replacement)
        
        # Check if any replacements were made
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def check_file_for_unicode(filepath):
    """Check if a file contains any of the problematic Unicode characters."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        for unicode_char in REPLACEMENTS:
            if unicode_char in content:
                return True
        return False
    except Exception as e:
        print(f"Error checking {filepath}: {e}")
        return False

def main():
    """Main entry point for the script."""
    print("Unicode Fix Patch")
    print("=================")
    print("Scanning Python files for problematic Unicode characters...")
    
    count_total = 0
    count_fixed = 0
    count_unicode = 0
    
    for filepath in find_python_files():
        count_total += 1
        
        # Check if file contains Unicode characters
        if check_file_for_unicode(filepath):
            count_unicode += 1
            print(f"Found Unicode in: {filepath}")
            
            # Sanitize the file
            if sanitize_file(filepath):
                count_fixed += 1
                print(f"  - Fixed: {filepath}")
            else:
                print(f"  - Failed to fix: {filepath}")
    
    print("\nSummary:")
    print(f"  - Total Python files scanned: {count_total}")
    print(f"  - Files with Unicode characters: {count_unicode}")
    print(f"  - Files fixed: {count_fixed}")
    
    # Special attention to file_handler.py which seems to be causing issues
    file_handler_path = os.path.join('src', 'file_handler.py')
    if os.path.exists(file_handler_path):
        print("\nChecking src/file_handler.py specifically...")
        
        # Force fix for file_handler.py
        with open(file_handler_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace any "Organized document" message that might contain Unicode
        pattern = r'logger\.info\(f"Organized document: {pdf_path}.*?{dest_path}"\)'
        replacement = 'logger.info(f"Source path: {pdf_path} -> Destination path: {dest_path}")'
        
        if re.search(pattern, content):
            content = re.sub(pattern, replacement, content)
            with open(file_handler_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print("  - Fixed 'Organized document' message in src/file_handler.py")
    
    print("\nPatch complete!")

if __name__ == "__main__":
    main()
