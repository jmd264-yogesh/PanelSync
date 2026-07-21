# Pre-commit Hooks - Quick Reference

## ✅ What Runs Automatically on Every Commit

```bash
git commit -m "your message"
```

### 1. TypeScript Type Check
- Validates all TypeScript types
- Fails if any type errors exist

### 2. ESLint Auto-fix
- Runs only on staged files
- Auto-fixes fixable issues
- Fails if unfixable errors exist

---

## 🚀 Quick Commands

```bash
# Run type check manually
npm run type-check

# Run ESLint on all files
npm run lint

# Run ESLint with auto-fix
npm run lint:fix

# Bypass hooks (NOT RECOMMENDED)
git commit -m "message" --no-verify
```

---

## 📋 Current Config

**Pre-commit Hook**: `.husky/pre-commit`
```bash
npm run type-check
npx lint-staged
```

**Lint-staged**: `package.json`
```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix"]
  }
}
```

---

## 🔧 Common Fixes

### Fix: "Unexpected any" errors
```typescript
// ❌ Bad
function example(data: any) { }

// ✅ Good
function example(data: string | number) { }
```

### Fix: "Unused variable" warnings
```typescript
// ❌ Bad
function route(request: Request) {
  return Response.json({});
}

// ✅ Good - prefix with underscore
function route(_request: Request) {
  return Response.json({});
}

// ✅ Better - remove if truly unused
function route() {
  return Response.json({});
}
```

---

## 📚 Full Documentation

See [HUSKY_SETUP.md](./HUSKY_SETUP.md) for complete guide.
