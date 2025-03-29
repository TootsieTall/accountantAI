import os
import logging
import base64
import io
import time
import subprocess
import sys
import platform
from pathlib import Path
from pdf2image import convert_from_path
import anthropic
import config

logger = logging.getLogger(__name__)

def check_poppler_installation():
    """Check if poppler is installed and available in PATH"""
    system = platform.system()
    try:
        if system == "Darwin":  # macOS
            # Try to locate poppler using which command
            result = subprocess.run(['which', 'pdftoppm'], capture_output=True, text=True)
            if result.returncode != 0:
                return False, "Poppler is not installed. Install it using: brew install poppler"
        elif system == "Windows":
            # Check if poppler is in PATH or in standard locations
            poppler_path = os.environ.get('POPPLER_PATH')
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
                        found = True
                        break
                if not found:
                    return False, "Poppler is not installed or not in PATH. Download from http://blog.alivate.com.au/poppler-windows/ and add to PATH"
        else:  # Linux and others
            result = subprocess.run(['which', 'pdftoppm'], capture_output=True, text=True)
            if result.returncode != 0:
                return False, "Poppler is not installed. Install it using your package manager (e.g., apt-get install poppler-utils)"
        
        return True, "Poppler is installed and available"
    
    except Exception as e:
        return False, f"Error checking poppler installation: {str(e)}"

def process_document(pdf_path):
    """
    Process a document using Anthropic Claude API to extract important tax information

    Args:
        pdf_path: Path to the PDF file

    Returns:
        dict: Extracted document data
    """
    try:
        # Check poppler installation first
        poppler_installed, message = check_poppler_installation()
        if not poppler_installed:
            logger.error(f"Poppler dependency error: {message}")
            raise Exception(f"PDF processing dependency not found: {message}")

        # Convert PDF to image with retries
        logger.info(f"Converting PDF to image: {pdf_path}")
        images = None
        pdf_conversion_retries = 3

        for attempt in range(pdf_conversion_retries):
            try:
                # On macOS, try to set DPI lower to avoid memory issues
                dpi = 150 if platform.system() == "Darwin" else 200
                images = convert_from_path(pdf_path, first_page=1, last_page=1, dpi=dpi)
                break
            except Exception as e:
                if attempt < pdf_conversion_retries - 1:
                    logger.warning(f"PDF conversion failed (attempt {attempt+1}/{pdf_conversion_retries}). Retrying: {str(e)}")
                    time.sleep(1)
                else:
                    logger.error(f"PDF conversion failed after {pdf_conversion_retries} attempts")
                    raise

        # Encode image to base64
        buffered = io.BytesIO()
        images[0].save(buffered, format="PNG")
        image_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')

        # Initialize Anthropic client
        client = anthropic.Anthropic()

        # Prepare prompt for document analysis
        prompt = """
        Please analyze this financial document and extract the following information:

        1. Document type (e.g., W-2, 1099-INT, 1099-R, Investment Statement, Account Summary, etc.)
        2. Account holder/Client name
        3. Statement period or tax year
        4. Financial institution name
        5. Account number (last 4 digits or masked)
        6. Total account value/balance (if applicable)

        Format your response exactly as follows, with each item on a new line:
        Document type: [type]
        Client name: [name]
        Period/Year: [period]
        Institution: [name]
        Account number: [number]
        Total value: [amount]
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

        # Parse the extracted text
        document_data = parse_ai_response(extracted_text)
        logger.info(f"Extracted data: {document_data}")

        return document_data

    except Exception as e:
        logger.error(f"Error processing document {pdf_path}: {str(e)}")
        raise

def parse_ai_response(text):
    """
    Parse the AI response into a structured dictionary

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

        # Extract document type
        if "document type:" in line.lower():
            data['document_type'] = line.split(":", 1)[1].strip()

        # Extract client name
        elif "client name:" in line.lower() or "recipient" in line.lower():
            data['client_name'] = line.split(":", 1)[1].strip()

        # Extract period/year
        elif "period" in line.lower() or "year" in line.lower():
            data['period_year'] = line.split(":", 1)[1].strip()

        # Extract institution
        elif "institution" in line.lower() or "payer" in line.lower():
            data['institution'] = line.split(":", 1)[1].strip()

        # Extract account number
        elif "account number" in line.lower():
            data['account_number'] = line.split(":", 1)[1].strip()

        # Extract total value
        elif "total value" in line.lower() or "balance" in line.lower():
            data['total_value'] = line.split(":", 1)[1].strip()

    return data
