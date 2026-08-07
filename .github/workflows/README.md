# GitHub Actions workflows

## `backend.yml`

Builds, pushes, and deploys the Fitso backend.

- On every pull request to `main` that touches `server/**`: builds the Docker image (does not push).
- On every push to `main` that touches `server/**`:
  1. Builds and pushes `ghcr.io/kamikaazeyy/fitso-backend:latest` (and a SHA-tagged version) to GitHub Container Registry.
  2. SSHs into the server, uses the workflow's `GITHUB_TOKEN` for a temporary `docker login`, pulls the image, and restarts `backend` and `caddy`.

### Required GitHub secrets

| Secret | Description |
|--------|-------------|
| `SERVER_HOST` | IP or hostname reachable from GitHub Actions (e.g. public IP, Tailscale exit node, or bastion). |
| `SERVER_USER` | SSH user on the server (e.g. `root`). |
| `SERVER_SSH_KEY` | Private half of an SSH key added to `~/.ssh/authorized_keys` on the server. |
| `SERVER_SSH_PORT` | (Optional) SSH port. Defaults to `22`. |

No separate GHCR token is required. The `deploy` job passes the built-in `GITHUB_TOKEN` to the server for a temporary GHCR login.

### One-time server setup

1. Add the public SSH key to `/root/.ssh/authorized_keys` (or whichever `SERVER_USER` you use).
2. Ensure the GHCR package can be pulled:
   - If the package is public, `docker pull ghcr.io/kamikaazeyy/fitso-backend:latest` works without auth.
   - If the package is private, the workflow will log the server in with `GITHUB_TOKEN` on every deploy, so no permanent server-side login is needed.
