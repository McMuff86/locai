# LocAI Component Upgrade Specs
> Sprint 5 — UI-3, UI-4, UI-5 Implementation Guide
> Erstellt: 2026-02-18 | Branch: sprint5/ui-design-system

---

## Überblick

Alle Upgrades erweitern bestehende Shadcn/UI-Komponenten. Kein Ersetzen.
Implementierungs-Reihenfolge: globals.css → skeleton → toast → chat messages → code blocks → empty states → sidebar.

---

## 1. Chat Message Bubbles — Redesign Spec

### Aktueller Stand
- Card-basiert mit `bg-muted/30` und `bg-muted/50`
- Kaum visueller Unterschied zwischen User/AI
- Kein Shadow, wenig Kontrast

### Zieldesign: "Linear-First, Premium Polish"

```
┌─────────────────────────────────────────────────────────┐
│ [Avatar] Du                              14:23 ↑        │
│          ┌─────────────────────────────────────────┐    │
│          │ Wer hat eigentlich gerade Bock auf... │  │    │
│          └─────────────────────────────────────────┘    │
│                                                         │
│ [Avatar] Qwen 2.5                        14:23 ✓        │
│          ┌─────────────────────────────────────────┐    │
│          │                                         │    │
│          │ [Markdown rendered content]              │    │
│          │                                         │    │
│          └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### User Message Card

```tsx
// CSS Classes
className={cn(
  // Layout
  "max-w-[88%] ml-auto",
  // Background: Sehr subtiles Cyan-tint + Glass-artig
  "bg-gradient-to-br from-cyan-950/40 via-slate-800/60 to-slate-900/50",
  "dark:from-cyan-900/20 dark:via-zinc-800/40 dark:to-zinc-900/50",
  // Border
  "border border-cyan-500/20 dark:border-cyan-400/15",
  // Shape
  "rounded-2xl rounded-tr-sm",  // Bubble-Form: scharf oben rechts
  // Shadow
  "shadow-sm shadow-black/20",
  // Content
  "px-4 py-3",
)}
```

### AI Message Card

```tsx
// CSS Classes
className={cn(
  // Layout  
  "max-w-[92%]",
  // Background: Surface-level, leicht vom BG abgehoben
  "bg-card/80",
  "dark:bg-zinc-900/70",
  // Border
  "border border-border/50",
  // Shape
  "rounded-xl rounded-tl-sm",  // Bubble-Form: scharf oben links
  // Shadow
  "shadow-sm shadow-black/30",
  // Content
  "px-4 py-3",
)}
```

### Header Row (Avatar + Name + Timestamp)

```tsx
// Abstand: 12px unter Header, Avatar 32px
<div className="flex items-center gap-2.5 mb-2">
  <ChatAvatar type="user" size={32} />
  <span className="text-[13px] font-semibold text-foreground/90 tracking-tight">
    {displayName}
  </span>
  <span className="text-[11px] text-muted-foreground/60 font-mono ml-auto">
    {timestamp}
  </span>
</div>
```

### Message Animation

```tsx
// Framer Motion Variant
const messageVariants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: [0.0, 0.0, 0.2, 1.0],
    },
  },
};

// Stagger bei mehreren Nachrichten (initiales Laden)
const containerVariants = {
  animate: { transition: { staggerChildren: 0.04 } },
};
```

### Spacing zwischen Nachrichten

- Gleicher Sender hintereinander: `mb-2` (8px)
- Sender-Wechsel: `mb-4` (16px)
- Nach ThinkingProcess-Block: `mt-0`

---

## 2. Code Block Upgrade

### Aktueller Stand
- Einfaches `react-syntax-highlighter` ohne Filename oder Action-Buttons
- Kein Copy-Button sichtbar

### Zieldesign

```
┌────────────────────────────────────────────────────────────┐
│ [ts] utils.ts                    [Copy] [Run] [Wrap]       │ ← Header Tab
├────────────────────────────────────────────────────────────┤
│                                                            │
│  const formatDuration = (ms: number) => {                  │
│    if (ms < 1000) return `${ms}ms`;                        │
│    return `${(ms / 1000).toFixed(1)}s`;                    │
│  };                                                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Component Spec: `<CodeBlock>`

