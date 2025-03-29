#!/usr/bin/env python3
"""
Helper script to find and configure Poppler installation
This script finds the Poppler binaries on the system and prints information
that can be used to set up the environment correctly.
"""

import os
import sys
import platform
import subprocess
import glob
import shutil
from pathlib import Path

def find_poppler_mac():
    """Find Poppler installation on macOS"""
    # Common Homebrew installation paths
    common_paths = [
        "/usr/local/bin",  # Intel Macs
        "/opt/homebrew/bin",  # Apple Silicon
        "/usr/local/Cellar/poppler/*/bin",
        "/opt/homebrew/Cellar/poppler/*/bin"
    ]
    
    found_paths = []
    
    # Try to find pdftoppm in common locations
    for path_pattern in common_paths:
        if '*' in path_pattern:
            # Handle wildcard paths like /opt/homebrew/Cellar/poppler/*/bin
            for actual_path in glob.glob(path_pattern):
                if os.path.exists(os.path.join(actual_path, "pdftoppm")):
                    found_paths.append(actual_path)
        else:
            # Handle direct paths
            if os.path.exists(os.path.join(path_pattern, "pdftoppm")):
                found_paths.append(path_pattern)
    
    # Use which command as a fallback
    try:
        result = subprocess.run(['which', 'pdftoppm'], capture_output=True, text=True)
        if result.returncode == 0:
            bin_path = result.stdout.strip()
            bin_dir = os.path.dirname(bin_path)
            if bin_dir not in found_paths:
                found_paths.append(bin_dir)
    except Exception:
        pass
    
    return found_paths

def find_poppler_windows():
    """Find Poppler installation on Windows"""
    # Common installation paths
    common_paths = [
        os.path.join(os.path.expanduser('~'), 'poppler', 'bin'),
        r'C:\Program Files\poppler\bin',
        r'C:\Program Files (x86)\poppler\bin',
        r'C:\poppler\bin'
    ]
    
    found_paths = []
    
    for path in common_paths:
        if os.path.exists(path) and os.path.exists(os.path.join(path, 'pdftoppm.exe')):
            found_paths.append(path)
    
    return found_paths

def find_poppler_linux():
    """Find Poppler installation on Linux"""
    found_paths = []
    
    # Use which command to find binary
    try:
        result = subprocess.run(['which', 'pdftoppm'], capture_output=True, text=True)
        if result.returncode == 0:
            bin_path = result.stdout.strip()
            bin_dir = os.path.dirname(bin_path)
            found_paths.append(bin_dir)
    except Exception:
        pass
    
    # Check common locations
    common_paths = [
        "/usr/bin",
        "/usr/local/bin",
        "/opt/bin"
    ]
    
    for path in common_paths:
        if os.path.exists(path) and os.path.exists(os.path.join(path, "pdftoppm")):
            if path not in found_paths:
                found_paths.append(path)
    
    return found_paths

def create_env_file(poppler_path):
    """Create or update .env file with POPPLER_PATH"""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    
    # Read existing .env file if it exists
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key] = value
    
    # Add or update POPPLER_PATH
    env_vars['POPPLER_PATH'] = poppler_path
    
    # Write updated .env file
    with open(env_path, 'w') as f:
        for key, value in env_vars.items():
            f.write(f"{key}={value}\n")
    
    print(f"Updated .env file with POPPLER_PATH={poppler_path}")

def main():
    print("--- Poppler Configuration Helper ---")
    print(f"System: {platform.system()} ({platform.machine()})")
    
    found_paths = []
    
    # Find Poppler based on platform
    if platform.system() == "Darwin":
        found_paths = find_poppler_mac()
    elif platform.system() == "Windows":
        found_paths = find_poppler_windows()
    else:  # Linux and others
        found_paths = find_poppler_linux()
    
    # Print results
    if not found_paths:
        print("No Poppler installation found!")
        print("Please install Poppler:")
        if platform.system() == "Darwin":
            print("  brew install poppler")
        elif platform.system() == "Windows":
            print("  Download from: http://blog.alivate.com.au/poppler-windows/")
        else:
            print("  sudo apt-get install poppler-utils")
        return 1
    
    print(f"Found {len(found_paths)} Poppler installation(s):")
    for i, path in enumerate(found_paths):
        binary = "pdftoppm.exe" if platform.system() == "Windows" else "pdftoppm"
        status = "✓" if os.path.exists(os.path.join(path, binary)) else "❌"
        print(f"  {i+1}. {path} [{status}]")
    
    # Use the first valid path
    poppler_path = found_paths[0]
    print(f"\nUsing Poppler at: {poppler_path}")
    
    # Set environment variable
    os.environ['POPPLER_PATH'] = poppler_path
    
    # Create or update .env file
    create_env_file(poppler_path)
    
    print("\nConfiguration complete!")
    print("You can now run the application with the correct Poppler path.")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
