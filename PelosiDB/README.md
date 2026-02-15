# PelosiDB Docker Deployment

## Option 1: Using Docker Compose (Recommended)

1. Make sure your `.env` file is in the PelosiDB directory with the following variables:
```
DB_HOST=ep-quiet-dust-a8yflq7j-pooler.eastus2.azure.neon.tech
DB_NAME=neondb
DB_USER=neondb_owner
DB_PASSWORD=npg_CArg8f6RiuWH
DB_PORT=5432
DB_SSLMODE=require
```

2. Build and run with docker-compose:
```bash
docker-compose up --build
```

3. To run in detached mode:
```bash
docker-compose up -d
```

4. To stop:
```bash
docker-compose down
```

## Option 2: Using Docker CLI

1. Build the image:
```bash
docker build -t pelosidb .
```

2. Run with environment variables:
```bash
docker run -d \
  --name pelosidb \
  -p 8000:8000 \
  -e DB_HOST=ep-quiet-dust-a8yflq7j-pooler.eastus2.azure.neon.tech \
  -e DB_NAME=neondb \
  -e DB_USER=neondb_owner \
  -e DB_PASSWORD=npg_CArg8f6RiuWH \
  -e DB_PORT=5432 \
  -e DB_SSLMODE=require \
  pelosidb
```

## Option 3: Using .env file in container

If you want to use the .env file directly in the container, run:
```bash
docker run -d \
  --name pelosidb \
  -p 8000:8000 \
  --env-file .env \
  pelosidb
```

## Raspberry Pi / Linux ARM64

For Raspberry Pi (ARM architecture), use:
```bash
docker build --platform linux/arm64 -t pelosidb .
```

Then run with docker-compose or the CLI commands above.

## Verify Running Container

Check if the container is running:
```bash
docker ps
```

View logs:
```bash
docker logs pelosidb
```

Follow logs:
```bash
docker logs -f pelosidb
```

## Access the API

Once running, access the API at:
- http://localhost:8000
- API docs: http://localhost:8000/docs