```tsx
interface CodeBlockProps {
  language: string;
  code: string;
  filename?: string;          // Optional: "utils.ts"
  showLineNumbers?: boolean;  // Default: false (kurze Snippets), true (> 10 Zeilen)
  canRun?: boolean;           // true wenn language === 'python' | 'javascript' | 'bash'
}
```

### Header-Bereich

```tsx
<div className={cn(
  "flex items-center justify-between",
  "px-4 py-2.5",
  "bg-zinc-900/80 dark:bg-black/60",
  "border-b border-border/40",
  "rounded-t-lg",
)}>
  {/* Left: Language Badge + Filename */}
  <div className="flex items-center gap-2.5">
    {/* Language Dot */}
    <span className={cn(
      "w-2 h-2 rounded-full flex-shrink-0",
      langColorMap[language] || "bg-zinc-500",
    )} />
    {/* Filename oder Language */}
    <span className="text-xs font-mono text-muted-foreground">
      {filename || language}
    </span>
  </div>

  {/* Right: Action Buttons */}
  <div className="flex items-center gap-1.5">
    {/* Word Wrap Toggle */}
    <button className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors">
      <WrapText className="h-3.5 w-3.5" />
    </button>
    
    {/* Run Button (nur wenn canRun) */}
    {canRun && (
      <button className={cn(
        "flex items-center gap-1 px-2 py-1 rounded",
        "text-xs font-medium",
        "bg-emerald-500/15 text-emerald-400",
        "hover:bg-emerald-500/25 transition-colors",
      )}>
        <Play className="h-3 w-3" />
        <span>Run</span>
      </button>
    )}
    
    {/* Copy Button */}
    <CopyButton code={code} />
  </div>
</div>
```

### Copy Button State Machine

```tsx
// States: idle → copied (1.5s) → idle
function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  
  return (
    <motion.button
      onClick={handleCopy}
      animate={{ scale: copied ? 0.92 : 1 }}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded",
        "text-xs transition-colors",
        copied 
          ? "bg-cyan-500/15 text-cyan-400" 
          : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
      )}
    >
      {copied ? (
        <><Check className="h-3.5 w-3.5" /> Kopiert</>
      ) : (
        <><Copy className="h-3.5 w-3.5" /> Copy</>
      )}
    </motion.button>
  );
}
```

### Code Area

```tsx
<div className={cn(
  "relative overflow-x-auto",
  "bg-zinc-950/90 dark:bg-black/80",
  "rounded-b-lg",
  // Subtle inset shadow
  "shadow-inner shadow-black/30",
)}>
  <SyntaxHighlighter
    style={oneDark}  // oder customTheme basierend auf Designsystem
    language={language}
    showLineNumbers={showLineNumbers}
    customStyle={{
      background: 'transparent',
      fontSize: '0.8125rem',  // 13px
      lineHeight: '1.6',
      padding: '16px',
      margin: 0,
    }}
  />
</div>
```

### Language Color Map

```tsx
const langColorMap: Record<string, string> = {
  typescript: 'bg-blue-400',
  javascript: 'bg-yellow-400',
  python:     'bg-green-400',
  bash:       'bg-emerald-400',
  shell:      'bg-emerald-400',
  css:        'bg-pink-400',
  html:       'bg-orange-400',
  json:       'bg-yellow-300',
  markdown:   'bg-gray-400',
  rust:       'bg-orange-600',
  go:         'bg-cyan-400',
  sql:        'bg-purple-400',
};
```

---

## 3. Toast Redesign — Slide-in mit Progress Bar

### Aktueller Stand
- Basis Shadcn Toast ohne Animation-Details

### Zieldesign

```
                                 ┌─────────────────────────┐
                                 │ ✓ Gespeichert           │
                                 │   Unterhaltung wurde... │
                                 │ ▓▓▓▓▓▓▓▓░░░ 3s         │
                                 └─────────────────────────┘
```

### Toast Varianten

| Variante    | Icon         | Accent Color | Dauer  |
|-------------|--------------|--------------|--------|
| `success`   | CheckCircle  | Emerald      | 3.5s   |
| `error`     | XCircle      | Red          | 5s     |
| `warning`   | AlertTriangle| Amber        | 4s     |
| `info`      | Info         | Cyan         | 3s     |
| `loading`   | Loader2      | Cyan (spin)  | until resolved |

### CSS Klassen (Erweiterung des Shadcn Toasters)

