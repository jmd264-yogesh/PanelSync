# Husky Pre-commit Setup Guide

This project uses **Husky** to run automated checks before each commit to maintain code quality and catch issues early.

---

## What's Configured

### Pre-commit Hook (`/.husky/pre-commit`)

Every time you try to commit code, the following checks run automatically:

1. **TypeScript Type Check** (`tsc --noEmit`)
   - Ensures all TypeScript code compiles without type errors
   - Does not emit output files, just validates types
   - Runs on the entire codebase

2. **ESLint on Staged Files** (`lint-staged`)
   - Runs ESLint with auto-fix on only the files you're committing
   - Fixes auto-fixable issues automatically
   - Fails the commit if there are unfixable errors
   - Much faster than linting the entire codebase

---

## Available NPM Scripts

```bash
# Run full ESLint check on entire codebase
npm run lint

# Run ESLint with auto-fix on entire codebase
npm run lint:fix

# Run TypeScript type check without emitting files
npm run type-check

# Development server
npm run dev

# Production build (includes type checking and linting)
npm run build
```

---

## How It Works

### When You Commit

```bash
git add .
git commit -m "Your commit message"
```

**What happens automatically:**

```
🔍 Running TypeScript type check...
✓ Type check passed

🔍 Running ESLint on staged files...
✓ ESLint passed (or auto-fixed issues)

✓ Commit successful
```

### If There Are Issues

**Scenario 1: Auto-fixable ESLint issues**
```
🔍 Running ESLint on staged files...
⚠ Fixed 3 issues automatically
✓ Changes applied to staged files

→ Your commit will include the auto-fixed code
```

**Scenario 2: Non-fixable TypeScript errors**
```
🔍 Running TypeScript type check...
✗ Found 2 type errors:
  src/app/api/example/route.ts:42:10 - Type 'string' is not assignable to type 'number'

✗ Commit aborted

→ Fix the errors and try committing again
```

**Scenario 3: Non-fixable ESLint errors**
```
🔍 Running ESLint on staged files...
✗ Found 1 error:
  src/components/Example.tsx:12:5 - Unexpected any. Specify a different type

✗ Commit aborted

→ Fix the error manually and commit again
```

---

## Lint-Staged Configuration

**File**: `package.json` → `"lint-staged"` section

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix"
    ]
  }
}
```

This configuration:
- Only runs on **staged files** (not the entire codebase)
- Runs **ESLint with auto-fix** on TypeScript/JavaScript files
- Automatically adds fixed files back to the commit

---

## Common Issues & Solutions

### Issue: "Husky command not found"

**Cause**: Husky wasn't installed properly

**Solution**:
```bash
npm install
npm run prepare
```

---

### Issue: "Pre-commit hook not running"

**Cause**: Git hooks might not be executable

**Solution** (Git Bash / WSL):
```bash
chmod +x .husky/pre-commit
```

**Solution** (Windows):
- Hooks should work automatically
- If not, ensure you're using Git Bash or WSL for commits

---

### Issue: "Too many errors, commit is slow"

**Cause**: Large number of existing issues in the codebase

**Solutions**:

**Option 1**: Fix issues incrementally
```bash
# See all issues
npm run lint

# Auto-fix what can be fixed
npm run lint:fix

# Commit the fixes
git add .
git commit -m "fix: address ESLint issues"
```

**Option 2**: Temporarily bypass hooks (NOT RECOMMENDED)
```bash
# Only use this if absolutely necessary
git commit -m "Your message" --no-verify

