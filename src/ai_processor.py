import os
import logging
import base64
import io
import time
import subprocess
import sys
import shutil
import platform
import glob
from pathlib import Path
from pdf2image import convert_from_path
import anthropic
import config

# Import our direct PDF converter
from src.direct_pdf_converter import convert_pdf_to_image, create_text_image

logger = logging.getLogger(__name__)

def find_poppler_mac():
    """Find Poppler installation on macOS"""
    # Direct binary check first - most reliable
    try:
        result = subprocess.run(['which', 'pdftoppm'], capture_output=True, text=True)
        if result.returncode == 0:
            bin_path = result.stdout.strip()
            bin_dir = os.path.dirname(bin_path)
            return bin_dir
    except Exception:
        pass
    
    # Common Homebrew installation paths
    common_paths = [
        "/usr/local/bin",  # Intel Macs
        "/opt/homebrew/bin",  # Apple Silicon
        os.path.expanduser("~/homebrew/bin")  # Custom Homebrew
    ]
    
    # Check direct paths first
    for path in common_paths:
        if os.path.exists(os.path.join(path, "pdftoppm")):
            return path
    
    # Try Homebrew Cellar paths with glob
    cellar_patterns = [
        "/usr/local/Cellar/poppler/*/bin",
        "/opt/homebrew/Cellar/poppler/*/bin"
    ]
    
    for pattern in cellar_patterns:
        matches = glob.glob(pattern)
        for match in matches:
            if os.path.exists(os.path.join(match, "pdftoppm")):
                return match
    
    # Last resort - find pdftoppm anywhere in common directories
    search_roots = ['/usr/local', '/opt/homebrew', '/opt/local']
    for root in search_roots:
        if not os.path.exists(root):
            continue
        
        for dirpath, dirnames, filenames in os.walk(root):
            if 'pdftoppm' in filenames:
                return dirpath
    
    return None

def check_poppler_installation():
    """Check if poppler is installed and available in PATH"""
    system = platform.system()
    try:
        # Check for POPPLER_PATH environment variable first
        poppler_path = os.environ.get('POPPLER_PATH')
        if poppler_path and os.path.exists(poppler_path):
            # Add to PATH if not already there
            if poppler_path not in os.environ['PATH']:
                os.environ['PATH'] = f"{poppler_path}{os.pathsep}{os.environ['PATH']}"
            logger.info(f"Using Poppler from POPPLER_PATH: {poppler_path}")
            return True, "Poppler is installed and available via POPPLER_PATH"
        
        if system == "Darwin":  # macOS
            poppler_path = find_poppler_mac()
            if poppler_path:
                # Add to PATH and env var
                if poppler_path not in os.environ['PATH']:
                    os.environ['PATH'] = f"{poppler_path}{os.pathsep}{os.environ['PATH']}"
                os.environ['POPPLER_PATH'] = poppler_path
                logger.info(f"Found Poppler on macOS: {poppler_path}")
                return True, f"Poppler found at: {poppler_path}"
            
            # Double-check system PATH
            for dir_path in os.environ['PATH'].split(os.pathsep):
                pdftoppm_path = os.path.join(dir_path, 'pdftoppm')
                if os.path.exists(pdftoppm_path) and os.access(pdftoppm_path, os.X_OK):
                    os.environ['POPPLER_PATH'] = dir_path
                    logger.info(f"Found pdftoppm in PATH: {dir_path}")
                    return True, f"Poppler found in PATH at: {dir_path}"
                    
            # Special case - try to run Homebrew installation
            try:
                logger.info("Attempting to install Poppler with Homebrew")
                subprocess.run(['brew', 'install', 'poppler'], check=True)
                # Check again after installation
                poppler_path = find_poppler_mac()
                if poppler_path:
                    os.environ['POPPLER_PATH'] = poppler_path
                    os.environ['PATH'] = f"{poppler_path}{os.pathsep}{os.environ['PATH']}"
                    logger.info(f"Installed Poppler with Homebrew: {poppler_path}")
                    return True, f"Poppler installed at: {poppler_path}"
            except Exception as e:
                logger.warning(f"Failed to install Poppler with Homebrew: {e}")
            
            # Last resort - hard-coded paths for M1/M2 Macs and Intel Macs
            fallback_paths = [
                "/opt/homebrew/bin",
                "/usr/local/bin",
                "/opt/homebrew/Cellar/poppler/25.03.0/bin",  # Version may vary
                "/usr/local/Cellar/poppler/25.03.0/bin"
            ]
            
            for path in fallback_paths:
                if os.path.exists(path):
                    os.environ['POPPLER_PATH'] = path
                    os.environ['PATH'] = f"{path}{os.pathsep}{os.environ['PATH']}"
                    logger.info(f"Using fallback Poppler path: {path}")
                    return True, f"Using fallback Poppler path: {path}"
            
            return False, "Poppler is not installed or not in PATH. Install using: brew install poppler"
        
        elif system == "Windows":
            # Check if poppler is in PATH or in standard locations
            if not poppler_path:
                # Try to find poppler in common locations
                common_paths = [
                    os.path.join(os.path.expanduser('~'), 'poppler', 'bin'),
                    r'C:\Program Files\poppler\bin',
                    r'C:\Program Files (x86)\poppler\bin',
                    r'C:\poppler\bin'
                ]
                found = False
                for path in common_paths:
                    if os.path.exists(path) and os.path.exists(os.path.join(path, 'pdftoppm.exe')):
                        os.environ['POPPLER_PATH'] = path
                        # Add to PATH if not already there
                        if path not in os.environ['PATH']:
                            os.environ['PATH'] = f"{path}{os.pathsep}{os.environ['PATH']}"
                        logger.info(f"Found Poppler in: {path}")
                        found = True
                        break
                if not found:
                    # We'll continue anyway - our direct converter will handle this
                    logger.warning("Poppler not found in common locations on Windows")
                    return True, "Poppler not found, but will use fallback methods"
            
            return True, "Poppler check completed"
        
        else:  # Linux and others
            result = subprocess.run(['which', 'pdftoppm'], capture_output=True, text=True)
            if result.returncode != 0:
                return False, "Poppler is not installed. Install it using your package manager (e.g., apt-get install poppler-utils)"
            
            poppler_path = os.path.dirname(result.stdout.strip())
            logger.info(f"Found Poppler in PATH: {poppler_path}")
            return True, "Poppler is installed and available"
    
    except Exception as e:
        logger.error(f"Error checking poppler installation: {str(e)}")
        # Continue anyway, we'll use fallbacks
        return True, f"Error checking poppler, will use fallbacks: {str(e)}"

