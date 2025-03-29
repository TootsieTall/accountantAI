import os
import shutil
import time
from pathlib import Path
import logging
import config
from src.utils import clean_filename

logger = logging.getLogger(__name__)

def get_source_documents():
    """Get all PDF files from source directory"""
    return list(config.SOURCE_DIR.glob('*.pdf'))

def safe_copy_file(source, destination, max_retries=config.COPY_MAX_RETRIES):
    """Copy a file with retries"""
    for attempt in range(max_retries):
        try:
            # Ensure destination directory exists
            destination.parent.mkdir(parents=True, exist_ok=True)

            # Copy the file
            shutil.copy2(source, destination)
            return True
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"File copy failed (attempt {attempt+1}/{max_retries}). Retrying: {str(e)}")
                time.sleep(1)  # Wait before retry
            else:
                logger.error(f"File copy failed after {max_retries} attempts")
                raise Exception(f"Failed to copy file after {max_retries} attempts: {str(e)}")

def delete_source_file(source_path):
    """Delete a source file with error handling"""
    try:
        if source_path.exists():
            source_path.unlink()
            logger.info(f"Deleted source file: {source_path}")
            return True
        else:
            logger.warning(f"Source file not found for deletion: {source_path}")
            return False
    except Exception as e:
        logger.error(f"Error deleting source file {source_path}: {str(e)}")
        return False

def organize_document(pdf_path, document_data, client_folder_name=None):
    """
    Organize a document based on extracted data into client directory
    """
    try:
        # Extract key fields with fallbacks for missing data
        doc_type = document_data.get('document_type', 'unknown')
        period = document_data.get('period_year', 'unknown')
        institution = document_data.get('institution', 'unknown')

        # Use client_folder_name if provided, otherwise fall back to extracted name
        if client_folder_name and client_folder_name.strip():
            client_clean = clean_filename(client_folder_name)
            logger.info(f"Using provided client name: {client_folder_name} -> {client_clean}")
        else:
            client_name = document_data.get('client_name', 'unknown')
            client_clean = clean_filename(client_name)
            logger.info(f"Using extracted client name: {client_name} -> {client_clean}")

        # Clean up names for filesystem use
        doc_type_clean = clean_filename(doc_type)
        institution_clean = clean_filename(institution)

        # Create directory structure with absolute paths to ensure consistency
        client_dir = config.PROCESSED_DIR / client_clean
        client_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created client directory: {client_dir}")

        # Create new filename
        new_filename = f"{client_clean}_{doc_type_clean}_{period}.pdf"
        dest_path = client_dir / new_filename
        
        # Log the paths for debugging
        logger.info(f"Source path: {pdf_path}, Destination path: {dest_path}")

        # Copy the file with more retry attempts
        safe_copy_file(pdf_path, dest_path, max_retries=5)
        logger.info(f"File copied successfully: {dest_path}")
        
        # Delete the source file after successful processing
        delete_source_file(pdf_path)

        return {
            'success': True,
            'original_path': str(pdf_path),
            'new_path': str(dest_path),
            'metadata': document_data
        }

    except Exception as e:
        logger.error(f"Error organizing file {pdf_path}: {str(e)}")
        return {
            'success': False,
            'original_path': str(pdf_path),
            'error': str(e)
        }
