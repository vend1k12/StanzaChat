# Security Policy

StanzaChat is an open-source, self-hosted AI workspace maintained by a small group of volunteers. We take security seriously and appreciate coordinated disclosure of vulnerabilities.

## Supported Versions

StanzaChat is pre-1.0. Only the **latest published 0.x minor release** receives security fixes; older minors are unsupported. Once 1.0 ships this table will be revised.

| Version          | Supported |
| ---------------- | --------- |
| latest 0.x minor | Yes       |
| older 0.x minors | No        |

## Reporting a Vulnerability

**Do not open a public GitHub issue for suspected vulnerabilities.**

Report privately through GitHub Private Vulnerability Reporting:

- https://github.com/vend1k12/StanzaChat/security/advisories/new

Include, when possible:

- StanzaChat version / commit SHA
- Deployment method (single-user compose, team compose, custom)
- Impact and reproduction steps (proof-of-concept preferred; sanitized logs help)
- Affected component (auth, sandbox, provider key handling, tenancy, migrations, etc.)
- Your assessment of severity and exploitability

### Response expectations

We are a volunteer OSS project, so all timelines are **best-effort**:

- **Triage acknowledgement:** within 72 hours (best-effort).
- **Initial assessment:** within 7 days after acknowledgement.
- **Fix + coordinated disclosure:** timeline agreed with the reporter based on severity. Credit is given in the published advisory unless anonymity is requested.

If you do not receive an acknowledgement within a week, feel free to send a gentle nudge through the same Private Vulnerability Reporting channel.

## Scope

In-scope areas map to the security model in `SPEC.MD` §7 and the hard constraints in `docs/agents/guardrails.md`:

- **Artifact sandbox (`SPEC.MD` §5.3):** iframe isolation, `postMessage` token validation, CSP hardening. Model-generated code is treated as untrusted input; a sandbox escape or ability to reach host storage / cookies / top-frame navigation is in scope.
- **Tenancy:** cross-organization or cross-workspace data access via any API surface is a P0 bug class and always in scope.
- **Provider key handling:** any path that exposes decrypted provider keys to the client, to logs, or to other tenants.
- **Authentication & authorization:** Better-Auth session handling, the `admin` and `organization` plugins, and the single authorization helper in `packages/auth`.
- **Boot secrets:** ways to start the app in production with missing/default `BETTER_AUTH_SECRET` or `ENCRYPTION_MASTER_KEY`.
- **Audit logging:** any way to mutate or delete `audit_logs` rows.
- **Supply chain:** dependency confusion, malicious workflow triggers, or CI privilege escalation targeting this repository.

### Out of scope

- Findings against a self-hoster's own deployment configuration (reverse proxy, network exposure, host OS hardening) unless caused by a StanzaChat default.
- Denial of service that requires the attacker to already be an authenticated org admin of the target organization.
- Missing security headers on endpoints that are not user-reachable in a default deployment.
- Reports produced solely by automated scanners with no exploit path.

## Safe harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, or service disruption.
- Report through the private channel above and give us reasonable time to fix before public disclosure.
- Do not exploit the vulnerability beyond what is necessary to demonstrate it.

Thank you for helping keep StanzaChat and its self-hosters safe.
