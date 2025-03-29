# Windows Setup Guide for AccountantAI

This guide provides step-by-step instructions for setting up AccountantAI on Windows, specifically addressing common issues with Python dependencies.

## Quick Start (For Microsoft Store Python Users)

If you installed Python from the Microsoft Store and are encountering dependency issues:

1. Run the included `fix-python.bat` script:
   ```
   fix-python.bat
   ```

2. Once dependencies are installed, run the application:
   ```
   start-app.bat
   ```

## Manual Setup

If the automatic scripts don't work, follow these steps manually:

### 1. Install Required Software

1. **Node.js**: Download and install from [nodejs.org](https://nodejs.org/) (version 18+ recommended)
2. **Python**: Download and install from [python.org](https://python.org/) (version 3.9, 3.10, or 3.11 recommended)
   - Make sure to check "Add Python to PATH" during installation

### 2. Install Node Dependencies

Open Command Prompt in the application directory and run:

```
npm install
```

### 3. Install Python Dependencies

Create and use a virtual environment:

```batch
python -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip
```

Install dependencies with precompiled binaries:

```batch
python -m pip install --only-binary :all: pillow>=10.1.0
python -m pip install --only-binary :all: -r requirements.txt
```

If that doesn't work, try installing each dependency separately:

```batch
python -m pip install anthropic>=0.16.0
python -m pip install python-dotenv>=1.0.0
python -m pip install tqdm>=4.66.1
python -m pip install pdf2image>=1.17.0
python -m pip install poppler-utils>=0.1.0
python -m pip install requests>=2.31.0
python -m pip install pillow>=10.1.0
```

### 4. Install Poppler for PDF Processing

Poppler is required for PDF processing:

1. Download the Poppler Windows binary from [this GitHub repository](https://github.com/oschwartz10612/poppler-windows/releases)
2. Extract the downloaded file to a folder (e.g., `C:\Program Files\poppler`)
3. Add the `bin` folder to your PATH:
   - Open "Edit the system environment variables" from Windows search
   - Click "Environment Variables"
   - Edit the "Path" variable under System variables
   - Add the full path to the Poppler bin folder (e.g., `C:\Program Files\poppler\bin`)
   - Click OK and close all dialogs

### 5. Run the Application

Start the application:

```batch
npm run dev
```

## Troubleshooting

### Microsoft Store Python Issues

Microsoft Store Python installations have special permissions and directory structures that can cause problems with package installations. Try these solutions:

1. **Use a regular Python installer** from [python.org](https://python.org/) instead of the Microsoft Store version

2. **Install packages with precompiled binaries**:
   ```
   python -m pip install --only-binary :all: packagename
   ```

3. **Install C++ Build Tools** if you need to build packages from source:
   - Download and install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Select "Desktop development with C++" during installation

### "pillow" Installation Issues

If you're having specific problems with Pillow:

1. **Use a newer version**:
   ```
   python -m pip install pillow>=10.1.0
   ```

2. **Install from a wheel**:
   ```
   python -m pip install --only-binary :all: pillow
   ```

### Path and Permission Issues

If you encounter "Permission denied" errors:

1. Run Command Prompt as Administrator
2. Use a directory where you have write permissions

## Additional Resources

- See [PYTHON-TROUBLESHOOTING.md](./PYTHON-TROUBLESHOOTING.md) for more Python-specific solutions
- See [CROSS-PLATFORM.md](./CROSS-PLATFORM.md) for information about cross-platform compatibility
