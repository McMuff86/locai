# LocAI - Your AI, Locked and Loaded

![LocAI Logo](public/locai-logo.png)

**LocAI** ist eine moderne Anwendung für lokale KI-Unterstützung, die deine KI-Modelle direkt auf deiner Hardware laufen lässt - ohne Cloud-Abhängigkeit, mit voller Kontrolle über deine Daten und maximaler Privatsphäre.

> 🔒 **Future Unleashed on Bare Metal** - Leistungsstarke KI-Funktionen, die vollständig lokal ausgeführt werden.

## 🌟 Hauptfunktionen

### 💬 Lokaler Chat mit verschiedenen Modellen
- **Modellauswahl**: Verwende verschiedene Modelle wie Llama3, Gemma, Mistral oder DeepSeek
- **Anpassbare Prompts**: Passe die Systemanweisungen individuell an deine Bedürfnisse an
- **Thinking Process**: Beobachte, wie die KI ihre Antworten entwickelt (mit Animation)
- **Mehrfacher Modellwechsel**: Wechsle zwischen Modellen innerhalb einer Konversation

### 🖼️ Bildanalyse und Vision-Modelle
- **Bildupload**: Lade Bilder hoch und lasse sie von Vision-Modellen analysieren
- **Bild-Text-Kombinationen**: Stelle Fragen zu deinen Bildern
- **Automatische Modellerkennung**: Das System wechselt automatisch zu Vision-Modellen, wenn Bilder erkannt werden

### 💾 Lokale Datenspeicherung
- **Speichern von Konversationen**: Speichere deine Chats lokal
- **Export/Import**: Exportiere und importiere Konversationen als JSON-Dateien
- **Bildkomprimierung**: Automatische Optimierung von Bildern für effizienten Speicherplatz

### 🎨 Moderne Benutzeroberfläche
- **Dark/Light Mode**: Wähle zwischen hellem und dunklem Design
- **Responsive Design**: Optimiert für Desktop und mobile Geräte
- **Intuitive Bedienung**: Benutzerfreundliche Oberfläche mit klaren Funktionen

## 🚀 Erste Schritte

### Voraussetzungen
- [Node.js](https://nodejs.org/) (Version 18 oder höher)
- [Ollama](https://ollama.ai/) für die lokale Ausführung von KI-Modellen
- Ein oder mehrere KI-Modelle über Ollama installiert (z.B. llama3, llama3.2-vision)

### Installation

1. Repository klonen
   ```bash
   git clone https://github.com/yourusername/locai.git
   cd locai
   ```

2. Abhängigkeiten installieren
   ```bash
   npm install
   ```

3. Entwicklungsserver starten
   ```bash
   npm run dev
   ```

4. Ollama-Modelle installieren (falls noch nicht vorhanden)
   ```bash
   ollama pull llama3
   ollama pull llama3.2-vision
   ```

## 📚 Verwendung

### Chat-Funktion
1. Wähle ein Modell aus dem Dropdown-Menü
2. Gib deine Nachricht ein und sende sie
3. Die KI präsentiert ihren Denkprozess und generiert eine Antwort
4. Speichere interessante Konversationen mit dem Speichern-Button

### Bildanalyse
1. Klicke auf das Kamera-Symbol neben dem Texteingabefeld
2. Wähle ein oder mehrere Bilder aus
3. Optional: Füge eine Beschreibung oder Frage zum Bild hinzu
4. Sende die Nachricht - die App wechselt automatisch zu einem Vision-Modell

### Konversationen verwalten
1. Speichere Konversationen über den "Speichern"-Button
2. Greife auf gespeicherte Konversationen über die Seitenleiste oder das "Laden"-Dropdown zu
3. Exportiere deine Konversationen als JSON-Dateien zur Sicherung
4. Importiere zuvor exportierte Konversationen

## 🔧 Technische Details

### Architektur
- **Next.js**: Frontend-Framework für reaktive Benutzeroberflächen
- **TypeScript**: Typsicherheit und verbesserte Entwicklererfahrung
- **Ollama API**: Lokale Schnittstelle zu den KI-Modellen
- **LocalStorage/FileSystem**: Lokale Datenpersistenz ohne Datenbankabhängigkeit

### Anpassung
Die Anwendung ist modular aufgebaut und kann leicht erweitert werden:
- **Neue Modelle**: Unterstützt neue Modelle durch Hinzufügen entsprechender Templates
- **Weitere Funktionen**: Erweiterbar durch modulare Komponenten

## 🔐 Datenschutz

LocAI wurde mit Fokus auf Datenschutz und Sicherheit entwickelt:
- **Keine Cloudspeicherung**: Alle Daten bleiben auf deinem Gerät
- **Keine Telemetrie**: Keine Datenübertragung an externe Server
- **Exportierbare Daten**: Volle Kontrolle über deine Daten

## 🛠️ Contributing

Beiträge zum Projekt sind willkommen! Beachte bitte die folgenden Schritte:
1. Fork das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/amazing-feature`)
3. Committe deine Änderungen (`git commit -m 'Add some amazing feature'`)
4. Push den Branch (`git push origin feature/amazing-feature`)
5. Eröffne einen Pull Request

## 📝 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert - siehe die LICENSE-Datei für Details.

Creator:
```plaintext
-+=--+=--+=--+=--+=--+=--+=--+=--+=--+=--+=--+=--+=--+=--+=--+=-
  ##     ##            ###       ###  ##    ##   ########  ########
  ###   ###            ####     ####  ##    ##   ########  ########     
  ## # # ##            ## ##  ##  ##  ##    ##   ##        ##     
  ##  #  ##    #####   ##  ## ##  ##  ##    ##   ##        ##     
  ##     ##   ##       ##    %    ##  ##    ##   ######    ###### 
  ##     ##  ##        ##         ##  ##    ##   ######    ######     
  ##     ##  ##        ##         ##  ##    ##   ##        ##     
  ##     ##   ##       ##         ##  ##    ##   ##        ##     
  ##     ##    #####   ##         ##  ########   ##        ##     
-+=--+=--+=--+=--+=--+=--+=--+=--+=--+=--+=--+=--+=--+=--+=--+=-
```
---

## 🙏 Danksagungen

- [Ollama](https://ollama.ai/) für die lokale KI-Modellunterstützung
- [Next.js](https://nextjs.org/) für das reaktive Frontend-Framework
- [Shadcn/UI](https://ui.shadcn.com/) für die schönen UI-Komponenten 
