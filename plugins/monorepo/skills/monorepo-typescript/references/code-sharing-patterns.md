# Code Sharing Patterns for TypeScript Monorepos

Patterns for sharing configurations, components, utilities, and types across packages, plus publishing workflows.

---

> **Attribution:** Portions adapted from [Monorepo Management Skill](https://github.com/wshobson/agents/blob/main/plugins/developer-essentials/skills/monorepo-management/SKILL.md) by Seth Hobson, licensed under MIT License.
>
> Copyright (c) 2024 Seth Hobson

---

## Shared Configurations

### TypeScript Configuration Hierarchy

```
packages/tsconfig/
├── package.json
├── base.json          # Core settings
├── react.json         # React-specific
├── node.json          # Node.js backend
└── nextjs.json        # Next.js apps
```

**packages/tsconfig/base.json:**

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", "dist"]
}
```

**packages/tsconfig/react.json:**

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

**packages/tsconfig/node.json:**

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "lib": ["ES2022"]
  }
}
```

**packages/tsconfig/package.json:**

```json
{
  "name": "@company/tsconfig",
  "version": "1.0.0",
  "private": true,
  "files": ["*.json"]
}
```

**Usage in apps/packages:**

```json
{
  "extends": "@company/tsconfig/react.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [
    { "path": "../../packages/shared" }
  ]
}
```

### ESLint Configuration

**packages/eslint-config/package.json:**

```json
{
  "name": "@company/eslint-config",
  "version": "1.0.0",
  "private": true,
  "main": "index.js",
  "dependencies": {
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-react": "^7.33.0",
    "eslint-plugin-react-hooks": "^4.6.0"
  }
}
```

**packages/eslint-config/index.js:**

```javascript
module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn",
  },
  ignorePatterns: ["dist/", "node_modules/", "*.js"],
};
```

**packages/eslint-config/react.js:**

```javascript
module.exports = {
  extends: [
    "./index.js",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  plugins: ["react", "react-hooks"],
  settings: {
    react: { version: "detect" },
  },
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
  },
};
```

**Usage:**

```javascript
// apps/web/.eslintrc.js
module.exports = {
  extends: ["@company/eslint-config/react"],
  parserOptions: {
    project: "./tsconfig.json",
  },
};
```

### Prettier Configuration

**packages/prettier-config/package.json:**

```json
{
  "name": "@company/prettier-config",
  "version": "1.0.0",
  "private": true,
  "main": "index.json"
}
```

**packages/prettier-config/index.json:**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

**Usage in root package.json:**

```json
{
  "prettier": "@company/prettier-config"
}
```

---

## Code Sharing Patterns

### Pattern 1: Shared UI Component Library

**packages/ui/package.json:**

```json
{
  "name": "@company/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./button": {
      "types": "./dist/button.d.ts",
      "import": "./dist/button.js"
    },
    "./input": {
      "types": "./dist/input.d.ts",
      "import": "./dist/input.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts src/button.tsx src/input.tsx --format esm --dts",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "lint": "eslint src/"
  },
  "devDependencies": {
    "@company/eslint-config": "workspace:*",
    "@company/tsconfig": "workspace:*",
    "tsup": "^8.0.0",
    "typescript": "catalog:"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

**packages/ui/src/button.tsx:**

```tsx
import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className ?? ''}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <span className="spinner" /> : children}
    </button>
  );
}
```

**packages/ui/src/index.ts:**

```typescript
export { Button, type ButtonProps } from './button';
export { Input, type InputProps } from './input';
export { Card, type CardProps } from './card';
```

**Usage in apps:**

```tsx
// apps/web/src/app.tsx
import { Button, Input } from '@company/ui';
// Or tree-shakeable imports:
import { Button } from '@company/ui/button';

