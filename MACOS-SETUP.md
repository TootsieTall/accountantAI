# macOS Setup Instructions for AccountantAI

This guide will help you set up the AccountantAI application on macOS.

## Prerequisites

1. Python 3.8 or higher
2. Homebrew (for installing dependencies)
3. Poppler (for PDF processing)
4. An Anthropic API key

## Installation Steps

### 1. Install Homebrew (if not already installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the prompts to complete the installation.

### 2. Install Poppler

```bash
brew install poppler
```

This installs the PDF toolkit required for processing documents.

### 3. Clone or Download the Repository

```bash
git clone https://github.com/TootsieTall/accountantAI.git
cd accountantAI
```

Or download and extract the ZIP file from GitHub.

### 4. Create a Virtual Environment (Optional but Recommended)

```bash
python3 -m venv venv
source venv/bin/activate
```

### 5. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 6. Set up API Keys

Create a `.env` file in the root directory with your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### 7. Run the Application

```bash
# If you're using the Electron interface
npm install
npm start

# If you're running just the Python backend
python main.py
```

## Troubleshooting

### PDF Processing Errors

If you see errors like:

```
Unable to get page count. Is poppler installed and in PATH?
```

Make sure poppler is properly installed:

1. Check if it's installed: `brew list poppler`
2. Reinstall if needed: `brew reinstall poppler`
3. Verify the path: `which pdftoppm` (should show a path if installed)

### Other Issues

- **Memory errors**: For very large PDFs, try adjusting the DPI settings in `src/ai_processor.py`
- **API errors**: Check your API key in the `.env` file
- **Permission issues**: Make sure your user has read/write permissions to the application directories

## Directory Structure

- `/data/source_documents/`: Place your tax PDFs here for processing
- `/data/processed/`: Processed files will be organized here
- `/logs/`: Application logs

## Additional Resources

- [Homebrew](https://brew.sh/)
- [Poppler](https://poppler.freedesktop.org/)
- [Anthropic API Documentation](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
