import os
from pathlib import Path
import string

# Base directories
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

# Document directories
SOURCE_DIR = DATA_DIR / "source_documents"
PROCESSED_DIR = DATA_DIR / "processed"
METADATA_DIR = DATA_DIR / "metadata"
LOG_DIR = DATA_DIR / "logs"

# Ensure directories exist
for dir_path in [SOURCE_DIR, PROCESSED_DIR, METADATA_DIR, LOG_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

# API Settings
ANTHROPIC_MODEL = "claude-3-opus-20240229"  # or "claude-3-sonnet-20240229" for faster/cheaper option
MAX_TOKENS = 300

# Batch processing settings
BATCH_SIZE = 10          # Number of documents to process before pausing
BATCH_DELAY = 5          # Seconds to pause between batches
MAX_RETRIES = 3          # Maximum number of retries for failed documents
API_MAX_RETRIES = 3      # Maximum retries for API calls
COPY_MAX_RETRIES = 3     # Maximum retries for file operations
