# Contributing Guide

Thanks for contributing to Query Analyzer! Here's how to get started.

---

## Setup (5 minutes)

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/query-analyzer.git
cd query-analyzer

# 2. Install
npm install

# 3. Verify
npm test && npm run build
```

✅ If tests pass, you're ready to go!

---

## Making Changes

### 1. Create Branch
```bash
git checkout -b fix/your-bug-fix
# or
git checkout -b feat/your-feature
```

### 2. Write Code + Tests
```typescript
// src/analyzer.ts - Your implementation
export function newFeature() { }

// tests/analyzer.test.ts - Your tests
it('should work correctly', () => {
  expect(newFeature()).toBe(expected);
});
```

### 3. Test
```bash
npm test          # All tests must pass
npm run build     # Must compile without errors
```

### 4. Commit
```bash
git commit -m "feat: add amazing feature"
```

Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` New feature
- `fix:` Bug fix  
- `docs:` Documentation
- `test:` Tests only
- `refactor:` Code refactoring

### 5. Submit PR
```bash
git push origin your-branch-name
```

Then create a Pull Request on GitHub.

---

## Project Structure

```
src/
├── analyzer.ts    # Main logic
├── csvUtil.ts     # CSV operations
├── errors.ts      # Error classes
├── types.ts       # TypeScript types
└── index.ts       # Public exports

tests/
├── analyzer.test.ts
├── csvUtil.test.ts
└── errors.test.ts
```

---

## Testing

```bash
npm test                    # Run all
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage
npm test -- analyzer.test   # Specific file
```

**All tests must pass before submitting PR** ✅

---

## PR Checklist

Before submitting:

- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] Tests added for new features/fixes
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow convention

---

## Common Tasks

### Adding New Feature
1. Write failing test first (TDD)
2. Implement feature
3. Test passes
4. Update docs

### Fixing Bug
1. Write test that reproduces bug
2. Fix implementation
3. Test passes
4. Done!

---

## Code Standards

- Use TypeScript strict mode
- Add JSDoc for public APIs
- Follow existing code style
- Write tests for everything
- Mock external dependencies

---

## Need Help?

- [Open an issue](https://github.com/Sohaib-Abid/query-analyzer/issues)
- Check existing issues
- Read the [README](./readme.md)

---

## License

MIT - By contributing, you agree to license your work under MIT.

**Happy coding!** 🚀
