; Per-user "Open with" registration. Windows keeps the user's default choice.
!macro customInstall
  WriteRegStr HKCU "Software\Classes\Applications\MoDu Reader.exe" "FriendlyAppName" "MoDu Reader"
  WriteRegStr HKCU "Software\Classes\Applications\MoDu Reader.exe\shell\open\command" "" '$\"$INSTDIR\MoDu Reader.exe$\" $\"%1$\"'
  WriteRegStr HKCU "Software\Classes\Applications\MoDu Reader.exe\SupportedTypes" ".md" ""
  WriteRegStr HKCU "Software\Classes\Applications\MoDu Reader.exe\SupportedTypes" ".markdown" ""
  WriteRegStr HKCU "Software\Classes\Applications\MoDu Reader.exe\SupportedTypes" ".mdown" ""
  WriteRegStr HKCU "Software\Classes\MoDu.Reader.Markdown" "" "Markdown Document"
  WriteRegStr HKCU "Software\Classes\MoDu.Reader.Markdown\DefaultIcon" "" '$\"$INSTDIR\MoDu Reader.exe$\",0'
  WriteRegStr HKCU "Software\Classes\MoDu.Reader.Markdown\shell\open\command" "" '$\"$INSTDIR\MoDu Reader.exe$\" $\"%1$\"'
  WriteRegStr HKCU "Software\Classes\.md\OpenWithProgids" "MoDu.Reader.Markdown" ""
  WriteRegStr HKCU "Software\Classes\.markdown\OpenWithProgids" "MoDu.Reader.Markdown" ""
  WriteRegStr HKCU "Software\Classes\.mdown\OpenWithProgids" "MoDu.Reader.Markdown" ""
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\Applications\MoDu Reader.exe"
  DeleteRegKey HKCU "Software\Classes\MoDu.Reader.Markdown"
  DeleteRegValue HKCU "Software\Classes\.md\OpenWithProgids" "MoDu.Reader.Markdown"
  DeleteRegValue HKCU "Software\Classes\.markdown\OpenWithProgids" "MoDu.Reader.Markdown"
  DeleteRegValue HKCU "Software\Classes\.mdown\OpenWithProgids" "MoDu.Reader.Markdown"
!macroend
