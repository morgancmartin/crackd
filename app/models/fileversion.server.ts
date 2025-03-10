import { DirectoryNode, FileSystemTree } from "@webcontainer/api";

export const defaultFiles: DirectoryNode = {
  directory: {
    "vite.config.ts": {
      file: {
        contents: `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {},
});`,
      },
    },
    "tsconfig.node.json": {
      file: {
        contents: `
      {
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
      `,
      },
    },
    "tsconfig.json": {
      file: {
        contents: `
      {
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
      `,
      },
    },
    "tsconfig.app.json": {
      file: {
        contents: `
      {
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}

      `,
      },
    },
    "tailwind.config.js": {
      file: {
        contents: `
      /** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};

      `,
      },
    },
    "postcss.config.js": {
      file: {
        contents: `
      export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
      `,
      },
    },
    "package.json": {
      file: {
        contents: `
      {
  "name": "vite-react-typescript-starter",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.9.1",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.18",
    "eslint": "^9.9.1",
    "eslint-plugin-react-hooks": "^5.1.0-rc.0",
    "eslint-plugin-react-refresh": "^0.4.11",
    "globals": "^15.9.0",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.5.3",
    "typescript-eslint": "^8.3.0",
    "vite": "^5.4.2"
  }
}

      `,
      },
    },
    "index.html": {
      file: {
        contents: `
      <!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>

      `,
      },
    },
    "eslint.config.js": {
      file: {
        contents: `
      import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  }
);

      `,
      },
    },
    ".gitignore": {
      file: {
        contents: `
      # Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

      `,
      },
    },
    src: {
      directory: {
        "vite-env.d.ts": {
          file: {
            contents: `
      /// <reference types="vite/client" />
      `,
          },
        },
        "main.tsx": {
          file: {
            contents: `
      import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

      `,
          },
        },
        "index.css": {
          file: {
            contents: `
      @tailwind base;
@tailwind components;
@tailwind utilities;
      `,
          },
        },
        "App.tsx": {
          file: {
            contents: `
      import React from 'react';

function App() {
  return (
    <div></div>
  );
}
export default App;
      `,
          },
        },
      },
    },
  },
};

export const fartFiles: FileSystemTree = {
  "vite.config.ts": {
    file: {
      contents: `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});`,
    },
  },
  "tsconfig.node.json": {
    file: {
      contents: `
      {
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
      `,
    },
  },
  "tsconfig.json": {
    file: {
      contents: `
      {
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
      `,
    },
  },
  "tsconfig.app.json": {
    file: {
      contents: `
      {
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}

      `,
    },
  },
  "tailwind.config.js": {
    file: {
      contents: `
      /** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};

      `,
    },
  },
  "postcss.config.js": {
    file: {
      contents: `
      export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
      `,
    },
  },
  "package.json": {
    file: {
      contents: `
      {
  "name": "vite-react-typescript-starter",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^0.344.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.9.1",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.18",
    "eslint": "^9.9.1",
    "eslint-plugin-react-hooks": "^5.1.0-rc.0",
    "eslint-plugin-react-refresh": "^0.4.11",
    "globals": "^15.9.0",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.5.3",
    "typescript-eslint": "^8.3.0",
    "vite": "^5.4.2"
  }
}

      `,
    },
  },
  "index.html": {
    file: {
      contents: `
      <!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>

      `,
    },
  },
  "eslint.config.js": {
    file: {
      contents: `
      import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  }
);

      `,
    },
  },
  ".gitignore": {
    file: {
      contents: `
      # Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

      `,
    },
  },
  src: {
    directory: {
      "vite-env.d.ts": {
        file: {
          contents: `
      /// <reference types="vite/client" />
      `,
        },
      },
      "main.tsx": {
        file: {
          contents: `
      import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

      `,
        },
      },
      "index.css": {
        file: {
          contents: `
      @tailwind base;
@tailwind components;
@tailwind utilities;
      `,
        },
      },
      "App.tsx": {
        file: {
          contents: `
      import React from 'react';
import { Music, Volume2 } from 'lucide-react';

type FartSound = {
  name: string;
  url: string;
};

const fartSounds: FartSound[] = [
  { name: 'Classic Toot', url: 'https://www.soundjay.com/human/sounds/fart-01.mp3' },
  { name: 'Squeaker', url: 'https://www.soundjay.com/human/sounds/fart-02.mp3' },
  { name: 'Ripper', url: 'https://www.soundjay.com/human/sounds/fart-03.mp3' },
  { name: 'Quick Poot', url: 'https://www.soundjay.com/human/sounds/fart-04.mp3' },
  { name: 'Bass Blast', url: 'https://www.soundjay.com/human/sounds/fart-05.mp3' },
  { name: 'Thunder Clap', url: 'https://www.soundjay.com/human/sounds/fart-06.mp3' },
];

function App() {
  const playSound = (url: string) => {
    const audio = new Audio(url);
    audio.play();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Music className="w-12 h-12 text-white animate-bounce" />
            <h1 className="text-4xl font-bold text-white">Fart Symphony</h1>
            <Volume2 className="w-12 h-12 text-white animate-bounce" />
          </div>
          <p className="text-white text-xl">Your one-stop shop for premium toots!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fartSounds.map((sound) => (
            <button
              key={sound.name}
              onClick={() => playSound(sound.url)}
              className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:scale-105 transition-transform duration-200 hover:bg-white/95 group"
            >
              <div className="text-center">
                <h3 className="text-xl font-semibold text-purple-700 mb-2">{sound.name}</h3>
                <Volume2 className="w-8 h-8 mx-auto text-pink-500 group-hover:animate-bounce" />
              </div>
            </button>
          ))}
        </div>

        <footer className="text-center mt-12 text-white/80 text-sm">
          <p>🎵 Click any button to play a sound!</p>
          <p className="mt-2">Please use responsibly 😉</p>
        </footer>
      </div>
    </div>
  );
}
export default App;
      `,
        },
      },
    },
  },
};
