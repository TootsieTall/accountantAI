; Custom NSIS installer script for AccountantAI
; This script is included via the "include" option in your package.json

!macro customInit
  DetailPrint "Initializing data directories..."
  ; Run the main executable with the initialization flag to create necessary directories
  ExecWait '"$INSTDIR\\AccountantAI Uploader.exe" --initialize-data-directory'
  DetailPrint "Data directories initialized successfully"
!macroend

!macro customInstall
  ; Create a desktop shortcut for the application
  CreateShortCut "$DESKTOP\AccountantAI.lnk" "$INSTDIR\\AccountantAI Uploader.exe"
!macroend

!macro customUnInstall
  ; Add any custom uninstall actions here if needed
!macroend
