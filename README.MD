# Instructions for the AI Coding Agent

This document provides detailed instructions for the AI Coding Agent to systematically document the project structure, thought process, and specific requirements for subfolders. It serves as a bootstrap file, written entirely in Markdown.

---

## 1. Documentation of the Project Folder Structure

### Goal
Ensure a clear and comprehensive overview of the project folder structure from the start.

### Instructions
- **Detailed Description**: Provide a detailed explanation of each folder’s purpose and contents (see "Project Structure" section for an example).
- **Automation**: Use a script to automatically generate and update a Markdown representation of the folder structure. Save it as `folder_structure.md` in the project root.
  - Example script command: `tree -f --noreport -I "node_modules" > folder_structure.md`.
- **Updates**: Re-run the script and update `folder_structure.md` whenever the structure changes.

### Why This Matters
- A detailed description helps the AI Agent understand the project layout and document it accurately.
- Automation reduces manual effort and ensures consistency.

---

## 2. Documentation of the Thought Process

### Goal
Document the thought process and project development in a traceable and consistent manner.

### Instructions
1. **Check**: Verify if a `thoughtprocess` folder exists in the project root.
2. **Create**: If it doesn’t exist, create the `thoughtprocess` folder.
3. **Document**:
   - **Numbering**: Determine the next sequential number (three digits, e.g., `001`, `002`) based on existing files.
   - **Text File Creation**:
     - Create a file named `<number>_thoughtprocess.txt` (e.g., `001_thoughtprocess.txt`) in the `thoughtprocess` folder.
     - Record the current thought process in this file using a standardized format:
       ```
       Date: YYYY-MM-DD
       Description: [Brief summary of the thought process]
       Decisions: [Key decisions made]
       Next Steps: [Planned actions]
       ```
   - **Code Versioning**:
     - Save a copy of the current `MainProject` file(s) as `<number>_code_snapshot.<extension>` (e.g., `001_code_snapshot.tsx`).
     - Store it in the `thoughtprocess` folder to track changes over time.
4. **Consistency**: Ensure numbering increments correctly without overwriting existing files.

### Why This Matters
- A standardized format ensures readability and consistency.
- Versioning tracks code evolution alongside thoughts.
- Automation (e.g., via a script) could further streamline this process.

---

## 3. README.md Files for Subfolders

### Goal
Equip each subfolder with its own `README.md` file containing specific, relevant information.

### Instructions
1. **On Subfolder Creation**:
   - Automatically generate a `README.md` file in every new subfolder.
2. **Content Template**:
   ```
   # [Subfolder Name]

   ## Purpose
   [Describe the purpose of this subfolder.]

   ## Contents
   - [List key files or subdirectories and their roles.]

   ## Instructions
   [Add specific instructions or notes for this subfolder.]
   ```
3. **Updates**: Revise the `README.md` file whenever the subfolder’s purpose or contents change.

### Why This Matters
- A template ensures uniform documentation across the project.
- Automation (e.g., a script analyzing folder contents) minimizes manual effort.

---

## Professional Next.js Chat Application - Main Goal

### Overview
Develop a modern, sophisticated Next.js chat application using TypeScript and Tailwind CSS, inspired by the Grok 3 Realworld application. Leverage Ollama to run AI models locally.

### Why This Matters
- A clear goal helps the AI Agent align its efforts with the project vision.

---

## Design Features

### Details
- **Professional Appearance**: Elegant, user-friendly UI with subtle, non-distracting sound effects (SFX).
  - Example: Soft click sounds for button interactions.
- **Centered Chat Area**: Optimized layout mimicking state-of-the-art chat pages (e.g., ChatGPT).
- **Responsive Design**: Seamless functionality across desktops, tablets, and mobile devices.
- **Modern UI Components**: Incorporate subtle animations and transitions (e.g., fade-ins via Framer Motion).
- **Intuitive User Interface**: Clear visual hierarchy with logical navigation and minimal clutter.

### Why This Matters
- Detailed descriptions and examples clarify expectations for the AI Agent.

---

## Technologies

### Stack
- **[Next.js](https://nextjs.org/) (v14.x)**: React framework for production-grade applications.
- **[TypeScript](https://www.typescriptlang.org/) (v5.x)**: JavaScript with type safety.
- **[Tailwind CSS](https://tailwindcss.com/) (v3.x)**: Utility-first CSS for rapid, consistent design.
- **[Framer Motion](https://www.framer.com/motion/) (v11.x)**: Animation library for React components.
- **[Shadcn/ui](https://ui.shadcn.com/)**: High-quality, customizable UI components.

### Why This Matters
- Specifying versions ensures compatibility.
- Links to documentation provide the AI Agent with resources.

---

## Getting Started

### Instructions
1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
4. **Access the App**: Open [http://localhost:3000](http://localhost:3000) in your browser.

### Troubleshooting
- **Error: "Port 3000 is in use"**: Change the port with `npm run dev -- -p 3001`.
- **Missing Dependencies**: Run `npm install` again or check `package.json`.

### Why This Matters
- Detailed steps and troubleshooting tips ensure smooth setup.

---

## Design System

### Elements
- **Color Palette**: Elegant gray tones (#4B5E6A, #D3DCE6) with subtle accents (#FF6F61).
- **Typography**: Use "Inter" for readability (400, 600 weights) and balanced hierarchy.
- **Spacing**: Consistent 4px increments (e.g., 8px, 16px, 24px) for harmony.
- **Components**: Reusable elements (e.g., buttons, modals) with unified styling.

### Why This Matters
- A detailed design system ensures visual consistency.

---

## Project Structure

### Overview
```
├── src/
│   ├── app/                   # Core application files
│   │   ├── page.tsx          # Homepage component
│   │   ├── layout.tsx        # Root layout with metadata
│   │   ├── globals.css       # Global styles (Tailwind directives)
│   │   └── chat/             # Chat-related routes and components
│   ├── components/           # Reusable UI components
│   │   ├── ui/               # Base UI components (e.g., buttons)
│   │   └── chat/             # Chat-specific components
│   ├── lib/                  # Utility functions and helpers
│   ├── styles/               # Additional CSS definitions
│   └── types/                # TypeScript type definitions
├── public/                   # Static assets (e.g., images)
├── thoughtprocess/           # Thought process logs and code snapshots
├── next.config.js            # Next.js configuration
└── package.json              # Project dependencies and scripts
```

### Why This Matters
- A detailed structure with descriptions aids navigation and understanding.

---

## Design Inspiration

### Details
The design draws from the Grok 3, ChatGPT, and Claude 3.7 Realworld applications, emphasizing:
- **Clear User Guidance**: Intuitive layouts and prompts.
- **Elegant Coloring**: Subtle, non-intrusive tones.
- **Centered Content**: Optimal readability with a focused chat area.
- **Subtle Animations**: Lively yet unobtrusive transitions.
- **Local Model Execution**: Use Ollama for running AI models locally.

### Why This Matters
- Specific inspirations guide the AI Agent toward the desired aesthetic and functionality.

---

## Summary of Improvements

1. **Detailed Descriptions**: Added for folder structure, thought process, goals, design features, and more.
2. **Automation**: Suggested scripts for folder structure and README generation.
3. **Standardization**: Introduced templates for thought process files and READMEs.
4. **Technology Details**: Included versions and documentation links.
5. **Setup Clarity**: Enhanced "Getting Started" with troubleshooting.
6. **Visual Consistency**: Defined a detailed design system.

#   l o c a i  
 