```tsx
// Toast Container (bottom-right, nicht bottom-center)
className={cn(
  // Position
  "fixed bottom-5 right-5 z-[100]",
  // Layout
  "w-[360px] min-w-[280px]",
  // Visual
  "rounded-xl overflow-hidden",
  "border border-border/60",
  "glass-sm",  // backdrop-blur
  // Shadow
  "shadow-lg shadow-black/40",
)}

// Inneres Layout
<div className="px-4 py-3">
  <div className="flex items-start gap-3">
    {/* Status Icon */}
    <div className={cn(
      "mt-0.5 p-1.5 rounded-md flex-shrink-0",
      variant === 'success' && "bg-emerald-500/15 text-emerald-400",
      variant === 'error'   && "bg-red-500/15 text-red-400",
      variant === 'warning' && "bg-amber-500/15 text-amber-400",
      variant === 'info'    && "bg-cyan-500/15 text-cyan-400",
    )}>
      <StatusIcon className="h-4 w-4" />
    </div>
    
    {/* Text */}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-foreground truncate">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {description}
        </p>
      )}
    </div>
    
    {/* Close */}
    <button className="text-muted-foreground hover:text-foreground flex-shrink-0 -mr-1 -mt-1 p-1 rounded hover:bg-white/5">
      <X className="h-3.5 w-3.5" />
    </button>
  </div>
  
  {/* Progress Bar */}
  {duration && (
    <div className="mt-3 h-0.5 bg-border/40 rounded-full overflow-hidden -mx-0.5">
      <motion.div
        className={cn(
          "h-full rounded-full",
          variant === 'success' && "bg-emerald-500",
          variant === 'error'   && "bg-red-500",
          variant === 'warning' && "bg-amber-500",
          variant === 'info'    && "bg-cyan-500",
        )}
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: duration / 1000, ease: "linear" }}
      />
    </div>
  )}
</div>
```

### Animation (Framer Motion)

```tsx
// Framer Motion Variants für AnimatePresence
const toastVariants = {
  initial: { 
    opacity: 0, 
    x: 48, 
    scale: 0.96,
  },
  animate: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: { duration: 0.3, ease: [0.0, 0.0, 0.2, 1.0] },
  },
  exit: { 
    opacity: 0, 
    x: 48,
    scale: 0.94,
    transition: { duration: 0.2, ease: [0.4, 0.0, 1.0, 1.0] },
  },
};
```

---

## 4. Empty States — Icon + Text Patterns

### Design-Prinzipien
1. Niemals nur Text — immer Icon (Lucide) + Titel + beschreibender Satz
2. Optional: CTA-Button für die häufigste Aktion
3. Subtile Illustration statt leere Fläche
4. Max. 2 Zeilen Text

### Generische Empty State Component

```tsx
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline';
  };
  className?: string;
}

function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "py-16 px-8 gap-4",
        className,
      )}
    >
      {/* Icon Container mit Glow */}
      <div className={cn(
        "w-16 h-16 rounded-2xl",
        "bg-muted/50 flex items-center justify-center",
        "border border-border/40",
        "shadow-inner shadow-black/10",
      )}>
        <Icon className="h-8 w-8 text-muted-foreground/60" />
      </div>
      
      {/* Text */}
      <div className="space-y-1.5 max-w-[280px]">
        <h3 className="text-sm font-semibold text-foreground/80">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      
      {/* CTA */}
      {action && (
        <Button
          variant={action.variant || 'outline'}
          size="sm"
          onClick={action.onClick}
          className="mt-1"
        >
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}
```

### App-spezifische Empty States

