# PowerShell-Skript zum Generieren der Ordnerstruktur-Dokumentation

# Aktuelle Datum und Uhrzeit für die Dokumentation
$date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Ausgabedatei
$outputFile = "folder_structure.md"

# Header der Markdown-Datei
@"
# Projektstruktur

Generiert am: $date

## Verzeichnisbaum
```
"@ | Out-File -FilePath $outputFile -Encoding utf8

# Generiere Verzeichnisbaum mit Get-ChildItem und konvertiere in String-Darstellung
# Ignoriere node_modules und .git Verzeichnisse
function Get-DirectoryTree {
    param (
        [string]$Path = ".",
        [int]$IndentLevel = 0
    )
    
    $items = Get-ChildItem -Path $Path | Where-Object { $_.Name -ne "node_modules" -and $_.Name -ne ".git" }
    
    foreach ($item in $items) {
        $indent = " " * ($IndentLevel * 4)
        
        if ($item.PSIsContainer) {
            # Verzeichnis
            "$indent├── $($item.Name)/" | Out-File -FilePath $outputFile -Append -Encoding utf8
            Get-DirectoryTree -Path $item.FullName -IndentLevel ($IndentLevel + 1)
        } else {
            # Datei
            "$indent├── $($item.Name)" | Out-File -FilePath $outputFile -Append -Encoding utf8
        }
    }
}

# Führe die Funktion mit dem aktuellen Verzeichnis aus
Get-DirectoryTree -Path "."

# Schließe den Code-Block
@"
```

## Verzeichnisbeschreibungen

- **src/**: Enthält den Hauptcode der Anwendung
  - **app/**: Enthält die Next.js App Router-Komponenten
    - **chat/**: Chat-bezogene Routen und Seiten
  - **components/**: Wiederverwendbare React-Komponenten
    - **ui/**: Basis-UI-Komponenten (Buttons, Input-Felder etc.)
    - **chat/**: Chat-spezifische Komponenten
  - **lib/**: Hilfsfunktionen und Utility-Code
  - **types/**: TypeScript-Typdefinitionen
- **public/**: Statische Assets (Bilder, Fonts etc.)
- **thoughtprocess/**: Dokumentation des Gedankenprozesses und Code-Snapshots
"@ | Out-File -FilePath $outputFile -Append -Encoding utf8

Write-Host "Ordnerstruktur wurde in $outputFile dokumentiert." 