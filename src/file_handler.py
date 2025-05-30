import os
import shutil
import time
from pathlib import Path
import logging
import config
from src.utils import clean_filename, create_safe_filename
import platform
import json

logger = logging.getLogger(__name__)

# Define a simple ASCII arrow for Windows
ARROW_SYMBOL = "->"

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

def sanitize_client_name(client_name):
    """
    Sanitize client name to prevent nested folder creation
    
    Args:
        client_name: Raw client name from AI or user input
        
    Returns:
        str: Clean client name safe for directory creation
    """
    if not client_name or not client_name.strip():
        return "Unknown_Client"
    
    # Use the enhanced clean_filename function with client-specific rules
    cleaned = clean_filename(client_name, is_client_name=True)
    
    # Additional safety checks for client names
    # Remove any remaining path-like patterns
    cleaned = cleaned.replace('..', '_')  # Prevent parent directory access
    cleaned = cleaned.replace('.', '_')   # Remove periods that could cause issues
    
    # Ensure it doesn't start with special characters
    if cleaned.startswith(('_', '-')):
        cleaned = 'Client_' + cleaned.lstrip('_-')
    
    # Final validation - must be a simple name
    if '/' in cleaned or '\\' in cleaned:
        logger.warning(f"Client name still contains path separators after cleaning: {cleaned}")
        # Extract just the final component
        cleaned = cleaned.replace('/', '_').replace('\\', '_')
    
    return cleaned

def organize_document(pdf_path, document_data, client_folder_name=None):
    """
    Organize a document based on extracted data into client directory
    Ensures proper single-level directory structure
    """
    try:
        # Extract key fields with fallbacks for missing data
        doc_type = document_data.get('document_type', 'unknown')
        period = document_data.get('period_year', 'unknown')
        institution = document_data.get('institution', 'unknown')

        # Determine client name with proper sanitization
        if client_folder_name and client_folder_name.strip():
            raw_client_name = client_folder_name.strip()
            logger.info(f"Using provided client name: {raw_client_name}")
        else:
            raw_client_name = document_data.get('client_name', 'unknown')
            logger.info(f"Using extracted client name: {raw_client_name}")

        # Sanitize client name to prevent nested folders
        client_clean = sanitize_client_name(raw_client_name)
        logger.info(f"Sanitized client name: {raw_client_name} {ARROW_SYMBOL} {client_clean}")

        # Create safe filename using enhanced logic
        safe_base_filename = create_safe_filename(
            doc_type=doc_type,
            period=period,
            institution=institution,
            max_total_length=90  # Leave room for .pdf extension
        )
        
        # Create the final filename
        new_filename = f"{safe_base_filename}.pdf"
        
        # Log the filename creation process
        logger.info(f"Document type: '{doc_type}' {ARROW_SYMBOL} Safe filename base: '{safe_base_filename}'")

        # Create ONLY the client directory - no subdirectories
        client_dir = config.PROCESSED_DIR / client_clean
        
        # Ensure we're creating exactly one level under PROCESSED_DIR
        if client_dir.parent != config.PROCESSED_DIR:
            logger.error(f"Invalid client directory structure: {client_dir}")
            # Force correction - use only the final component
            client_dir = config.PROCESSED_DIR / client_clean.split('/')[-1].split('\\')[-1]
            logger.warning(f"Corrected to: {client_dir}")
        
        # Create the client directory
        client_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created/verified client directory: {client_dir}")
        
        # Verify directory structure is correct
        relative_path = client_dir.relative_to(config.PROCESSED_DIR)
        if '/' in str(relative_path) or '\\' in str(relative_path):
            raise Exception(f"Nested directories detected: {relative_path}. Only single client folder allowed.")

        # Create destination paths
        dest_path = client_dir / new_filename
        json_path = client_dir / f"{safe_base_filename}.json"
        
        # Log the full organization process
        logger.info(f"Source: {pdf_path}")
        logger.info(f"Destination: {dest_path}")
        logger.info(f"Directory structure: processed/{client_clean}/{new_filename}")

        # Check if file already exists and create unique name if needed
        counter = 1
        original_dest_path = dest_path
        original_json_path = json_path
        
        while dest_path.exists():
            # Create unique filename by adding counter
            name_without_ext = safe_base_filename
            new_filename_unique = f"{name_without_ext}_{counter:02d}.pdf"
            json_filename_unique = f"{name_without_ext}_{counter:02d}.json"
            
            dest_path = client_dir / new_filename_unique
            json_path = client_dir / json_filename_unique
            counter += 1
            
            # Prevent infinite loop
            if counter > 100:
                logger.error(f"Too many duplicate files, using timestamp")
                timestamp = int(time.time())
                new_filename_unique = f"{name_without_ext}_{timestamp}.pdf"
                json_filename_unique = f"{name_without_ext}_{timestamp}.json"
                dest_path = client_dir / new_filename_unique
                json_path = client_dir / json_filename_unique
                break

        # Copy the file with retry logic
        safe_copy_file(pdf_path, dest_path, max_retries=5)
        logger.info(f"File copied successfully: {dest_path}")
        
        # Save metadata as JSON with enhanced information
        try:
            # Create enhanced metadata with processing info
            enhanced_metadata = {
                **document_data,  # Original extracted data
                'processing_info': {
                    'original_filename': pdf_path.name,
                    'processed_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'client_folder': client_clean,
                    'safe_filename': safe_base_filename,
                    'final_filename': dest_path.name,
                    'directory_structure_verified': True
                }
            }
            
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(enhanced_metadata, f, indent=4, ensure_ascii=True)
            logger.info(f"Enhanced metadata saved to: {json_path}")
        except Exception as e:
            logger.warning(f"Could not save metadata file: {e}")
        
        # Final verification of directory structure
        final_relative_path = dest_path.relative_to(config.PROCESSED_DIR)
        path_parts = str(final_relative_path).replace('\\', '/').split('/')
        
        if len(path_parts) != 2:  # Should be exactly: client_name/filename.pdf
            logger.error(f"Invalid final directory structure: {final_relative_path}")
            logger.error(f"Path parts: {path_parts}")
            raise Exception(f"Directory structure validation failed. Expected 2 parts, got {len(path_parts)}")
        
        logger.info(f"Directory structure validation passed: {path_parts[0]}/{path_parts[1]}")
        
        # Delete the source file after successful processing
        delete_source_file(pdf_path)

        return {
            'success': True,
            'original_path': str(pdf_path),
            'new_path': str(dest_path),
            'client_folder': client_clean,
            'final_filename': dest_path.name,
            'metadata': enhanced_metadata,
            'directory_structure': f"processed/{client_clean}/{dest_path.name}"
        }

    except Exception as e:
        logger.error(f"Error organizing file {pdf_path}: {str(e)}")
        return {
            'success': False,
            'original_path': str(pdf_path),
            'error': str(e)
        }

