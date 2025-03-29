#!/bin/bash
# Script to start the AccountantAI application on macOS and Linux

echo "AccountantAI - Starting Application"

# Check for Python installation
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed or not in your PATH."
    echo "Please install Python 3.9 or higher and try again."
    exit 1
fi

# Check Python version
python_version=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
python_version_major=$(echo $python_version | cut -d. -f1)
python_version_minor=$(echo $python_version | cut -d. -f2)

if [ "$python_version_major" -lt 3 ] || ([ "$python_version_major" -eq 3 ] && [ "$python_version_minor" -lt 9 ]); then
    echo "Error: Python 3.9 or higher is required. Your version: $python_version"
    echo "Please upgrade your Python installation."
    exit 1
fi

echo "Using Python $python_version"

# Check for Node.js installation
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in your PATH."
    echo "Please install Node.js and try again."
    exit 1
fi

# Set up virtual environment for Python
echo "Checking and installing Python dependencies..."
echo "Creating virtual environment for Python dependencies..."

# Create and use a virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "Failed to create virtual environment."
        echo "Installing dependencies globally instead..."
    else
        echo "Virtual environment created successfully."
    fi
fi

# Attempt to activate venv and install dependencies
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    python3 -m pip install --upgrade pip
    
    # Try to use precompiled binaries first
    python3 -m pip install --only-binary :all: -r requirements.txt
    
    # If that failed, try the regular install
    if [ $? -ne 0 ]; then
        echo "Trying alternative installation method..."
        python3 -m pip install -r requirements.txt
    fi
else
    # Fallback to global installation
    python3 -m pip install --upgrade pip
    python3 -m pip install -r requirements.txt
fi

if [ $? -ne 0 ]; then
    echo "Failed to install Python dependencies."
    echo "You may need to manually install them with: pip install -r requirements.txt"
    echo "Continuing anyway, but the application may not work correctly..."
fi

# Set up environment and directories
echo "Setting up environment and directories..."
node init-directories.js

# Fix potential permission issues with Python scripts
chmod +x ./main.py
find ./src -name "*.py" -exec chmod +x {} \;

# Start the application
echo "Starting AccountantAI application..."
npm start
