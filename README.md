# AccountantAI

AccountantAI is a desktop application that processes tax documents using Claude AI to extract relevant information and organize them into client folders.

## Features

- Automatically processes PDF tax documents
- Extracts key information like document type, client name, tax year
- Organizes documents into client folders
- Handles retries and failures gracefully
- Tracks progress with checkpoints

## Dependencies

The application handles most dependencies automatically. Python dependencies are installed when the application starts up.

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

### Python Dependencies

Python packages are automatically installed during application startup. The application uses the following key packages:

- python-dotenv - Environment variable management
- anthropic - Claude AI API client
- tqdm - Progress bar
- pdf2image - PDF conversion
- poppler-utils - PDF utilities
- requests - HTTP client
- pillow - Image processing

## Setup Instructions

1. Download the packaged application for your OS
2. Launch the application
3. Set your Anthropic API key in the settings
4. Upload documents to process
5. Start processing

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

## Development Setup

To set up for development:

1. Clone the repository
2. Install Node.js dependencies:
   ```
   npm install
   ```
3. Make sure Python is installed
4. Install Python dependencies manually for development:
   ```
   pip install -r requirements.txt
   ```
5. Run the application in development mode:
   ```
   npm run dev
   ```

## Building for Distribution

To build the application for distribution:

```bash
# For macOS
npm run package-mac

# For Windows
npm run package-win

# For Linux
npm run package-linux
```

## Configuration

See [SETTINGS.md](SETTINGS.md) for configuration options.