```tsx
// Chat – keine Konversation ausgewählt
<EmptyState
  icon={MessageSquare}
  title="Neue Unterhaltung"
  description="Wähle ein Modell und starte ein Gespräch mit deiner lokalen AI."
  action={{ label: "Neuer Chat", onClick: handleNewChat }}
/>

// Chat – keine Nachrichten (Konversation leer)
<EmptyState
  icon={Sparkles}
  title="Womit kann ich helfen?"
  description="Stelle eine Frage, lass Code schreiben oder aktiviere den Agenten-Modus für komplexe Aufgaben."
/>

// Gallery – keine Bilder
<EmptyState
  icon={Image}
  title="Noch keine Bilder"
  description="Generierte Bilder von ComfyUI erscheinen hier automatisch."
  action={{ label: "ComfyUI starten", onClick: handleLaunchComfyUI }}
/>

// Dokumente – keine RAG-Dokumente
<EmptyState
  icon={Files}
  title="Keine Dokumente"
  description="Lade Dokumente hoch, damit die AI sie als Kontext verwenden kann."
  action={{ label: "Dokument hochladen", onClick: handleUpload }}
/>

// Konversations-Sidebar – keine Gespräche
<EmptyState
  icon={MessageSquareDashed}
  title="Noch keine Gespräche"
  description="Deine Unterhaltungen werden hier gespeichert."
/>

// Notizen – keine Notizen
<EmptyState
  icon={FileText}
  title="Leeres Notizbuch"
  description="Erstelle Notizen und verknüpfe sie im Wissensgraph."
  action={{ label: "Neue Notiz", onClick: handleNewNote }}
/>

// Suche – kein Ergebnis
<EmptyState
  icon={SearchX}
  title="Keine Ergebnisse"
  description="Versuche einen anderen Suchbegriff oder überprüfe die SearXNG-Verbindung."
/>
```

---

## 5. Loading Skeletons — Shimmer statt Pulse

### Upgrade-Plan: Shimmer-Animation

```css
/* globals.css — ersetzt/ergänzt animate-pulse */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

.animate-shimmer {
  background: linear-gradient(
    90deg,
    oklch(from var(--muted) l c h / 1) 0%,
    oklch(from var(--muted) calc(l + 0.05) c h / 1) 40%,
    oklch(from var(--muted) calc(l + 0.08) c h / 1) 50%,
    oklch(from var(--muted) calc(l + 0.05) c h / 1) 60%,
    oklch(from var(--muted) l c h / 1) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}
```

### Neue Skeleton-Komponente

```tsx
// Basis: ersetzt das bestehende Skeleton
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md animate-shimmer",
        className
      )}
      {...props}
    />
  );
}
```

### Chat Message Skeleton (verbessert)

```tsx
function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={cn("flex flex-col w-full mb-4", isUser && "items-end")}>
      {/* Header: Avatar + Name */}
      <div className={cn(
        "flex items-center gap-2.5 mb-2",
        isUser && "flex-row-reverse"
      )}>
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
      
      {/* Message card lines */}
      <div className={cn(
        "space-y-2 rounded-xl border border-border/30 p-4",
        isUser ? "max-w-[60%]" : "max-w-[80%]",
        isUser ? "bg-cyan-950/20" : "bg-card/60",
      )}>
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-[85%]" />
        {!isUser && (
          <>
            <Skeleton className="h-3.5 w-[70%]" />
            <Skeleton className="h-3.5 w-[55%]" />
          </>
        )}
      </div>
    </div>
  );
}
```

### Konversationsliste Skeleton

```tsx
function ConversationItemSkeleton() {
  return (
    <div className="px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3 w-10 flex-shrink-0" />
      </div>
      <Skeleton className="h-3 w-2/5" />
    </div>
  );
}
```

---

## 6. Sidebar Navigation — Collapse Animation & Active Indicator

### Aktueller Stand
- Statische 56px (w-56) Sidebar
- Kein Collapse
- Aktiver State: `bg-primary/15` + `text-primary` + linke Linie

### Zieldesign: Collapsible mit Icon-Only-Mode

**Zustände:**
1. **Expanded** (default, w-56): Icon + Label, sichtbar
2. **Collapsed** (w-14 = 56px): Nur Icon + Tooltip on hover
3. **Mobile**: Bestehender Overlay-Modus bleibt

### Collapse Trigger

```tsx
// Am unteren Rand der Sidebar, über Theme Toggle
<button
  onClick={() => setCollapsed(prev => !prev)}
  className={cn(
    "flex items-center gap-3 px-3 py-2 w-full rounded-lg",
    "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
    "transition-colors",
    collapsed && "justify-center",
  )}
>
  {collapsed 
    ? <PanelLeftOpen className="h-4 w-4" />
    : <>
        <PanelLeftClose className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm">Einklappen</span>
      </>
  }
</button>
```

### Sidebar Container Animation

```tsx
// Framer Motion Layout Animation
<motion.nav
  layout
  animate={{ width: collapsed ? 56 : 224 }}
  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
  className="hidden md:flex flex-col bg-sidebar border-r border-border/60 overflow-hidden"
>
```

