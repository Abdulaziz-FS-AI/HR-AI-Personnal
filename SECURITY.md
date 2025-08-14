# 🔒 Security Guidelines for HR-AI SaaS

## Environment Variables

### ✅ DO:
- Use `.env.local` for local development
- Store API keys in environment variables only
- Use Azure Key Vault for production secrets
- Rotate API keys regularly

### ❌ DON'T:
- Never commit `.env.local` to version control
- Never hardcode API keys in source code
- Never share API keys in chat, email, or documentation
- Never use production keys in development

## API Key Security

### Hyperbolic API Key:
- Stored in: `HYPERBOLIC_API_KEY` environment variable
- Location: `.env.local` (local), Azure App Settings (production)
- Rotation: Monthly recommended
- Monitoring: Track usage and set billing alerts

### Example Setup:
```bash
# .env.local (NEVER commit this file)
HYPERBOLIC_API_KEY=your-actual-key-here
```

## Files to Never Commit:
- `.env.local`
- `.env.production` 
- `.env.development`
- Any file containing API keys or secrets
- Azure connection strings
- Database passwords

## Git Security:
```bash
# Check what's being tracked
git status

# Ensure .env.local is ignored
cat .gitignore | grep ".env.local"

# Remove accidentally committed secrets
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env.local' --prune-empty --tag-name-filter cat -- --all
```

## Production Deployment:
1. Use Azure Key Vault for secrets
2. Set environment variables in Azure App Service settings
3. Enable managed identity for secure access
4. Use connection string references, not direct values

## Code Review Checklist:
- [ ] No hardcoded API keys
- [ ] No connection strings in code
- [ ] All secrets use environment variables
- [ ] .env.local not committed
- [ ] Test files don't expose secrets

## Incident Response:
If an API key is accidentally exposed:
1. Immediately rotate the key
2. Update all deployments
3. Review access logs
4. Update security documentation

## Monitoring:
- Set up billing alerts for API usage
- Monitor for unusual API call patterns
- Track failed authentication attempts
- Review access logs regularly