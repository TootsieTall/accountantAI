"""
Direct PDF to Image Converter

This module provides direct PDF to image conversion using command-line tools,
without relying on the pdf2image library or environment variables.
"""

import os
import sys
import json
import subprocess
import tempfile
import platform
import logging
from pathlib import Path
from PIL import Image

logger = logging.getLogger(__name__)

def find_bundled_poppler():
    """Find bundled Poppler binaries"""
    # Start from the current script's directory and go up to find the app root
    current_dir = Path(os.path.dirname(os.path.abspath(__file__)))
    
    # Look up to 3 levels up for the vendor directory
    for _ in range(3):
        vendor_dir = current_dir / 'vendor'
        if vendor_dir.exists():
            poppler_dir = vendor_dir / 'poppler'
            if poppler_dir.exists():
                logger.info(f"Found bundled Poppler at: {poppler_dir}")
                return str(poppler_dir)
        
        # Try one level up
        current_dir = current_dir.parent
    
    # Check the config file
    for _ in range(3):
        config_path = current_dir / 'vendor' / 'poppler-config.json'
        if config_path.exists():
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    if 'path' in config and os.path.exists(config['path']):
                        logger.info(f"Found Poppler path in config: {config['path']}")
                        return config['path']
            except Exception as e:
                logger.warning(f"Error reading config: {e}")
        
        # Try one level up
        current_dir = current_dir.parent
    
    return None

def find_system_poppler():
    """Find system-installed Poppler binaries"""
    system = platform.system()
    pdftoppm_name = "pdftoppm.exe" if system == "Windows" else "pdftoppm"
    
    # Check common paths based on OS
    if system == "Darwin":  # macOS
        common_paths = [
            "/opt/homebrew/bin",  # Apple Silicon
            "/usr/local/bin",      # Intel Macs
            "/opt/local/bin",      # MacPorts
        ]
    elif system == "Windows":
        common_paths = [
            os.path.join(os.path.expanduser('~'), 'poppler', 'bin'),
            r'C:\Program Files\poppler\bin',
            r'C:\Program Files (x86)\poppler\bin',
            r'C:\poppler\bin',
        ]
    else:  # Linux
        common_paths = [
            "/usr/bin",
            "/usr/local/bin",
            "/opt/bin",
        ]
    
    # Check each path
    for path in common_paths:
        if os.path.exists(os.path.join(path, pdftoppm_name)):
            logger.info(f"Found system Poppler at: {path}")
            return path
    
    # Try to find using 'which' command
    try:
        if system != "Windows":
            result = subprocess.run(['which', 'pdftoppm'], capture_output=True, text=True)
            if result.returncode == 0:
                path = os.path.dirname(result.stdout.strip())
                logger.info(f"Found Poppler using 'which': {path}")
                return path
    except Exception:
        pass
    
    return None

def convert_pdf_to_image(pdf_path, output_format='PNG', dpi=150, first_page=1, last_page=1):
    """
    Convert a PDF file to images using direct command-line tools
    
    Args:
        pdf_path: Path to PDF file
        output_format: Output image format ('PNG', 'JPEG', etc.)
        dpi: DPI for rendering
        first_page: First page to convert (1-based)
        last_page: Last page to convert (1-based, inclusive)
    
    Returns:
        List of PIL Image objects
    """
    # Find Poppler executables
    poppler_path = find_bundled_poppler() or find_system_poppler()
    
    if not poppler_path:
        logger.error("Poppler not found, cannot convert PDF to image")
        raise RuntimeError("Poppler not found, cannot convert PDF to image")
    
    # Determine the executable path based on OS
    if platform.system() == "Windows":
        pdftoppm_path = os.path.join(poppler_path, "pdftoppm.exe")
    else:
        pdftoppm_path = os.path.join(poppler_path, "pdftoppm")
    
    # Ensure the executable exists
    if not os.path.exists(pdftoppm_path):
        logger.error(f"pdftoppm executable not found at {pdftoppm_path}")
        raise RuntimeError(f"pdftoppm executable not found at {pdftoppm_path}")
    
    # Create temp directory
    with tempfile.TemporaryDirectory() as temp_dir:
        prefix = os.path.join(temp_dir, "page")
        
        # Prepare command
        cmd = [
            pdftoppm_path,
            "-png" if output_format == 'PNG' else "-jpeg",
            "-r", str(dpi),
            "-f", str(first_page),
            "-l", str(last_page),
            str(pdf_path),
            prefix
        ]
        
        logger.info(f"Running command: {' '.join(cmd)}")
        
        try:
            # Run the command
            result = subprocess.run(cmd, check=True, capture_output=True)
            logger.info(f"pdftoppm completed successfully")
            
            # Find generated images
            images = []
            for file in sorted(os.listdir(temp_dir)):
                file_path = os.path.join(temp_dir, file)
                if os.path.isfile(file_path) and file.startswith(os.path.basename(prefix)):
                    try:
                        images.append(Image.open(file_path).copy())
                    except Exception as e:
                        logger.error(f"Error opening image {file_path}: {e}")
            
            logger.info(f"Generated {len(images)} images from PDF")
            return images
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Error running pdftoppm: {e}")
            logger.error(f"stdout: {e.stdout.decode('utf-8', errors='ignore')}")
            logger.error(f"stderr: {e.stderr.decode('utf-8', errors='ignore')}")
            raise RuntimeError(f"Error converting PDF to image: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during PDF conversion: {e}")
            raise RuntimeError(f"Unexpected error during PDF conversion: {e}")

# Test function
if __name__ == "__main__":
    # Simple test if run directly
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        logging.basicConfig(level=logging.INFO)
        
        try:
            images = convert_pdf_to_image(pdf_path)
            print(f"Successfully converted {len(images)} pages")
            
            # Save the first image as a test
            if images:
                test_output = "test_output.png"
                images[0].save(test_output)
                print(f"Saved test image to {test_output}")
        except Exception as e:
            print(f"Error: {e}")
    else:
        print("Usage: python direct_pdf_converter.py <pdf_file>")
