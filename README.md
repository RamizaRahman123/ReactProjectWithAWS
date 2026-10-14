# ramiza.site — 3-tier guestbook

A minimal 3-tier app (frontend, backend, MySQL) run with a single `docker-compose.yml`, deployed on EC2 behind ALB → CloudFront → Route 53.

## Architecture and ports

```
https://ramiza.site
   │  Route 53 → CloudFront (HTTPS, ACM cert)
   ▼
ALB listener :80 ──► target group :80 ──► EC2 host :80
                                            │
                    ┌───────────────────────┘  (Docker)
                    ▼
   Tier 1  frontend  (Nginx :80)     serves HTML/CSS/JS, proxies /api/* ──┐
                                                                          ▼
   Tier 2  backend   (Node :5000)    REST API, internal only ─────────────┐
                                                                          ▼
   Tier 3  db        (MySQL :3306)   data in a Docker volume, internal only
```

| Tier | Container | Port inside Docker | Published on EC2 host | Reachable from |
|---|---|---|---|---|
| Frontend | `ramiza-frontend` | 80 | **80** | ALB (target group port 80) |
| Backend | `ramiza-backend` | 5000 | no | frontend only (`frontend-net`) |
| Database | `ramiza-db` | 3306 | no | backend only (`backend-net`) |

Only port 80 is opened on the host, which matches the existing AWS setup:
- ALB target group: HTTP, port **80**, health check path `/` (or `/health`)
- `ramiza-ec2-sg`: HTTP 80 from `ramiza-alb-sg`, SSH 22 from your IP
- No security group changes are needed for 5000 or 3306. They never leave the instance.

## Project structure

```
.
├── docker-compose.yml      # all three tiers
├── .env.example            # DB credentials template (real .env is git-ignored)
├── frontend/
│   ├── Dockerfile          # nginx:1.27-alpine
│   ├── nginx.conf          # serves static files, proxies /api/ → backend:5000
│   └── public/             # index.html, style.css, app.js
├── backend/
│   ├── Dockerfile          # node:20-alpine
│   ├── package.json
│   └── server.js           # Express API: /api/health, /api/messages
├── database/
│   └── init.sql            # creates the messages table on first start
└── scripts/
    ├── ec2-setup.sh        # one-time: Docker, Compose, Buildx, Git, swap
    └── deploy.sh           # git pull + docker compose up -d --build
```

## API

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Nginx only, always 200 (good ALB health check) |
| GET | `/api/health` | Checks backend → MySQL connection |
| GET | `/api/messages` | Latest 50 messages |
| POST | `/api/messages` | Body: `{"name": "...", "message": "..."}` |

## Deploy on EC2 (Amazon Linux 2023)

1. Launch the instance in `ramiza-vpc` / `ramiza-public-1a` with `ramiza-ec2-sg` and a public IP, then log in.
2. Clone the repo and run the one-time setup:
   ```bash
   sudo dnf install -y git
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git ~/app
   cd ~/app
   sudo bash scripts/ec2-setup.sh
   exit
   ```
3. Log back in (needed for docker group permissions), then deploy:
   ```bash
   cd ~/app
   bash scripts/deploy.sh
   ```
   The first run creates `.env` with random passwords and takes a few minutes to build.
4. Test on the instance:
   ```bash
   docker compose ps          # all three "Up"; db shows "(healthy)"
   curl localhost/health      # ok
   curl localhost/api/health  # {"backend":"ok","database":"ok"}
   ```
5. Make sure the instance is registered in the `ramiza-tg` target group on port 80 and shows **healthy**, then open https://ramiza.site.

### Updating after you push to GitHub

```bash
cd ~/app && bash scripts/deploy.sh
```
The database volume (`db_data`) is kept, so messages survive redeploys.

## CloudFront settings this app needs

- Default behavior **allowed methods**: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE (the form uses POST)
- Cache policy **CachingDisabled**, origin request policy **AllViewer**

If you use a caching policy on the default behavior instead, add a second behavior for the path pattern `/api/*` with CachingDisabled and all HTTP methods allowed.

## Run locally

```bash
cp .env.example .env    # set passwords
docker compose up -d --build
```
Open http://localhost.

## Troubleshooting

| Problem | Check |
|---|---|
| `port is already allocated` on port 80 | Something else uses port 80: `docker rm -f test-site` or `sudo systemctl stop nginx` |
| Page loads but status shows backend down | `docker compose logs backend` |
| Backend up, database unreachable | `docker compose logs db` (first start takes 30–60 s) |
| Changed passwords in `.env` and DB login fails | MySQL keeps the old ones in the volume. Reset (deletes data): `docker compose down -v && docker compose up -d` |
| Edited `init.sql` but nothing changed | It only runs on an empty volume. Same reset as above. |
| `compose build requires buildx` | Rerun `sudo bash scripts/ec2-setup.sh` |
| Builds are very slow / instance freezes | Check swap is on: `free -h` |
| Site shows 403 on "Sign the guestbook" | CloudFront doesn't allow POST (see CloudFront settings) |
