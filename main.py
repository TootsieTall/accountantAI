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

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Import the new path resolver for Poppler - but don't run it at startup
from src.path_resolver import setup_poppler_path

# Don't setup poppler path during startup, only check if it's set
poppler_path = os.environ.get('POPPLER_PATH', '')
if poppler_path:
    print(f"Poppler path environment variable found: {poppler_path}")
else:
    print("Poppler path environment variable not set. Will check during document processing.")

# Import project modules
from src.utils import setup_logging, save_checkpoint, load_checkpoint, save_failed_list
from src.file_handler import get_source_documents, organize_document
from src.ai_processor import process_document, check_poppler_installation
import config

def main():
    """Main entry point for the tax document processor"""

    # Set up logging
    logger = setup_logging()
    logger.info("Starting tax document processor")

    # Check for Anthropic API key
    if not os.getenv('ANTHROPIC_API_KEY'):
        logger.error("ANTHROPIC_API_KEY environment variable not set!")
        print("Error: Please set your ANTHROPIC_API_KEY in the .env file")
        return

    # Get client name from environment variable (set by the UI)
    client_folder_name = os.getenv('CLIENT_NAME', '')
    if client_folder_name:
        logger.info(f"Processing documents for client: {client_folder_name}")
        print(f"Processing documents for client: {client_folder_name}")

    # Get all PDF files to process
    pdf_files = get_source_documents()
    total_files = len(pdf_files)
    logger.info(f"Found {total_files} PDF files to process")

    if not pdf_files:
        print("No PDF files found in data/source_documents directory")
        return

    # Now check for poppler installation, since we're going to process PDFs
    poppler_installed, message = check_poppler_installation()
    if not poppler_installed:
        logger.error(f"PDF processing dependency error: {message}")
        print(f"\n[ERROR] Missing required dependency for PDF processing:")
        print(f"  {message}")
        
        # Add system-specific installation instructions
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
                            document_data = process_document(pdf_path)
                            result = organize_document(pdf_path, document_data, client_folder_name)

                            if result['success']:
                                if retry_count > 0:
                                    results['retry_success'] += 1
                                else:
                                    results['success'] += 1
                                success = True

                                # Add to processed list for checkpoint
                                newly_processed.append(str(pdf_path))
                                processed_paths.add(str(pdf_path))

                                # Display success info
                                client_name = client_folder_name or document_data.get('client_name', 'Unknown')
                                print(f"[SUCCESS] Successfully processed: {pdf_path.name}")
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
                                print(f"[WARNING] Retrying ({retry_count}/{config.MAX_RETRIES}) after {wait_time}s: {str(e)}")
                                time.sleep(wait_time)
                            else:
                                logger.error(f"Failed after {config.MAX_RETRIES} attempts: {pdf_path}: {str(e)}")
                                print(f"[ERROR] Failed after {config.MAX_RETRIES} attempts: {str(e)}")
                                results['failed'] += 1
                                failed_docs.append(str(pdf_path))

                    # Update progress bar
                    pbar.update(1)

                    # Save checkpoint every 5 documents
                    if len(newly_processed) % 5 == 0:
                        save_checkpoint(list(processed_paths))

                    # Add small random delay between documents (100-300ms)
                    time.sleep(random.uniform(0.1, 0.3))

                except Exception as e:
                    results['failed'] += 1
                    logger.error(f"Unexpected error processing {pdf_path}: {str(e)}")
                    print(f"[ERROR] Error: {str(e)}")
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

    print("="*60)

    logger.info(f"Processing complete. Success: {results['success']}, Retry Success: {results['retry_success']}, Failed: {results['failed']}")

if __name__ == "__main__":
    main()
