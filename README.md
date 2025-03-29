# AccountantAI

AccountantAI is a desktop application that processes tax documents using Claude AI to extract relevant information and organize them into client folders.

## Features

- Automatically processes PDF tax documents
- Extracts key information like document type, client name, tax year
- Organizes documents into client folders
- Handles retries and failures gracefully
- Tracks progress with checkpoints

## Dependencies

### Poppler Installation

The application requires poppler for PDF processing. If you see errors like `Unable to get page count. Is poppler installed and in PATH?`, you need to install poppler:

#### macOS

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install poppler
brew install poppler
```

#### Windows

1. Download poppler for Windows from: http://blog.alivate.com.au/poppler-windows/
2. Extract to a location like C:\poppler
3. Add the bin directory to your PATH or set POPPLER_PATH environment variable

#### Linux

Ubuntu/Debian:
```bash
sudo apt-get install poppler-utils
```

Fedora/RHEL:
```bash
sudo dnf install poppler-utils
```

### Python Packages

Required Python packages are listed in requirements.txt. Install them with:

```bash
pip install -r requirements.txt
```

## Windows Encoding Fix

If you encounter encoding errors in Windows Command Prompt like:

```
UnicodeEncodeError: 'charmap' codec can't encode character '\u2192' in position 155: character maps to <undefined>
```

These errors occur when the application tries to print special Unicode characters (checkmarks ✓, arrows →, warning signs ⚠, and cross marks ✗) to the console with a CP1252 encoding that doesn't support these characters.

The fix includes:

1. Replaced Unicode characters with ASCII alternatives:
   - `✓` (U+2713) → `[SUCCESS]`
   - `→` (U+2192) → `->`
   - `⚠` (U+26A0) → `[WARNING]`
   - `✗` (U+2717) → `[ERROR]`

2. Added UTF-8 encoding support:
   - Set log file encoding to UTF-8
   - Attempt to set console code page to UTF-8 (chcp 65001)
   - Added fallback ASCII characters

## Setup

See [WINDOWS-SETUP.md](WINDOWS-SETUP.md) for Windows installation instructions.

## Configuration

See [SETTINGS.md](SETTINGS.md) for configuration options.
