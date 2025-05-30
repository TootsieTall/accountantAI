import os
import json
import time
import logging
import re
import sys
import io
import platform
from datetime import datetime
from pathlib import Path
import config

def setup_logging():
    """Set up logging configuration"""
    # Create logs directory if it doesn't exist
    config.LOG_DIR.mkdir(parents=True, exist_ok=True)
    
    # Create log file with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = config.LOG_DIR / f"processing_{timestamp}.log"
    
    # On Windows, use basic ASCII logging only - most reliable solution
    is_windows = platform.system() == "Windows"
    
    # Configure logging with UTF-8 encoding for file handler
    # On Windows, use a more basic configuration that avoids Unicode characters
    handlers = [logging.FileHandler(log_file, encoding='utf-8')]
    
    # Add StreamHandler with appropriate encoding
    if is_windows:
        # On Windows, use basic StreamHandler with backslashreplace for encoding errors
        handlers.append(logging.StreamHandler())
    else:
        # On non-Windows, we can use UTF-8 
        handlers.append(logging.StreamHandler())
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=handlers
    )
    
    logger = logging.getLogger(__name__)
    
    # Log platform info for debugging
    logger.info(f"Platform: {platform.system()} {platform.release()}")
    logger.info(f"Python version: {platform.python_version()}")
    if is_windows:
        logger.info(f"Console encoding: {sys.stdout.encoding}")
        logger.info("Using ASCII-only symbols for Windows compatibility")
    
    return logger

def save_checkpoint(processed_paths):
    """Save checkpoint of processed files"""
    checkpoint_path = config.DATA_DIR / "checkpoint.json"
    
    with open(checkpoint_path, 'w', encoding='utf-8') as f:
        json.dump(processed_paths, f, ensure_ascii=True)

def load_checkpoint():
    """Load checkpoint of processed files"""
    checkpoint_path = config.DATA_DIR / "checkpoint.json"
    
    if not checkpoint_path.exists():
        return []
    
    try:
        with open(checkpoint_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading checkpoint: {e}")
        return []

def save_failed_list(failed_paths):
    """Save list of failed documents"""
    if not failed_paths:
        return None
        
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    failed_path = config.LOG_DIR / f"failed_{timestamp}.json"
    
    with open(failed_path, 'w', encoding='utf-8') as f:
        json.dump(failed_paths, f, ensure_ascii=True)
    
    return str(failed_path)

def simplify_document_type(doc_type):
    """
    Simplify verbose document types to more concise names
    """
    if not doc_type or doc_type.lower() == 'unknown':
        return "Document"
    
    # Convert to lowercase for comparison
    doc_lower = doc_type.lower()
    
    # Document type mapping for common verbose descriptions
    type_mappings = {
        # Tax documents
        'w-2': 'W2',
        'w2': 'W2',
        'wage and tax statement': 'W2',
        '1099': '1099',
        '1099-int': '1099-INT',
        '1099-div': '1099-DIV',
        '1099-r': '1099-R',
        '1099-misc': '1099-MISC',
        'interest statement': '1099-INT',
        'dividend statement': '1099-DIV',
        'retirement distribution': '1099-R',
        
        # Bank statements
        'bank statement': 'Bank-Statement',
        'checking account statement': 'Checking-Statement',
        'savings account statement': 'Savings-Statement',
        'account statement': 'Account-Statement',
        'monthly statement': 'Monthly-Statement',
        
        # Investment documents
        'investment statement': 'Investment-Statement',
        'brokerage statement': 'Brokerage-Statement',
        'portfolio statement': 'Portfolio-Statement',
        '401k statement': '401k-Statement',
        'retirement account statement': 'Retirement-Statement',
        
        # Mortgage and loans
        'mortgage statement': 'Mortgage-Statement',
        'loan statement': 'Loan-Statement',
        '1098': '1098',
        'mortgage interest statement': '1098',
        
        # Business documents
        'invoice': 'Invoice',
        'receipt': 'Receipt',
        'business expense': 'Business-Expense',
        
        # Insurance
        'insurance statement': 'Insurance-Statement',
        'policy statement': 'Policy-Statement',
        
        # Property
        'property tax': 'Property-Tax',
        'real estate': 'Real-Estate',
        
        # General
        'tax document': 'Tax-Document',
        'financial statement': 'Financial-Statement',
        'year end summary': 'Year-End-Summary',
    }
    
    # Check for exact matches first
    for key, simplified in type_mappings.items():
        if key in doc_lower:
            return simplified
    
    # If no mapping found, use the intelligent word limiting
    return limit_words_intelligently(doc_type, max_words=4)

def limit_words_intelligently(text, max_words=5):
    """
    Limit text to a maximum number of words while preserving meaning
    """
    if not text:
        return "Unknown"
    
    # Split into words and remove empty ones
    words = [word.strip() for word in text.split() if word.strip()]
    
    if len(words) <= max_words:
        return ' '.join(words)
    
    # If we have too many words, try to keep the most important ones
    # Priority: Keep first few words and any numbers/years
    important_words = []
    
    # Always keep the first 2-3 words as they're usually the most descriptive
    important_words.extend(words[:min(3, len(words))])
    
    # Add any remaining words that contain numbers (like years, account numbers, etc.)
    for word in words[3:]:
        if re.search(r'\d', word) and len(important_words) < max_words:
            important_words.append(word)
    
    # If we still have space, add other important-looking words
    if len(important_words) < max_words:
        for word in words[3:]:
            if (word.lower() in ['statement', 'summary', 'report', 'tax', 'year', 'annual', 'quarterly', 'monthly'] 
                and word not in important_words 
                and len(important_words) < max_words):
                important_words.append(word)
    
    # If we still don't have enough words, just take the first max_words
    if len(important_words) < max_words:
        important_words = words[:max_words]
    
    return ' '.join(important_words[:max_words])

def clean_filename(name, is_client_name=False):
    """
    Clean a string to be suitable for a filename
    
    Args:
        name: The string to clean
        is_client_name: If True, applies stricter rules to prevent subdirectory creation
    """
    if not name:
        return "unknown"
    
    # For client names, we need to be extra careful about directory separators
    if is_client_name:
        # Remove any potential path separators completely
        name = re.sub(r'[/\\]+', '_', name)
        # Remove any characters that could cause issues
        name = re.sub(r'[<>:"|?*]', '_', name)
    
    # Replace special characters with underscores (but preserve hyphens and periods)
    cleaned = re.sub(r'[^\w\s.-]', '_', name)
    
    # Replace multiple whitespace with single underscores
    cleaned = re.sub(r'\s+', '_', cleaned)
    
    # Replace multiple underscores with single underscore
    cleaned = re.sub(r'_+', '_', cleaned)
    
    # Remove leading/trailing underscores and periods
    cleaned = cleaned.strip('_.')
    
    # For client names, ensure we don't have any path-like structures
    if is_client_name:
        # Split by any remaining path separators and take only the last part
        cleaned = cleaned.split('/')[-1].split('\\')[-1]
    
    # Truncate if too long (keeping it shorter for better readability)
    max_length = 50 if is_client_name else 80
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length].rstrip('_.')
    
    # Ensure not empty
    if not cleaned:
        cleaned = "unknown"
    
    return cleaned

