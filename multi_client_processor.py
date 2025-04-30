"""
Multi-client document processor for AccountantAI.

This script processes PDF documents for multiple clients simultaneously,
extracting relevant information and organizing them into appropriate client folders.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import logging
import time
import random
from tqdm import tqdm
from datetime import datetime
import platform
import shutil
import subprocess
import io
import json

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Force Windows to use ASCII symbols only
SYMBOLS = {
    'success': "[OK]",
    'error': "[X]",
    'warning': "[!]",
    'arrow': "->"
}

# Load environment variables
load_dotenv()

# Import the project modules
from src.path_resolver import setup_poppler_path
from src.utils import setup_logging, save_checkpoint, load_checkpoint, save_failed_list
from src.file_handler import get_source_documents, safe_copy_file, delete_source_file
from src.ai_processor import process_document, check_poppler_installation
import config

def organize_document_multi_client(pdf_path, document_data):
    """
    Organize a document for multiple clients based on extracted data.
    This is a modified version of file_handler.organize_document that doesn't
    rely on a predefined client name.
    
    Args:
        pdf_path: Path to the PDF file
        document_data: Extracted document information from AI
        
    Returns:
        dict: Result information
    """
    try:
        # Extract key fields with fallbacks for missing data
        doc_type = document_data.get('document_type', 'unknown')
        period = document_data.get('period_year', 'unknown')
        institution = document_data.get('institution', 'unknown')
        
        # Use client name from document data
        client_name = document_data.get('client_name', 'unknown')
        
        # Check if client name is missing or 'unknown'
        if not client_name or client_name.lower() == 'unknown':
            # If client name is missing, try to derive it from the filename
            filename = pdf_path.stem
            # Remove common prefixes/suffixes and underscores
            potential_name = filename.split('_')[0] if '_' in filename else filename
            # If potential name is at least 3 characters, use it
            if len(potential_name) >= 3:
                client_name = potential_name
                logger.info(f"Using derived client name from filename: {client_name}")
            else:
                client_name = "unidentified_client"
                logger.warning(f"Could not determine client name for {pdf_path}. Using '{client_name}'")
        
        # Clean up names for filesystem use
        from src.utils import clean_filename
        client_clean = clean_filename(client_name)
        doc_type_clean = clean_filename(doc_type)
        institution_clean = clean_filename(institution)
        
        # Create directory structure
        client_dir = config.PROCESSED_DIR / client_clean
        client_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created/verified client directory: {client_dir}")
        
        # Create new filename
        new_filename = f"{doc_type_clean}_{period}.pdf"
        dest_path = client_dir / new_filename
        
        # Check if file already exists, if so add a unique identifier
        counter = 1
        while dest_path.exists():
            new_filename = f"{doc_type_clean}_{period}_{counter}.pdf"
            dest_path = client_dir / new_filename
            counter += 1
        
        # Create a JSON metadata file
        json_path = client_dir / f"{doc_type_clean}_{period}.json"
        if json_path.exists():
            json_path = client_dir / f"{doc_type_clean}_{period}_{counter-1}.json"
        
        logger.info(f"Source path: {pdf_path} {SYMBOLS['arrow']} Destination path: {dest_path}")
        
        # Copy the file with retry attempts
        safe_copy_file(pdf_path, dest_path, max_retries=5)
        logger.info(f"File copied successfully: {dest_path}")
        
        # Save metadata as JSON
        try:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(document_data, f, indent=4, ensure_ascii=True)
            logger.info(f"Metadata saved to: {json_path}")
        except Exception as e:
            logger.warning(f"Could not save metadata file: {e}")
        
        # Delete the source file after successful processing
        delete_source_file(pdf_path)
        
        return {
            'success': True,
            'original_path': str(pdf_path),
            'new_path': str(dest_path),
            'metadata': document_data,
            'client_name': client_name  # Add client name to result
        }
        
    except Exception as e:
        logger.error(f"Error organizing file {pdf_path}: {str(e)}")
        return {
            'success': False,
            'original_path': str(pdf_path),
            'error': str(e)
        }

def main():
    """Main entry point for the multi-client tax document processor"""

    # Set up logging
    global logger
    logger = setup_logging()
    logger.info("Starting multi-client tax document processor")

    # Check for Anthropic API key
    if not os.getenv('ANTHROPIC_API_KEY'):
        logger.error("ANTHROPIC_API_KEY environment variable not set!")
        print("Error: Please set your ANTHROPIC_API_KEY in the .env file")
        return

    # Get all PDF files to process
    pdf_files = get_source_documents()
    total_files = len(pdf_files)
    logger.info(f"Found {total_files} PDF files to process")

    if not pdf_files:
        print("No PDF files found in data/source_documents directory")
        return

    # Check for poppler installation
    poppler_installed, message = check_poppler_installation()
    if not poppler_installed:
        logger.error(f"PDF processing dependency error: {message}")
        print(f"\n[ERROR] Missing required dependency for PDF processing:")
        print(f"  {message}")
        
        # Show system-specific installation instructions
        system = platform.system()
        if system == "Darwin":  # macOS
            print("\nInstallation instructions for macOS:")
            print("  1. Install Homebrew if not already installed:")
            print("     /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"")
            print("  2. Install poppler:")
            print("     brew install poppler")
        elif system == "Windows":
            print("\nInstallation instructions for Windows:")
            print("  1. Download poppler for Windows from: http://blog.alivate.com.au/poppler-windows/")
            print("  2. Extract to a location like C:\\poppler")
            print("  3. Add the bin directory to your PATH or set POPPLER_PATH environment variable")
        else:
            print("\nInstallation instructions for Linux:")
            print("  Ubuntu/Debian: sudo apt-get install poppler-utils")
            print("  Fedora/RHEL: sudo dnf install poppler-utils")
            
        print("\nAfter installing the dependency, restart the application.\n")
        return

    # Check for checkpoint
    processed_paths = set(load_checkpoint())
    if processed_paths:
        # Filter out already processed files
        pdf_files = [p for p in pdf_files if str(p) not in processed_paths]
        print(f"Resuming from checkpoint. {len(processed_paths)} files already processed.")
        print(f"{len(pdf_files)} files remaining.")

    # Initialize results tracking
    results = {'success': 0, 'failed': 0, 'retry_success': 0}
    client_stats = {}  # Track documents per client
    failed_docs = []
    newly_processed = []

    print(f"Processing {len(pdf_files)} documents in batches of {config.BATCH_SIZE}...")

    # Process in batches
    for batch_start in range(0, len(pdf_files), config.BATCH_SIZE):
        batch_end = min(batch_start + config.BATCH_SIZE, len(pdf_files))
        current_batch = pdf_files[batch_start:batch_end]

        batch_num = batch_start // config.BATCH_SIZE + 1
        total_batches = (len(pdf_files) + config.BATCH_SIZE - 1) // config.BATCH_SIZE

        print(f"\nBatch {batch_num}/{total_batches} - Files {batch_start + 1}-{batch_end} of {len(pdf_files)}")

        # Process current batch with progress tracking
        with tqdm(total=len(current_batch), desc=f"Batch [{batch_num}/{total_batches}]") as pbar:
            for idx, pdf_path in enumerate(current_batch):
                try:
                    file_num = batch_start + idx + 1
                    pbar.set_description(f"Processing [{file_num}/{len(pdf_files)}]")

                    logger.info(f"Processing {pdf_path}")
                    print(f"\nFile {file_num}/{len(pdf_files)}: {pdf_path.name}")

                    # Process document with error handling and retries
                    retry_count = 0
                    success = False

                    while not success and retry_count < config.MAX_RETRIES:
                        try:
                            # Process the document to extract data
                            document_data = process_document(pdf_path)
                            
                            # Use the multi-client organize function
                            result = organize_document_multi_client(pdf_path, document_data)

                            if result['success']:
                                if retry_count > 0:
                                    results['retry_success'] += 1
                                else:
                                    results['success'] += 1
                                success = True

                                # Add to processed list for checkpoint
                                newly_processed.append(str(pdf_path))
                                processed_paths.add(str(pdf_path))
                                
                                # Track client stats
                                client_name = result.get('client_name', 'Unknown')
                                if client_name in client_stats:
                                    client_stats[client_name] += 1
                                else:
                                    client_stats[client_name] = 1

                                # Display success info
                                print(f"{SYMBOLS['success']} Successfully processed: {pdf_path.name}")
                                print(f"  • Document type: {document_data.get('document_type')}")
                                print(f"  • Recipient: {document_data.get('client_name')}")
                                print(f"  • Tax year: {document_data.get('period_year')}")
                                print(f"  • Organized to: {client_name}/")
                            else:
                                raise Exception(result.get('error', 'Unknown error'))

                        except Exception as e:
                            retry_count += 1
                            if retry_count < config.MAX_RETRIES:
                                wait_time = retry_count * 2  # Exponential backoff
                                logger.warning(f"Retry {retry_count}/{config.MAX_RETRIES} for {pdf_path} after {wait_time}s: {str(e)}")
                                print(f"{SYMBOLS['warning']} Retrying ({retry_count}/{config.MAX_RETRIES}) after {wait_time}s: {str(e)}")
                                time.sleep(wait_time)
                            else:
                                logger.error(f"Failed after {config.MAX_RETRIES} attempts: {pdf_path}: {str(e)}")
                                print(f"{SYMBOLS['error']} Failed after {config.MAX_RETRIES} attempts: {str(e)}")
                                results['failed'] += 1
                                failed_docs.append(str(pdf_path))

                    # Update progress bar
                    pbar.update(1)

                    # Save checkpoint every 5 documents
                    if len(newly_processed) % 5 == 0 and newly_processed:
                        save_checkpoint(list(processed_paths))

                    # Add small random delay between documents
                    time.sleep(random.uniform(0.1, 0.3))

                except Exception as e:
                    results['failed'] += 1
                    logger.error(f"Unexpected error processing {pdf_path}: {str(e)}")
                    print(f"{SYMBOLS['error']} Error: {str(e)}")
                    failed_docs.append(str(pdf_path))
                    pbar.update(1)

        # Save checkpoint after each batch
        save_checkpoint(list(processed_paths))

        # Delay between batches to prevent API rate limiting
        if batch_end < len(pdf_files):
            print(f"Waiting {config.BATCH_DELAY}s before next batch...")
            time.sleep(config.BATCH_DELAY)

    # Final checkpoint
    save_checkpoint(list(processed_paths))

    # Save failed document list
    failed_path = None
    if failed_docs:
        failed_path = save_failed_list(failed_docs)

    # Print summary
    print("\n" + "="*60)
    print(f"Processing complete!")
    print(f"  • Successfully processed: {results['success']} documents")
    print(f"  • Successful after retry: {results['retry_success']} documents")
    print(f"  • Failed to process: {results['failed']} documents")
    print(f"  • Total documents processed: {len(processed_paths)} (including previous runs)")

    if failed_path:
        print(f"  • Failed document list saved to: {failed_path}")
        
    # Print client statistics
    if client_stats:
        print("\nClient statistics:")
        for client, count in sorted(client_stats.items(), key=lambda x: x[1], reverse=True):
            print(f"  • {client}: {count} documents")

    print("="*60)

    logger.info(f"Processing complete. Success: {results['success']}, Retry Success: {results['retry_success']}, Failed: {results['failed']}")
    logger.info(f"Client statistics: {client_stats}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # Use ASCII symbols for any final error messages
        print(f"[FATAL ERROR] The application encountered an unexpected error: {str(e)}")
        # Log it if possible
        try:
            import logging
            logging.error(f"Fatal error: {str(e)}")
        except:
            pass
        sys.exit(1)
