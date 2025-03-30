"""
Direct PDF converter that doesn't rely on external tools like Poppler.
This is a fallback if Poppler is not installed or not working.
"""

import os
import io
import logging
import platform
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

try:
    # Try to import PyMuPDF (fitz) for more reliable PDF conversion
    import fitz
    HAVE_FITZ = True
except ImportError:
    HAVE_FITZ = False
    # If fitz is not available, try pdf2image with fallbacks
    try:
        from pdf2image import convert_from_path
        HAVE_PDF2IMAGE = True
    except ImportError:
        HAVE_PDF2IMAGE = False

logger = logging.getLogger(__name__)

def convert_pdf_to_image(pdf_path, dpi=200, first_page=1):
    """
    Convert a PDF to an image using various methods in order of preference:
    1. PyMuPDF (fitz) - Most reliable and doesn't need external dependencies
    2. pdf2image with default settings - Requires Poppler
    3. Fallback to create an error image if nothing else works
    """
    try:
        # Try PyMuPDF first - no external dependencies
        if HAVE_FITZ:
            logger.info("Using PyMuPDF to convert PDF")
            try:
                doc = fitz.open(pdf_path)
                if doc.page_count > 0:
                    page = doc.load_page(first_page-1)  # 0-based index
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better quality
                    
                    # Convert to PIL Image
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    return [img]
            except Exception as e:
                logger.warning(f"PyMuPDF conversion failed: {str(e)}")
        
        # Try pdf2image if available
        if HAVE_PDF2IMAGE:
            logger.info("Using pdf2image to convert PDF")
            try:
                # Try with no special args first
                images = convert_from_path(
                    pdf_path, 
                    first_page=first_page, 
                    last_page=first_page,
                    dpi=dpi
                )
                if images:
                    return images
            except Exception as e:
                logger.warning(f"pdf2image conversion failed: {str(e)}")
                
                # If that failed and we're on Windows, try with a poppler path
                if platform.system() == "Windows":
                    # Try common Poppler paths on Windows
                    common_paths = [
                        os.path.join(os.path.expanduser('~'), 'poppler', 'bin'),
                        r'C:\Program Files\poppler\bin',
                        r'C:\Program Files (x86)\poppler\bin',
                        r'C:\poppler\bin'
                    ]
                    
                    # Also check if POPPLER_PATH is set
                    if os.environ.get('POPPLER_PATH'):
                        common_paths.insert(0, os.environ.get('POPPLER_PATH'))
                    
                    for poppler_path in common_paths:
                        if os.path.exists(poppler_path):
                            try:
                                logger.info(f"Trying pdf2image with poppler_path={poppler_path}")
                                images = convert_from_path(
                                    pdf_path, 
                                    first_page=first_page, 
                                    last_page=first_page,
                                    dpi=dpi,
                                    poppler_path=poppler_path
                                )
                                if images:
                                    return images
                            except Exception as e2:
                                logger.warning(f"pdf2image with {poppler_path} failed: {str(e2)}")
        
        # If we get here, all conversion methods failed
        logger.error("All PDF conversion methods failed. Creating error image.")
        return [create_text_image(f"Could not convert PDF: {os.path.basename(pdf_path)}\n\nPlease install PyMuPDF or Poppler.")]
    
    except Exception as e:
        logger.error(f"Unhandled exception in PDF conversion: {str(e)}")
        return [create_text_image(f"Error: {str(e)}")]

def create_text_image(text, width=1000, height=1400, bg_color=(255, 255, 255), text_color=(0, 0, 0)):
    """Create an image with text as a fallback when PDF conversion fails"""
    try:
        # Create a blank image
        img = Image.new('RGB', (width, height), color=bg_color)
        draw = ImageDraw.Draw(img)
        
        # Try to use a standard font
        try:
            if platform.system() == "Windows":
                font_path = "arial.ttf"  # Standard on Windows
            elif platform.system() == "Darwin":  # macOS
                font_path = "/System/Library/Fonts/Helvetica.ttc"
            else:  # Linux
                font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
            
            if os.path.exists(font_path):
                font = ImageFont.truetype(font_path, size=24)
            else:
                # Use default font if specific font not found
                font = ImageFont.load_default()
        except Exception:
            # Fallback to default font
            font = ImageFont.load_default()
        
        # Draw multiline text with wrapping
        lines = []
        words = text.split()
        current_line = ""
        
        for word in words:
            test_line = current_line + " " + word if current_line else word
            text_width = draw.textlength(test_line, font=font) if hasattr(draw, 'textlength') else font.getlength(test_line)
            
            if text_width < width - 100:  # Leave margins
                current_line = test_line
            else:
                lines.append(current_line)
                current_line = word
        
        if current_line:
            lines.append(current_line)
        
        # Draw lines
        y_position = 50
        for line in lines:
            draw.text((50, y_position), line, font=font, fill=text_color)
            y_position += 30
        
        return img
    
    except Exception as e:
        # Ultimate fallback - create the simplest possible image
        logger.error(f"Error creating text image: {str(e)}")
        img = Image.new('RGB', (width, height), color=bg_color)
        return img