### NavItem Collapsed State

```tsx
function NavItem({ href, label, icon: Icon, isActive, collapsed }: NavItemProps) {
  const content = (
    <Link href={href}>
      <div className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg",
        "transition-colors duration-150 relative",
        collapsed && "justify-center px-0",
        isActive
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}>
        {/* Active Indicator */}
        {isActive && (
          <motion.span
            layoutId="sidebar-active-indicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary"
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          />
        )}
        
        <Icon className="h-5 w-5 flex-shrink-0" />
        
        {/* Label – AnimatePresence für Slide-out */}
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className={cn("text-sm", isActive && "font-medium")}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </Link>
  );
  
  // Collapsed: Tooltip via Radix
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return content;
}
```

### Active Indicator Details

- **Expanded:** Linke Linie (w-[3px], h-5, rounded-r-full, bg-primary) + `layoutId` für Framer Motion Shared Layout
- **Collapsed:** Highlight des Icons + Ring: `ring-1 ring-primary/30 bg-primary/15`
- **Hover Preview (nice-to-have):** Tooltip mit erster Zeile der letzten Konversation (für Conversation-Items in der Sidebar)

### Conversation List: Hover Preview

```tsx
// Konversations-Item mit hover Preview
function ConversationItem({ conv, isActive }: ConversationItemProps) {
  const [hovered, setHovered] = useState(false);
  const preview = conv.messages?.[0]?.content?.slice(0, 60) + '…';
  
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative px-3 py-2.5 rounded-lg cursor-pointer",
        "transition-colors duration-100",
        isActive 
          ? "bg-primary/12 border border-primary/20"
          : "hover:bg-muted/40",
      )}
    >
      <p className="text-[13px] font-medium text-foreground/90 truncate">
        {conv.title || 'Neue Unterhaltung'}
      </p>
      
      {/* Hover Preview – erste Nachricht */}
      <AnimatePresence>
        {hovered && !isActive && preview && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="text-[11px] text-muted-foreground/70 mt-0.5 overflow-hidden"
          >
            {preview}
          </motion.p>
        )}
      </AnimatePresence>
      
      <span className="absolute right-3 top-2.5 text-[10px] text-muted-foreground/50 font-mono">
        {formatRelativeTime(conv.updatedAt)}
      </span>
    </div>
  );
}
```

---

## 7. Tool-Call Cards — Expand/Collapse Design

### Aktueller Stand (ToolCallBlock.tsx)
- Bereits solide Basis mit Framer Motion AnimatePresence
- Status-Icons (running/success/error) vorhanden
- Verbesserungen: Premium-Visual-Design

### Zieldesign

```
┌─────────────────────────────────────────────────────────┐
│ ▶ ✓ 🔧 Web-Suche  ("locai ollama...")           142ms  │ ← Collapsed
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ▼ ✓ 🔧 Web-Suche  ("locai ollama...")           142ms  │ ← Expanded
├─────────────────────────────────────────────────────────┤
│  Parameter                                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ { "query": "locai ollama setup" }                │  │
│  └──────────────────────────────────────────────────┘  │
│  Ergebnis                                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 1. LocAI Documentation...                        │  │
│  │ 2. GitHub: mcmuff/locai...                       │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Header-Bereich (Upgrade)

```tsx
<button
  onClick={() => setIsExpanded(prev => !prev)}
  className={cn(
    "flex items-center gap-2.5 w-full px-3 py-2.5",
    "text-left hover:bg-muted/30 transition-colors duration-100 rounded-t-lg",
    !isExpanded && "rounded-b-lg",  // Volle Rounding wenn collapsed
  )}