def validate_processed_directory_structure():
    """
    Validate that the processed directory has the correct structure
    and fix any issues found
    """
    logger.info("Validating processed directory structure...")
    
    issues_found = []
    fixes_applied = []
    
    try:
        # Check if processed directory exists
        if not config.PROCESSED_DIR.exists():
            logger.info("Processed directory doesn't exist yet - this is normal for first run")
            return []
        
        # Scan all items in processed directory
        for item in config.PROCESSED_DIR.iterdir():
            if item.is_file():
                # Files should not be directly in processed directory
                issues_found.append(f"File found in root processed directory: {item.name}")
                
                # Try to move orphaned files to an "Uncategorized" folder
                uncategorized_dir = config.PROCESSED_DIR / "Uncategorized"
                uncategorized_dir.mkdir(exist_ok=True)
                
                try:
                    shutil.move(str(item), str(uncategorized_dir / item.name))
                    fixes_applied.append(f"Moved {item.name} to Uncategorized folder")
                except Exception as e:
                    logger.error(f"Could not move file {item.name}: {e}")
            
            elif item.is_dir():
                # Check for nested directories within client folders
                client_folder_name = item.name
                
                for sub_item in item.iterdir():
                    if sub_item.is_dir():
                        # Found a subdirectory within a client folder
                        issues_found.append(f"Nested directory found: {client_folder_name}/{sub_item.name}")
                        
                        # Try to flatten the structure
                        try:
                            # Move all files from the subdirectory to the parent client folder
                            for nested_file in sub_item.iterdir():
                                if nested_file.is_file():
                                    target_path = item / nested_file.name
                                    
                                    # Avoid naming conflicts
                                    counter = 1
                                    while target_path.exists():
                                        name_parts = nested_file.name.rsplit('.', 1)
                                        if len(name_parts) == 2:
                                            target_name = f"{name_parts[0]}_{counter:02d}.{name_parts[1]}"
                                        else:
                                            target_name = f"{nested_file.name}_{counter:02d}"
                                        target_path = item / target_name
                                        counter += 1
                                    
                                    shutil.move(str(nested_file), str(target_path))
                                    fixes_applied.append(f"Moved {nested_file.name} from {sub_item.name} to {client_folder_name}")
                            
                            # Remove empty subdirectory
                            if not any(sub_item.iterdir()):
                                sub_item.rmdir()
                                fixes_applied.append(f"Removed empty subdirectory: {client_folder_name}/{sub_item.name}")
                                
                        except Exception as e:
                            logger.error(f"Could not flatten directory {client_folder_name}/{sub_item.name}: {e}")
        
        # Log results
        if issues_found:
            logger.warning(f"Found {len(issues_found)} directory structure issues:")
            for issue in issues_found:
                logger.warning(f"  - {issue}")
        
        if fixes_applied:
            logger.info(f"Applied {len(fixes_applied)} fixes:")
            for fix in fixes_applied:
                logger.info(f"  - {fix}")
        
        if not issues_found:
            logger.info("Directory structure validation passed - no issues found")
        
        return issues_found
        
    except Exception as e:
        logger.error(f"Error during directory structure validation: {e}")
        return [f"Validation error: {e}"]
