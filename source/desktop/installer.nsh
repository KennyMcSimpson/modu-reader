; Per-user "Open with" registration. Windows keeps the user's default choice.
!macro customInstall
  WriteRegStr HKCU "Software\Classes\Applications\Inkglass.exe" "FriendlyAppName" "Inkglass"
  WriteRegStr HKCU "Software\Classes\Applications\Inkglass.exe\shell\open\command" "" '$\"$INSTDIR\Inkglass.exe$\" $\"%1$\"'
  WriteRegStr HKCU "Software\Classes\Applications\Inkglass.exe\SupportedTypes" ".md" ""
  WriteRegStr HKCU "Software\Classes\Applications\Inkglass.exe\SupportedTypes" ".markdown" ""
  WriteRegStr HKCU "Software\Classes\Applications\Inkglass.exe\SupportedTypes" ".mdown" ""
  WriteRegStr HKCU "Software\Classes\Inkglass.Markdown" "" "Markdown Document"
  WriteRegStr HKCU "Software\Classes\Inkglass.Markdown\DefaultIcon" "" '$\"$INSTDIR\Inkglass.exe$\",0'
  WriteRegStr HKCU "Software\Classes\Inkglass.Markdown\shell\open\command" "" '$\"$INSTDIR\Inkglass.exe$\" $\"%1$\"'
  WriteRegStr HKCU "Software\Classes\.md\OpenWithProgids" "Inkglass.Markdown" ""
  WriteRegStr HKCU "Software\Classes\.markdown\OpenWithProgids" "Inkglass.Markdown" ""
  WriteRegStr HKCU "Software\Classes\.mdown\OpenWithProgids" "Inkglass.Markdown" ""
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\Applications\Inkglass.exe"
  DeleteRegKey HKCU "Software\Classes\Inkglass.Markdown"
  DeleteRegValue HKCU "Software\Classes\.md\OpenWithProgids" "Inkglass.Markdown"
  DeleteRegValue HKCU "Software\Classes\.markdown\OpenWithProgids" "Inkglass.Markdown"
  DeleteRegValue HKCU "Software\Classes\.mdown\OpenWithProgids" "Inkglass.Markdown"
!macroend
