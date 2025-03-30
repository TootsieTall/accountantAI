# AccountantAI Python Requirements

To make PDF processing more reliable, install these Python packages:

```
pip install PyMuPDF tqdm python-dotenv anthropic pdf2image Pillow
```

## Optional Dependency: Poppler

While no longer strictly required (PyMuPDF is used as the primary PDF processor), Poppler provides better quality PDF rendering in some cases.

### Installing Poppler:

#### Windows:
1. Download from http://blog.alivate.com.au/poppler-windows/
2. Extract to a location like `C:\poppler`
3. Add the `bin` directory to your PATH or set `POPPLER_PATH` environment variable

#### macOS:
```
brew install poppler
```

#### Linux:
```
# Debian/Ubuntu
sudo apt-get install poppler-utils

# Fedora/RHEL
sudo dnf install poppler-utils
```

## Unicode Fix for Windows

If you encounter Unicode encoding errors on Windows, follow the instructions in `README_Windows_Fix.md`.

## Installation Instructions

1. Clone this repository
2. Install the requirements:
   ```
   pip install -r requirements.txt
   ```
3. Create a `.env` file with your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your_key_here
   ```
4. Run the application:
   ```
   python main.py
   ```

## Troubleshooting

If you encounter issues with PDF processing:

1. Try installing PyMuPDF first for the most reliable PDF conversion:
   ```
   pip install PyMuPDF
   ```

2. If still having issues, install Poppler (see above)

3. For Windows Unicode errors, see `README_Windows_Fix.md`