def create_safe_filename(doc_type, period, institution=None, max_total_length=100):
    """
    Create a safe filename with intelligent length management
    
    Args:
        doc_type: Document type from AI
        period: Period/year from AI  
        institution: Institution name (optional)
        max_total_length: Maximum total filename length
    
    Returns:
        str: Safe filename without extension
    """
    # Simplify the document type first
    doc_simplified = simplify_document_type(doc_type)
    doc_clean = clean_filename(doc_simplified)
    
    # Clean the period
    period_clean = clean_filename(period) if period else "unknown"
    
    # Start with basic format
    if institution and institution.strip() and institution.lower() != 'unknown':
        institution_clean = clean_filename(institution)
        # Limit institution name to prevent overly long filenames
        if len(institution_clean) > 20:
            institution_clean = institution_clean[:20].rstrip('_.')
        
        base_filename = f"{doc_clean}_{institution_clean}_{period_clean}"
    else:
        base_filename = f"{doc_clean}_{period_clean}"
    
    # If still too long, truncate intelligently
    if len(base_filename) > max_total_length:
        # Prioritize doc_type and period over institution
        if institution:
            # Calculate how much space we have for institution
            base_length = len(f"{doc_clean}_{period_clean}")
            remaining_space = max_total_length - base_length - 1  # -1 for underscore
            
            if remaining_space > 5:  # Only include institution if we have meaningful space
                institution_truncated = institution_clean[:remaining_space].rstrip('_.')
                base_filename = f"{doc_clean}_{institution_truncated}_{period_clean}"
            else:
                base_filename = f"{doc_clean}_{period_clean}"
        
        # Final truncation if still too long
        if len(base_filename) > max_total_length:
            base_filename = base_filename[:max_total_length].rstrip('_.')
    
    return base_filename

def ensure_directories():
    """Ensure all required directories exist"""
    # Create base directories
    for dir_path in [config.SOURCE_DIR, config.PROCESSED_DIR, config.LOG_DIR]:
        dir_path.mkdir(parents=True, exist_ok=True)
        print(f"Ensured directory exists: {dir_path}")

# Ensure directories exist when module is imported
ensure_directories()
