# CampusFix

CampusFix is a small campus issue tracker and a DevOps mini project. Students can report campus problems, and the operations team can move requests through Open, In Progress, and Resolved. The project demonstrates containerization, a repeatable local environment, a CI workflow, and publishing an image to GitHub Container Registry.

## Run locally with Docker

Requirements: Docker Desktop or Docker Engine with the Compose plugin.

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). The first run creates a PostgreSQL database and inserts three sample requests. The database data stays in the `campusfix-data` volume between restarts.

Stop the app with `Ctrl+C`, or run:

```bash
docker compose down
```

To clear the sample and saved data and start with a fresh database, run:

```bash
docker compose down -v
```

## Features

- Create an issue with category, location, description, and priority
- Filter requests by status
- Move a request through Open → In Progress → Resolved, or reopen a resolved request
- Summary counts and a database health endpoint at `/api/health`
- Search, category and status filters, priority sorting, and CSV export
- Live API/database health indicator, request notifications, and 60-second refresh
- PostgreSQL persistence with parameterized database queries
- Docker Compose app and database services with health checks and a persistent data volume

## DevOps workflow

The workflow in `.github/workflows/ci.yml` runs on pull requests and pushes to `main`. It installs dependencies, checks server and browser JavaScript syntax, and builds the Docker image. When code is pushed to `main` and validation succeeds, it publishes the image to GitHub Container Registry (GHCR).

For the publish step, GitHub Actions uses the built-in `GITHUB_TOKEN`; no registry password needs to be added manually. The published image appears under the repository's **Packages** page.

## Run without Docker (optional)

Install Node.js 22+ and PostgreSQL, create a database, then set `DATABASE_URL` and `PORT` in your shell. Initialize the table using `psql "$DATABASE_URL" -f db/init.sql`, install packages with `npm install`, and start with `npm start`.

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check API and database connectivity |
| `GET` | `/api/issues` | List issues |
| `POST` | `/api/issues` | Create an issue |
| `PATCH` | `/api/issues/:id/status` | Change an issue status |

## Viva explanation

1. A developer pushes a change or opens a pull request.
2. GitHub Actions checks out the repository, installs dependencies, validates server syntax, and builds the container image.
3. A push to `main` publishes the validated image to GHCR.
4. Docker Compose runs the app and PostgreSQL together, waits for the database health check, and keeps database data in a named volume.

This is a learning/demo project. Before exposing it publicly, add authentication and authorization, configure strong credentials through deployment secrets, and restrict database access.