def process_document(pdf_path):
    """
    Process a document using Anthropic Claude API to extract important tax information

    Args:
        pdf_path: Path to the PDF file

    Returns:
        dict: Extracted document data
    """
    try:
        # Check poppler installation
        poppler_installed, message = check_poppler_installation()
        logger.info(f"Poppler installation check: {poppler_installed}, {message}")
        
        # Convert PDF to image
        logger.info(f"Converting PDF to image: {pdf_path}")
        images = None
        
        # Try multiple approaches in order of preference
        approaches = [
            "direct_converter",  # Our bundled converter
            "pdf2image",         # Standard library with explicit poppler_path
            "command_line"       # Direct command line 
        ]
        
        error_messages = []
        
        for approach in approaches:
            try:
                logger.info(f"Trying approach: {approach}")
                
                if approach == "direct_converter":
                    # Use our direct converter that doesn't rely on environment variables
                    # On Windows, use a higher DPI (200) for better quality
                    windows_dpi = 200 if platform.system() == "Windows" else 150
                    images = convert_pdf_to_image(pdf_path, dpi=windows_dpi)
                    if images:
                        logger.info("Direct converter succeeded")
                        break
                
                elif approach == "pdf2image":
                    # Try standard pdf2image approach with explicit poppler_path
                    kwargs = {}
                    if os.environ.get('POPPLER_PATH'):
                        kwargs['poppler_path'] = os.environ.get('POPPLER_PATH')
                    
                    dpi = 200 if platform.system() == "Windows" else 150
                    images = convert_from_path(pdf_path, first_page=1, last_page=1, dpi=dpi, **kwargs)
                    if images:
                        logger.info("pdf2image succeeded")
                        break
                
                elif approach == "command_line":
                    # Try direct command line approach
                    tmp_output = os.path.join(os.path.dirname(pdf_path), "pdf_page.png")
                    pdftoppm_path = "pdftoppm"  # Try to use from PATH
                    
                    # Use POPPLER_PATH if available
                    if os.environ.get('POPPLER_PATH'):
                        pdftoppm_path = os.path.join(os.environ.get('POPPLER_PATH'), "pdftoppm")
                        if platform.system() == "Windows":
                            pdftoppm_path += ".exe"
                    
                    # For Windows, handle spaces in paths
                    if platform.system() == "Windows":
                        pdf_path_arg = f'"{pdf_path}"'
                        tmp_output_base = f'"{os.path.join(os.path.dirname(pdf_path), "pdf_page")}"'
                    else:
                        pdf_path_arg = pdf_path
                        tmp_output_base = os.path.join(os.path.dirname(pdf_path), "pdf_page")
                    
                    cmd = [pdftoppm_path, "-png", "-singlefile", "-f", "1", "-l", "1", str(pdf_path), tmp_output_base]
                    
                    # Log the command
                    logger.info(f"Running command: {' '.join(cmd)}")
                    
                    subprocess.run(cmd, check=True)
                    
                    if os.path.exists(tmp_output):
                        from PIL import Image
                        images = [Image.open(tmp_output)]
                        logger.info("Command line approach succeeded")
                        # Clean up temp file
                        try:
                            os.remove(tmp_output)
                        except:
                            pass
                        break
            
            except Exception as e:
                error_msg = str(e)
                error_messages.append(f"Approach '{approach}' failed: {error_msg}")
                logger.warning(f"Approach '{approach}' failed: {error_msg}")
                continue
        
        # If all approaches failed, create a fallback image with error message
        if not images:
            error_msg = "All PDF conversion approaches failed: " + "; ".join(error_messages)
            logger.error(error_msg)
            
            # Create a fallback image with error text
            error_text = f"Could not convert PDF.\nFile: {pdf_path}\nErrors: {error_msg}"
            images = [create_text_image(error_text)]
            logger.info("Created fallback image with error message")

        # Encode image to base64
        buffered = io.BytesIO()
        images[0].save(buffered, format="PNG")
        image_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')

        # Initialize Anthropic client
        client = anthropic.Anthropic()

        # Enhanced prompt for better document analysis and concise naming
        prompt = """
        Please analyze this financial document and extract the following information. For document type, use SHORT, CLEAR names (avoid long descriptions):

        1. Document type - Use CONCISE terms like: W-2, 1099-INT, Bank-Statement, Investment-Statement, etc. (NOT long descriptions)
        2. Account holder/Client name
        3. Statement period or tax year (just the year like "2023" or date range like "2023-Q4")
        4. Financial institution name (shortened if very long)
        5. Account number (last 4 digits or masked)
        6. Total account value/balance (if applicable)

        IMPORTANT: Keep document type to 3 words or less. Use standard abbreviations.

        Format your response exactly as follows:
        Document type: [SHORT TYPE]
        Client name: [NAME]
        Period/Year: [PERIOD]
        Institution: [INSTITUTION]
        Account number: [NUMBER]
        Total value: [AMOUNT]
        """

        logger.info(f"Sending document to Anthropic Claude for analysis: {pdf_path}")

        # Call Anthropic Claude API with error handling
        response = None
        for attempt in range(config.API_MAX_RETRIES):
            try:
                response = client.messages.create(
                    model=config.ANTHROPIC_MODEL,
                    max_tokens=config.MAX_TOKENS,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": prompt
                                },
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": "image/png",
                                        "data": image_base64
                                    }
                                }
                            ]
                        }
                    ]
                )
                break
            except Exception as api_error:
                if attempt < config.API_MAX_RETRIES - 1:
                    # Calculate backoff time (1s, 2s, 4s...)
                    backoff = 2 ** attempt
                    logger.warning(f"API call failed (attempt {attempt+1}/{config.API_MAX_RETRIES}). Retrying in {backoff}s: {str(api_error)}")
                    time.sleep(backoff)
                else:
                    logger.error(f"API call failed after {config.API_MAX_RETRIES} attempts")
                    raise

        # Extract text from response
        extracted_text = response.content[0].text
        logger.info(f"Received Claude response for {pdf_path}")

        # Parse the extracted text with enhanced parsing
        document_data = parse_ai_response(extracted_text)
        logger.info(f"Extracted data: {document_data}")

        return document_data

    except Exception as e:
        logger.error(f"Error processing document {pdf_path}: {str(e)}")
        raise

