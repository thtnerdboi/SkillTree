# Source Code Protection Policy

## Overview
This document outlines the source code protection measures implemented for the SkillTree project.

## Legal Protection
- **License Type**: Proprietary and Confidential
- **Licensed Under**: LICENSE (Proprietary)
- **Copyright**: © 2026 thtnerdboi. All rights reserved.

## Prohibited Activities
Users are **strictly prohibited** from:
1. Cloning or copying the source code repository
2. Modifying or creating derivative works
3. Distributing the source code
4. Reverse engineering compiled code
5. Accessing source files after official release

## Post-Release Source Code Hiding Strategy

### Phase 1: Repository Management
- Source repository will be **archived** and made **read-only**
- All `.ts`, `.tsx`, `.js`, `.jsx` source files will be **removed**
- Configuration files containing build information will be **removed**
- Only `package.json` and compiled output (`dist/` or `build/`) will remain

### Phase 2: Distribution Protection
- NPM package will contain **only compiled/minified code** (`.npmignore`)
- Source maps will be **excluded** from distributions
- TypeScript source files will **not** be published
- Development dependencies will be **stripped** from production packages

### Phase 3: Access Control
- GitHub repository will restrict access to authorized members only
- Branch protection rules will prevent unauthorized changes
- All commits to source code history will be **squashed** before archival
- GitHub Actions workflows will **not expose** source code details

### Phase 4: Obfuscation & Minification
For TypeScript/JavaScript projects, implement:
```bash
# Minification (via webpack/terser)
terser src/**/*.js -o dist/

# Obfuscation (via javascript-obfuscator)
javascript-obfuscator src/ --output dist/

# Tree-shaking to remove unused code
webpack --mode production --optimization.usedExports=true
```

### Phase 5: Build-Time Protections
Add to build process:
```json
{
  "scripts": {
    "build": "tsc && webpack --mode production",
    "build:release": "npm run build && npm run strip-sources && npm run minify",
    "strip-sources": "rm -rf dist/src dist/**/*.ts dist/**/*.tsx",
    "minify": "terser dist/**/*.js -o dist/"
  }
}
```

## Enforcement
Violations of this protection policy may result in:
- Legal action for copyright infringement
- DMCA takedown notices for unauthorized distribution
- Cease and desist orders
- Monetary damages
- Criminal prosecution where applicable

## Questions or Licensing Inquiries
Contact: thtnerdboi

**Last Updated**: July 9, 2026
