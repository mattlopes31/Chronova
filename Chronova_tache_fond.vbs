Set oWShell = CreateObject("Wscript.Shell")
'chemin de node_red.bat
oWShell.Run ("C:\Users\encosyst\Documents\GitHub\Chronova\Run_client_Chronova.bat"), 0, False
oWShell.Run ("C:\Users\encosyst\Documents\GitHub\Chronova\Run_server_Chronova.bat"), 0, False
Set oWSHell = Nothing