# Or use the shorthand
git commit -m "Your message" -n
```

⚠️ **WARNING**: Bypassing hooks defeats the purpose of having them. Only use this in emergencies.

---

### Issue: "Type check fails but I want to commit anyway"

**Best Practice**: Fix the type errors before committing. Type safety is important.

**If you must bypass** (NOT RECOMMENDED):
```bash
git commit -m "Your message" --no-verify
```

---

## Current ESLint Issues in Codebase

As of setup, the following issues exist (run `npm run lint` to see full list):

### High Priority (Errors)
- **Unexpected any types**: 15+ instances across API routes
  - Location: Various `route.ts` files in `src/app/api/`
  - Fix: Replace `any` with proper TypeScript types

### Medium Priority (Warnings)
- **Unused variables**: 8+ instances
  - Example: `'_request' is defined but never used`
  - Fix: Remove unused variables or prefix with `_` if intentional

---

## Customizing the Setup

### To Add More Checks

Edit `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Running TypeScript type check..."
npm run type-check

echo "🔍 Running ESLint on staged files..."
npx lint-staged

# Add more checks here:
# echo "🧪 Running tests..."
# npm test

# echo "📝 Running Prettier..."
# npx prettier --check .
```

---

### To Change What lint-staged Runs

Edit `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"  // Add Prettier
    ],
    "*.css": [
      "stylelint --fix"  // Add CSS linting
    ]
  }
}
```

---

### To Disable Specific ESLint Rules

Edit `eslint.config.mjs`:

```js
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn', // Change to warning
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',  // Allow unused vars starting with _
      }],
    },
  },
  globalIgnores([...]),
]);
```

---

## Best Practices

### ✅ DO:
- Fix type errors before committing
- Let ESLint auto-fix issues automatically
- Run `npm run type-check` locally during development
- Use proper TypeScript types instead of `any`
- Remove unused variables or prefix with `_`

### ❌ DON'T:
- Use `--no-verify` to bypass hooks regularly
- Commit code with TypeScript errors
- Ignore ESLint warnings indefinitely
- Use `@ts-ignore` or `eslint-disable` without good reason

---

## Testing the Setup

### Test Type Check
```bash
npm run type-check
```

Should complete with no output if no errors exist.

---

### Test ESLint
```bash
npm run lint
```

Shows all issues in the codebase.

---

### Test Auto-fix
```bash
npm run lint:fix
```

Fixes auto-fixable issues.

---

### Test Pre-commit Hook
```bash
# Make a small change
echo "// test" >> src/test.ts

# Stage it
git add src/test.ts

# Try to commit
git commit -m "test: verify pre-commit hook"

# Should run type-check and lint-staged
```

---

## Maintenance

### Keep Dependencies Updated
```bash
# Check for updates
npm outdated

# Update Husky
npm install --save-dev husky@latest

# Update lint-staged
npm install --save-dev lint-staged@latest

# Update ESLint
npm install --save-dev eslint@latest
```

---

### After Installing New Dependencies

Husky's `prepare` script runs automatically after `npm install`, but if you need to run it manually:

```bash
npm run prepare
```

---

## Architecture

### File Structure
```
├── .husky/
│   ├── _/                    # Husky internals (auto-generated)
│   └── pre-commit            # Pre-commit hook script
├── eslint.config.mjs         # ESLint configuration
├── package.json              # Contains scripts and lint-staged config
└── tsconfig.json             # TypeScript configuration
```

---

### Hook Execution Flow
```
1. Developer runs: git commit -m "message"
2. Git triggers:   .husky/pre-commit
3. Script runs:    npm run type-check
4. If success:     npx lint-staged
5. If success:     Commit proceeds
6. If failure:     Commit is aborted with error message
```

---

## Additional Resources

- **Husky Documentation**: https://typicode.github.io/husky/
- **lint-staged Documentation**: https://github.com/lint-staged/lint-staged
- **ESLint Documentation**: https://eslint.org/docs/latest/
- **TypeScript Documentation**: https://www.typescriptlang.org/docs/

---

## Support

If you encounter issues with the pre-commit setup:

1. Check this guide for common issues
2. Run `npm install` to ensure dependencies are installed
3. Try `npm run prepare` to reinitialize Husky
4. Check that `.husky/pre-commit` exists and is executable
5. Ensure you're using a recent version of Git (2.9+)

---

**Last Updated**: 2026-07-21  
**Husky Version**: 9.1.7  
**lint-staged Version**: 17.1.0
