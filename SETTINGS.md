# AccountantAI Settings Guide

## Using the Settings Feature

AccountantAI now includes a settings panel that allows you to configure your API keys directly from the application interface. This eliminates the need to manually edit the `.env` file.

### Accessing Settings

1. **Open the Application**: Launch the AccountantAI Uploader application
2. **Click the Settings Icon**: Look for the gear (⚙️) icon in the top right corner of the application
3. **Enter Your API Key**: In the settings panel, you'll see a field for your Anthropic API key
4. **Save Settings**: Click the "Save Settings" button to store your API key

### About API Keys

The Anthropic API key is used for processing documents using the Claude AI model. Your API key is stored securely in the `.env` file on your local machine. The application never transmits your API key to any external servers except when making authorized API calls to Anthropic's services.

### API Key Location

The API key is stored in the following location:

- **macOS**: `~/Library/Application Support/AccountantAI/.env`
- **Windows**: In the application installation directory

### Security Notes

- The API key field is masked by default (shown as dots)
- You can click the eye icon to temporarily view the key (useful for verification)
- The API key is only stored locally on your machine
- If you need to completely remove your API key, you can delete the `.env` file from the locations mentioned above

## Troubleshooting

If you experience issues with the settings feature:

1. **API Key Not Saving**: Make sure the application has write permissions to its directory
2. **Cannot Access Settings**: Try restarting the application
3. **API Processing Errors**: Verify that your API key is correct and has the necessary permissions

For additional help, please refer to the main documentation or contact support.
