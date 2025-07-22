# Contributing Guidelines

## Do Not Change `vercel.json` Without Approval

The `vercel.json` file is essential for correct deployment to Vercel. Its current configuration ensures:
- Static assets (JS, CSS, images) are served with the correct MIME type
- SPA routing works as expected
- API routes are handled properly

**Do not modify this file unless you are certain of the deployment requirements.**

If you believe a change is needed, please:
1. Open an issue or discuss with the project maintainer.
2. Review the deployment documentation and test changes in a staging environment before merging to main.

Incorrect changes may break production deployments and cause blank pages or asset errors.