def parse_ai_response(text):
    """
    Parse the AI response into a structured dictionary with enhanced cleaning

    Args:
        text: Text response from Claude

    Returns:
        dict: Structured document data
    """
    data = {
        'document_type': '',
        'client_name': '',
        'period_year': '',
        'institution': '',
        'account_number': '',
        'total_value': '',
        'raw_ai_response': text  # Store the raw response for debugging
    }

    # Parse line by line
    lines = text.split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Extract document type with cleaning
        if "document type:" in line.lower():
            doc_type = line.split(":", 1)[1].strip()
            # Clean up verbose document types
            doc_type = clean_document_type(doc_type)
            data['document_type'] = doc_type

        # Extract client name
        elif "client name:" in line.lower() or "recipient" in line.lower():
            client_name = line.split(":", 1)[1].strip()
            # Clean up client name
            client_name = clean_client_name(client_name)
            data['client_name'] = client_name

        # Extract period/year
        elif "period" in line.lower() or "year" in line.lower():
            period = line.split(":", 1)[1].strip()
            # Clean up period format
            period = clean_period(period)
            data['period_year'] = period

        # Extract institution
        elif "institution" in line.lower() or "payer" in line.lower():
            institution = line.split(":", 1)[1].strip()
            # Clean up institution name
            institution = clean_institution_name(institution)
            data['institution'] = institution

        # Extract account number
        elif "account number" in line.lower():
            data['account_number'] = line.split(":", 1)[1].strip()

        # Extract total value
        elif "total value" in line.lower() or "balance" in line.lower():
            data['total_value'] = line.split(":", 1)[1].strip()

    return data