>
  {/* Expand Chevron mit Rotation-Animation */}
  <motion.span
    animate={{ rotate: isExpanded ? 90 : 0 }}
    transition={{ duration: 0.15 }}
    className="text-muted-foreground/60 shrink-0"
  >
    <ChevronRight className="h-3.5 w-3.5" />
  </motion.span>

  {/* Status Icon */}
  <StatusIcon status={status} />

  {/* Tool Icon + Name */}
  <div className="flex items-center gap-1.5 min-w-0 flex-1">
    <span className="text-xs">{toolEmoji[call.name] || '🔧'}</span>
    <span className="text-[13px] font-semibold text-foreground/90 truncate">
      {getToolLabel(call.name)}
    </span>
    {argsPreview && (
      <span className="font-mono text-[11px] text-muted-foreground/70 truncate hidden sm:block">
        {argsPreview.length > 45 ? argsPreview.slice(0, 45) + '…' : argsPreview}
      </span>
    )}
  </div>

  {/* Duration + Status Pill */}
  <div className="flex items-center gap-2 shrink-0 ml-auto">
    {status !== 'running' && (
      <span className="text-[11px] font-mono text-muted-foreground/60">
        {duration}
      </span>
    )}
    {status === 'running' && (
      <span className="flex items-center gap-1 text-[11px] text-blue-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>läuft…</span>
      </span>
    )}
  </div>
</button>
```

### Status Icon Component

```tsx
function StatusIcon({ status }: { status: ToolCallStatus }) {
  if (status === 'running') return (
    <motion.span
      animate={{ opacity: [1, 0.5, 1] }}
      transition={{ duration: 1.2, repeat: Infinity }}
      className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-400/50 flex items-center justify-center shrink-0"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
    </motion.span>
  );
  
  if (status === 'success') return (
    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
  );
  
  return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
}
```

### Card Border per Status

```tsx
// Container
className={cn(
  'rounded-lg border text-sm my-1.5 overflow-hidden',
  // Status-abhängige Border + Glow
  status === 'running' && [
    'border-blue-500/30',
    'bg-blue-950/10',
    'shadow-[0_0_0_1px_rgba(59,130,246,0.1),0_0_12px_rgba(59,130,246,0.05)]',
  ],
  status === 'success' && [
    'border-emerald-500/20',
    'bg-card/60',
  ],
  status === 'error' && [
    'border-red-500/30',
    'bg-red-950/10',
    'shadow-[0_0_0_1px_rgba(239,68,68,0.1)]',
  ],
)}
```

### Tool Emoji Map

```tsx
const toolEmoji: Record<string, string> = {
  search_documents: '📄',
  web_search:       '🌐',
  read_file:        '📖',
  write_file:       '✍️',
  edit_file:        '✏️',
  create_note:      '📝',
  save_memory:      '🧠',
  recall_memory:    '💭',
  run_command:      '⚡',
  run_code:         '🔬',
  generate_image:   '🎨',
};
```

---

## 8. Micro-Interactions Checklist

### Button States
- [ ] Hover: `scale(1.02)` + leichte Background-Aufhellung
- [ ] Active/Press: `scale(0.97)` (150ms)
- [ ] Focus: Cyan Ring (2px outline + 2px offset)
- [ ] Disabled: `opacity-40`, kein Cursor

### Input States
- [ ] Focus: Border wird Cyan, `ring-1 ring-primary/30`
- [ ] Error: Border wird Red, `ring-1 ring-destructive/30`
- [ ] Typing: Keine Animation (Performance!)

### Navigation
- [ ] Active Indicator: Shared `layoutId` für Framer Motion Shared Layout
- [ ] Hover: `bg-muted/50` (150ms transition)

### Loading States
- [ ] Shimmer statt Pulse (s. Skeleton-Upgrade)
- [ ] AI Streaming Cursor: Bestehende `ai-cursor` CSS Animation bleibt

---

## 9. Implementation Priority

| Priorität | Komponente                | Aufwand | Impact |
|-----------|---------------------------|---------|--------|
| 1 🔴      | globals.css Theme Update  | Klein   | Hoch   |
| 2 🔴      | Skeleton Shimmer           | Klein   | Mittel |
| 3 🟡      | Toast Redesign             | Mittel  | Hoch   |
| 4 🟡      | Chat Message Cards         | Mittel  | Hoch   |
| 5 🟡      | Code Block Upgrade         | Mittel  | Hoch   |
| 6 🟢      | Sidebar Collapse           | Gross   | Mittel |
| 7 🟢      | Empty States               | Klein   | Mittel |
| 8 🟢      | Tool-Call Card Polish      | Klein   | Mittel |

---

## 10. Nicht in Scope (Sprint 5)

- Custom SVG Illustrationen für Empty States (zu aufwändig → Lucide Icons)
- Light Theme vollständige Überarbeitung (Dark-first)
- Mobile-spezifische Gesten (kein Budget)
- Custom Font Loading (Geist already loaded)
- Rechtsklick-Kontextmenüs
