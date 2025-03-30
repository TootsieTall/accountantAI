"""
Path resolver for handling different environments (development vs production)
"""

import os
import sys
import platform
import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

def get_app_path():
    """
    Get the base application path, works in both development and production
    """
    if getattr(sys, 'frozen', False):
        # Running in production/bundled mode
        if platform.system() == "Darwin":  # macOS
            # In macOS, the application is in a .app bundle
            # The actual executable is in Content/MacOS
            # Resources are in Content/Resources
            app_path = Path(os.path.dirname(sys.executable))
            # Move up from MacOS to Resources
            if app_path.name == 'MacOS':
                return app_path.parent / 'Resources'
            return app_path
        else:
            # In Windows/Linux, the executable is in the app directory
            return Path(os.path.dirname(sys.executable))
    else:
        # Running in development mode
        return Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def normalize_path(path_str):
    """
    Normalize path to handle platform-specific differences
    """
    # Use os.path.normpath to get platform-specific normalization
    normalized = os.path.normpath(path_str)
    
    # Convert to Path object for consistency
    path_obj = Path(normalized)
    
    return str(path_obj)

def resolve_poppler_path():
    """
    Resolve Poppler path for both development and production environments
    Returns the path to the Poppler binaries
    """
    # Priority 1: Environment variable (set explicitly)
    if 'POPPLER_PATH' in os.environ and os.path.exists(os.environ['POPPLER_PATH']):
        logger.info(f"Using POPPLER_PATH from environment: {os.environ['POPPLER_PATH']}")
        return normalize_path(os.environ['POPPLER_PATH'])
    
    # Priority 2: Check for bundled poppler in the app's vendor directory
    app_path = get_app_path()
    vendor_poppler_path = app_path / 'vendor' / 'poppler' / 'bin'
    
    if vendor_poppler_path.exists():
        logger.info(f"Using bundled Poppler: {vendor_poppler_path}")
        return str(vendor_poppler_path)
    
    # Check for poppler-config.json
    config_path = app_path / 'vendor' / 'poppler-config.json'
    if config_path.exists():
        try:
            import json
            with open(config_path, 'r') as f:
                config = json.load(f)
                if 'path' in config and os.path.exists(config['path']):
                    logger.info(f"Using Poppler path from config: {config['path']}")
                    return normalize_path(config['path'])
        except Exception as e:
            logger.warning(f"Error reading poppler config: {e}")
    
    # Priority 3: Look for Poppler in common system paths
    if platform.system() == "Darwin":  # macOS
        common_paths = [
            "/opt/homebrew/bin",  # Apple Silicon
            "/usr/local/bin",     # Intel Macs
            "/opt/local/bin",     # MacPorts
            os.path.expanduser("~/homebrew/bin")  # Custom Homebrew
        ]
        
        # Homebrew Cellar paths
        brew_paths = [
            "/opt/homebrew/Cellar/poppler/*/bin",
            "/usr/local/Cellar/poppler/*/bin"
        ]
        
        import glob
        for pattern in brew_paths:
            matches = sorted(glob.glob(pattern), reverse=True)  # Newest version first
            if matches:
                logger.info(f"Using Poppler from Homebrew Cellar: {matches[0]}")
                return normalize_path(matches[0])
        
        for path in common_paths:
            if os.path.exists(os.path.join(path, "pdftoppm")):
                logger.info(f"Using Poppler from common path: {path}")
                return normalize_path(path)
                
    elif platform.system() == "Windows":
        common_paths = [
            os.path.join(os.path.expanduser('~'), 'poppler', 'bin'),
            r'C:\Program Files\poppler\bin',
            r'C:\Program Files (x86)\poppler\bin',
            r'C:\poppler\bin',
        ]
        
        for path in common_paths:
            pdftoppm_exe = os.path.join(path, 'pdftoppm.exe')
            if os.path.exists(pdftoppm_exe):
                logger.info(f"Using Poppler from common path: {path}")
                return normalize_path(path)
    else:  # Linux
        common_paths = [
            "/usr/bin",
            "/usr/local/bin",
            "/opt/bin",
        ]
        
        for path in common_paths:
            if os.path.exists(os.path.join(path, "pdftoppm")):
                logger.info(f"Using Poppler from common path: {path}")
                return normalize_path(path)
    
    # Priority 4: Try to find using command
    try:
        if platform.system() != "Windows":
            result = subprocess.run(['which', 'pdftoppm'], capture_output=True, text=True)
            if result.returncode == 0:
                path = os.path.dirname(result.stdout.strip())
                logger.info(f"Found Poppler using 'which': {path}")
                return normalize_path(path)
        else: 
            # For Windows, try to find in PATH
            for path_dir in os.environ.get('PATH', '').split(os.pathsep):
                pdftoppm_exe = os.path.join(path_dir, 'pdftoppm.exe')
                if os.path.exists(pdftoppm_exe):
                    logger.info(f"Found Poppler in PATH: {path_dir}")
                    return normalize_path(path_dir)
    except Exception as e:
        logger.warning(f"Error finding Poppler with which/PATH: {e}")
    
    # Failed to find Poppler
    logger.warning("Failed to find Poppler path")
    return None

def setup_poppler_path():
    """
    Setup Poppler path in the environment
    Returns True if successful, False otherwise
    """
    poppler_path = resolve_poppler_path()
    
    if not poppler_path:
        logger.warning("Poppler not found - will continue without it and use fallbacks")
        # Don't fail - just let it continue, our fallbacks will handle it
        return True
    
    # Set environment variables
    os.environ['POPPLER_PATH'] = poppler_path
    
    # Add to PATH if not already there
    if poppler_path not in os.environ.get('PATH', ''):
        os.environ['PATH'] = f"{poppler_path}{os.pathsep}{os.environ.get('PATH', '')}"
    
    # Verify we can find pdftoppm
    pdftoppm_name = "pdftoppm.exe" if platform.system() == "Windows" else "pdftoppm"
    pdftoppm_path = os.path.join(poppler_path, pdftoppm_name)
    
    if not os.path.exists(pdftoppm_path):
        logger.warning(f"pdftoppm not found at expected path: {pdftoppm_path}")
        return True  # Don't fail - our fallbacks will handle it
    
    logger.info(f"Successfully set up Poppler path: {poppler_path}")
    return True