export function App() {
  return (
    <form>
      <Input placeholder="Enter email" />
      <Button variant="primary" type="submit">
        Submit
      </Button>
    </form>
  );
}
```

### Pattern 2: Shared Utilities Library

**packages/utils/package.json:**

```json
{
  "name": "@company/utils",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "test": "vitest"
  }
}
```

**packages/utils/src/string.ts:**

```typescript
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, length: number, suffix = '...'): string {
  return str.length > length ? str.slice(0, length) + suffix : str;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
```

**packages/utils/src/array.ts:**

```typescript
export function chunk<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
}

export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce(
    (acc, item) => {
      const key = keyFn(item);
      (acc[key] ??= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
}
```

**packages/utils/src/index.ts:**

```typescript
export * from './string';
export * from './array';
export * from './date';
export * from './validation';
```

### Pattern 3: Shared Types Package

**packages/types/package.json:**

```json
{
  "name": "@company/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc --emitDeclarationOnly"
  }
}
```

**packages/types/src/user.ts:**

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
}
```

**packages/types/src/api.ts:**

```typescript
export interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    total: number;
    pageSize: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };
```

**Usage (frontend and backend):**

```typescript
// apps/api/src/routes/users.ts
import type { User, CreateUserInput, ApiResponse } from '@company/types';

export async function createUser(input: CreateUserInput): Promise<ApiResponse<User>> {
  // ...
}

// apps/web/src/api/users.ts
import type { User, CreateUserInput, ApiResponse } from '@company/types';

export async function createUser(input: CreateUserInput): Promise<ApiResponse<User>> {
  const res = await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.json();
}
```

---

## Package Publishing with Changesets

### Setup

```bash
# Install changesets
pnpm add -Dw @changesets/cli

# Initialize
pnpm changeset init
```

**.changeset/config.json:**

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@company/eslint-config", "@company/tsconfig"]
}
```

### Workflow

**1. Create changeset when making changes:**

```bash
pnpm changeset
# Prompts:
# - Which packages changed? (select)
# - Major/minor/patch?
# - Summary of changes
```

Creates `.changeset/random-name.md`:

```markdown
---
"@company/ui": minor
"@company/utils": patch
---

Added new Card component to UI library.
Fixed truncate function edge case in utils.
```

**2. Version packages (before release):**

```bash
pnpm changeset version
```

This:
- Updates package.json versions
- Updates CHANGELOG.md files
- Deletes consumed changeset files

**3. Publish packages:**

```bash
pnpm changeset publish
```

### CI/CD Integration

**.github/workflows/release.yml:**

```yaml
name: Release

on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm turbo build --filter="./packages/*"

      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          version: pnpm changeset version
          publish: pnpm changeset publish
          title: 'chore: version packages'
          commit: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Publishing Public Packages

For public npm packages, update config:

```json
{
  "access": "public"
}
```

And ensure packages have correct settings:

```json
{
  "name": "@company/ui",
  "version": "1.0.0",
  "private": false,
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org"
  },
  "files": ["dist"],
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

---

## Best Practices

### Dependency Management

1. **Use `workspace:*` for internal deps** — always latest
2. **Use `catalog:` for shared external deps** — consistent versions
3. **Peer dependencies for frameworks** — React, Vue in component libs
4. **Regular updates** — `pnpm update -r` weekly

### Package Structure

1. **Consistent exports** — use package.json `exports` field
2. **TypeScript declarations** — always include `.d.ts`
3. **Source maps** — enable for debugging
4. **Tree-shaking** — use ESM format, avoid barrel re-exports where possible

### Build Strategy

1. **Build dependencies first** — `dependsOn: ["^build"]`
2. **Cache build outputs** — dist/, .next/
3. **Incremental builds** — TypeScript `incremental: true`
4. **Use tsup for libraries** — faster than tsc for bundling

---

## Resources

- Turborepo: https://turbo.build/repo/docs
- Changesets: https://github.com/changesets/changesets
- tsup: https://tsup.egoist.dev/
- pnpm catalogs: https://pnpm.io/catalogs
