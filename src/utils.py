import os
import json
import time
import logging
import re
import sys
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
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler()
        ]
    )
    
    # Set console encoding to utf-8 if on Windows
    if os.name == 'nt':
        try:
            # Try to set console mode to support UTF-8 output
            os.system('chcp 65001 > NUL')
        except:
            # If that fails, we'll rely on the ASCII fallbacks in the code
            pass
    
    return logging.getLogger(__name__)

def save_checkpoint(processed_paths):
    """Save checkpoint of processed files"""
    checkpoint_path = config.DATA_DIR / "checkpoint.json"
    
    with open(checkpoint_path, 'w') as f:
        json.dump(processed_paths, f)

def load_checkpoint():
    """Load checkpoint of processed files"""
    checkpoint_path = config.DATA_DIR / "checkpoint.json"
    
    if not checkpoint_path.exists():
        return []
    
    try:
        with open(checkpoint_path, 'r') as f:
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
    
    with open(failed_path, 'w') as f:
        json.dump(failed_paths, f)
    
    return str(failed_path)

def save_metadata(path, data):
    """Save metadata JSON file (only in metadata directory)"""
    # Ensure the directory exists
    path.parent.mkdir(parents=True, exist_ok=True)
    
    # Log to the logger, not to console
    logger = logging.getLogger(__name__)
    logger.info(f"Saving metadata to: {path}")
    
    # Make sure we're only saving to metadata directory
    if not str(path).startswith(str(config.METADATA_DIR)):
        logger.warning(f"Attempted to save metadata outside of metadata directory: {path}")
        path = config.METADATA_DIR / path.name
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def clean_filename(name):
    """Clean a string to be suitable for a filename"""
    if not name:
        return "unknown"
        
    # Replace special characters with underscores
    cleaned = re.sub(r'[^\w\s-]', '_', name)
    # Replace whitespace with underscores
    cleaned = re.sub(r'[\s]+', '_', cleaned)
    # Truncate if too long
    if len(cleaned) > 100:
        cleaned = cleaned[:100]
    # Ensure not empty
    if not cleaned:
        cleaned = "unknown"
    
    return cleaned

def ensure_directories():
    """Ensure all required directories exist"""
    # Create base directories
    for dir_path in [config.SOURCE_DIR, config.PROCESSED_DIR, config.METADATA_DIR, config.LOG_DIR]:
        dir_path.mkdir(parents=True, exist_ok=True)
        print(f"Ensured directory exists: {dir_path}")

# Ensure directories exist when module is imported
ensure_directories()
