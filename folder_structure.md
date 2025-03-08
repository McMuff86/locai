# Projektstruktur

Generiert am: 08.03.2025

## Verzeichnisbaum
```
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   └── chat/
│   │       └── README.md
│   ├── components/
│   │   ├── ui/
│   │   │   └── README.md
│   │   └── chat/
│   │       └── README.md
│   ├── lib/
│   │   └── utils.ts
│   └── types/
│       └── README.md
├── public/
├── thoughtprocess/
│   ├── README.md
│   └── 001_thoughtprocess.txt
├── node_modules/
├── package.json
├── package-lock.json
├── tsconfig.json
├── next.config.ts
├── next-env.d.ts
├── postcss.config.mjs
├── generate_folder_structure.ps1
├── folder_structure.md
└── README.md
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