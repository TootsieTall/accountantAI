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
        pdftoppm_path = os.path.join(path, pdftoppm_name)
        if os.path.exists(pdftoppm_path):
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
    
    # Check if POPPLER_PATH environment variable is set
    poppler_path_env = os.environ.get('POPPLER_PATH')
    if poppler_path_env and os.path.exists(poppler_path_env):
        logger.info(f"Found Poppler using POPPLER_PATH environment variable: {poppler_path_env}")
        return poppler_path_env
        
    return None

def create_text_image(text, width=800, height=1100):
    """Create an image with text when PDF conversion fails"""
    img = Image.new('RGB', (width, height), color=(255, 255, 255))
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(img)
    # Use a default font
    try:
        # Try to load a system font
        if platform.system() == "Windows":
            font = ImageFont.truetype("arial.ttf", 12)
        else:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 12)
    except:
        # Fall back to default
        font = ImageFont.load_default()
    
    # Add text to image - wrap long text
    y_position = 20
    words = text.split()
    lines = []
    current_line = []
    
    for word in words:
        current_line.append(word)
        line_text = ' '.join(current_line)
        if len(line_text) > 80:  # Approximate line length
            lines.append(line_text)
            current_line = []
    
    # Add the last line if not empty
    if current_line:
        lines.append(' '.join(current_line))
    
    # Draw each line
    line_height = 20
    for line in lines:
        draw.text((20, y_position), line, fill=(0, 0, 0), font=font)
        y_position += line_height
    
    return img

def convert_pdf_to_text(pdf_path):
    """
    Fallback function that tries to extract text from PDF when image conversion fails
    """
    try:
        # Try to use pdftotext if available
        system = platform.system()
        poppler_path = find_bundled_poppler() or find_system_poppler()
        
        if not poppler_path:
            return "PDF text extraction failed: Poppler not found"
            
        # Determine the executable path based on OS
        if system == "Windows":
            pdftotext_path = os.path.join(poppler_path, "pdftotext.exe")
        else:
            pdftotext_path = os.path.join(poppler_path, "pdftotext")
            
        if not os.path.exists(pdftotext_path):
            return "PDF text extraction failed: pdftotext not found"
            
        # Create temp file for output
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as temp_file:
            output_path = temp_file.name
            
        # Run pdftotext
        cmd = [pdftotext_path, str(pdf_path), output_path]
        subprocess.run(cmd, check=True, capture_output=True)
        
        # Read the text
        with open(output_path, 'r', encoding='utf-8', errors='replace') as f:
            text = f.read()
            
        # Clean up
        os.unlink(output_path)
        
        return text
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        return f"PDF text extraction failed: {str(e)}"

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
        error_text = "Poppler is not installed or not found in PATH. Please install Poppler to process PDF documents."
        return [create_text_image(error_text)]
    
    # Log the poppler path for debugging
    logger.info(f"Using Poppler path: {poppler_path}")
    
    # Determine the executable path based on OS
    if platform.system() == "Windows":
        pdftoppm_path = os.path.join(poppler_path, "pdftoppm.exe")
        # Convert PDF path to Windows format and escape spaces
        pdf_path_str = f'"{str(pdf_path).replace("/", "\\")}"'
    else:
        pdftoppm_path = os.path.join(poppler_path, "pdftoppm")
        # For non-Windows, escape spaces in path
        pdf_path_str = f'"{str(pdf_path)}"'
    
    # Ensure the executable exists
    if not os.path.exists(pdftoppm_path):
        logger.error(f"pdftoppm executable not found at {pdftoppm_path}")
        error_text = f"pdftoppm executable not found at {pdftoppm_path}. Please install Poppler correctly."
        return [create_text_image(error_text)]
    
    logger.info(f"Using pdftoppm executable: {pdftoppm_path}")
    logger.info(f"Converting PDF: {pdf_path_str}")
    
    # Create temp directory
    with tempfile.TemporaryDirectory() as temp_dir:
        prefix = os.path.join(temp_dir, "page")
        
        # Fix Windows path separator issue for temp directory
        if platform.system() == "Windows":
            prefix = prefix.replace('/', '\\')
        
        # Prepare command - don't use quotes in command args, it's handled differently
        cmd = [
            pdftoppm_path,
            "-png" if output_format == 'PNG' else "-jpeg",
            "-r", str(dpi),
            "-f", str(first_page),
            "-l", str(last_page)
        ]
        
        # Add the PDF path without quotes
        cmd.append(str(pdf_path))
        cmd.append(prefix)
        
        logger.info(f"Running command: {' '.join(cmd)}")
        
        try:
            # Run the command
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
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
            
            # If no images were generated, try to extract text as fallback
            if len(images) == 0:
                logger.warning("No images generated, trying text extraction as fallback")
                text = convert_pdf_to_text(pdf_path)
                return [create_text_image(text)]
            
            return images
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Error running pdftoppm: {e}")
            logger.error(f"stdout: {e.stdout}")
            logger.error(f"stderr: {e.stderr}")
            
            # Try fallback to text extraction
            logger.warning("PDF conversion failed, trying text extraction fallback")
            text = convert_pdf_to_text(pdf_path)
            return [create_text_image(text)]
        except Exception as e:
            logger.error(f"Unexpected error during PDF conversion: {e}")
            # Create an error image
            error_text = f"Error converting PDF: {str(e)}"
            return [create_text_image(error_text)]

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
