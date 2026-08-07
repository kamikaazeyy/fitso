# GitHub Actions workflows

## `backend.yml`

Builds, pushes, and deploys the Fitso backend.

- On every pull request to `main` that touches `server/**`: builds the Docker image (does not push).
- On every push to `main` that touches `server/**`:
  1. Builds and pushes `ghcr.io/kamikaazeyy/fitso-backend:latest` (and a SHA-tagged version) to GitHub Container Registry.
  2. Connects the GitHub runner to your Tailnet using a Tailscale OAuth client.
  3. SSHs into the server over Tailscale, pulls the new image, and restarts `backend` and `caddy`.

### Required GitHub secrets

| Secret | Description |
|--------|-------------|
| `TAILSCALE_CLIENT_ID` | Tailscale OAuth client ID. |
| `TAILSCALE_CLIENT_SECRET` | Tailscale OAuth client secret. |
| `SERVER_HOST` | Tailscale IP of this server, e.g. `100.123.46.76`. |
| `SERVER_USER` | SSH user on the server (e.g. `root`). |
| `SERVER_SSH_KEY` | Private half of an SSH key added to `~/.ssh/authorized_keys` on the server. |
| `SERVER_SSH_PORT` | (Optional) SSH port. Defaults to `22`. |

No separate GHCR token is required. The `deploy` job passes the built-in `GITHUB_TOKEN` to the server for a temporary GHCR login.

### One-time server setup

1. Add the public SSH key to `/root/.ssh/authorized_keys` (or whichever `SERVER_USER` you use).
2. Ensure the Tailscale OAuth client has these scopes:
   - **Devices → Core → Write**
   - **Auth keys → Write**
   And the ACL tag `tag:ci` is allowed.