def clean_document_type(doc_type):
    """Clean and standardize document type"""
    if not doc_type:
        return "Document"
    
    # Remove common prefixes and clean up
    doc_type = doc_type.replace("Form ", "").replace("IRS ", "").replace("Tax ", "")
    
    # Common standardizations
    standardizations = {
        'wage and tax statement': 'W-2',
        'wages and tax statement': 'W-2',
        'w2': 'W-2',
        'interest income statement': '1099-INT',
        'dividend income statement': '1099-DIV',
        'retirement distribution statement': '1099-R',
        'miscellaneous income': '1099-MISC',
        'bank account statement': 'Bank-Statement',
        'checking account statement': 'Checking-Statement',
        'savings account statement': 'Savings-Statement',
        'investment account statement': 'Investment-Statement',
        'brokerage account statement': 'Brokerage-Statement',
        'mortgage interest statement': '1098',
        'property tax statement': 'Property-Tax',
    }
    
    doc_lower = doc_type.lower()
    for key, value in standardizations.items():
        if key in doc_lower:
            return value
    
    # If no match, limit to first 3 words
    words = doc_type.split()
    if len(words) > 3:
        return ' '.join(words[:3])
    
    return doc_type

def clean_client_name(client_name):
    """Clean client name"""
    if not client_name:
        return "Unknown"
    
    # Remove common suffixes and prefixes
    client_name = client_name.replace("Mr. ", "").replace("Mrs. ", "").replace("Ms. ", "")
    client_name = client_name.replace(" Jr.", "").replace(" Sr.", "").replace(" III", "")
    
    return client_name.strip()

def clean_period(period):
    """Clean and standardize period/year"""
    if not period:
        return "Unknown"
    
    # Extract year if present
    import re
    year_match = re.search(r'20\d{2}', period)
    if year_match:
        return year_match.group()
    
    # Look for quarter references
    if 'q1' in period.lower() or 'first quarter' in period.lower():
        year = re.search(r'20\d{2}', period)
        return f"{year.group() if year else '2023'}-Q1"
    elif 'q2' in period.lower() or 'second quarter' in period.lower():
        year = re.search(r'20\d{2}', period)
        return f"{year.group() if year else '2023'}-Q2"
    elif 'q3' in period.lower() or 'third quarter' in period.lower():
        year = re.search(r'20\d{2}', period)
        return f"{year.group() if year else '2023'}-Q3"
    elif 'q4' in period.lower() or 'fourth quarter' in period.lower():
        year = re.search(r'20\d{2}', period)
        return f"{year.group() if year else '2023'}-Q4"
    
    return period[:20]  # Limit length

def clean_institution_name(institution):
    """Clean institution name"""
    if not institution:
        return "Unknown"
    
    # Common bank name standardizations
    standardizations = {
        'bank of america': 'BofA',
        'wells fargo': 'Wells-Fargo',
        'jp morgan chase': 'Chase',
        'jpmorgan chase': 'Chase',
        'american express': 'AmEx',
        'charles schwab': 'Schwab',
        'morgan stanley': 'Morgan-Stanley',
        'goldman sachs': 'Goldman',
        'td ameritrade': 'TD-Ameritrade',
    }
    
    inst_lower = institution.lower()
    for key, value in standardizations.items():
        if key in inst_lower:
            return value
    
    # If no match, limit to first 2 words
    words = institution.split()
    if len(words) > 2:
        return '-'.join(words[:2])
    
    return institution
