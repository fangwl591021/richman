# Richman Ruflo Workflow Pack

Purpose: Use Ruflo/agent orchestration to improve this static LIFF project without moving production runtime out of Cloudflare Worker + LIFF.

## Boundaries

- Do not put Ruflo runtime code into browser HTML.
- Do not store LINE UID, coupon state, or merchant data in agent memory.
- Treat Cloudflare Worker API as the source of truth for coupon and merchant operations.
- Treat localStorage as UI cache only.

## Workflow: richman-release-check

Goal: Verify a change is safe to publish.

Steps:
1. Inspect `git status --short` and confirm changed files are expected.
2. Run `git diff --check`.
3. Run `node --check common.js`.
4. Extract inline scripts from changed HTML files and run `node --check` on each extracted script.
5. Check cache-busting query strings when `common.js` changes.
6. Confirm README/docs mention any changed operational behavior.

Expected output:
- Changed file summary.
- Verification commands and pass/fail status.
- Any publish blockers.

## Workflow: coupon-flow-review

Goal: Prevent false success for coupon operations.

Review points:
- `verifyCoupon()` must return false on network/API failure.
- `abandonCoupon()` must return false on network/API failure.
- Frontend may update local `usedCoupons` only after backend success or explicit already-processed response.
- UI should re-enable buttons when operation fails.
- Alerts must distinguish success from retryable failure.

## Workflow: liff-login-review

Goal: Prevent fake login logic from shadowing LIFF.

Review points:
- `index.html` must not define a local `startLineLogin()` that overrides `common.js`.
- Login buttons should call the shared login flow or redirect to `login.html` intentionally.
- Logout clears local/session LINE fields and then requires a real login again.
- `common.js?v=` should be bumped when shared login behavior changes.

## Workflow: merchant-data-safety

Goal: Avoid unsafe or broken merchant data rendering.

Review points:
- Merchant name and discount text are escaped before injecting into `innerHTML`.
- Image URLs allow only `http://` or `https://`, otherwise use fallback image.
- LINE and map links are URI-encoded when embedded in onclick handlers.
- Missing LINE/map values disable the related buttons.
- External map destination is a real deployed URL, not a missing local page.

## Workflow: admin-ops-review

Goal: Keep merchant approval and delete actions operationally clear.

Review points:
- Destructive actions require confirmation.
- API errors are visible to the operator.
- Tables reload after successful state changes.
- Debug view shows raw payload when API shape changes.
- Do not expose secrets or admin tokens in static HTML.

## Suggested Agent Roles

- `frontend-qa`: checks HTML/CSS/JS rendering and syntax.
- `api-contract-reviewer`: checks Worker action names, request bodies, and response assumptions.
- `security-reviewer`: checks unsafe HTML injection, URL handling, and exposed secrets.
- `docs-maintainer`: updates README and operator notes.
- `release-captain`: runs final checks and produces publish summary.