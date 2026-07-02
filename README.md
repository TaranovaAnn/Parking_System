# Parking System

Система контроля доступа на парковку.

## Стек

- Angular 19
- ASP.NET Core 10
- PostgreSQL 16
- SignalR
- Docker Compose

## Структура

- `parking-web` — фронтенд
- `ParkingSystem.Api` — backend API
- `docker-compose.yml` — PostgreSQL, API и frontend

## Порты

| Сервис              | Порт            | URL                     |
| ------------------- | --------------- | ----------------------- |
| PostgreSQL          | `5433`          | `localhost:5433`        |
| API                 | `5049`          | `http://localhost:5049` |
| Frontend (Docker)   | `8080`          | `http://localhost:8080` |
| Frontend (локально) | `4200` / `4300` | `http://127.0.0.1:4200` |

## Запуск через Docker

Из корня репозитория:

```bash
docker compose up --build -d
```

После сборки:

- **Приложение:** `http://localhost:8080`
- **Swagger API:** `http://localhost:5049/swagger`

Остановка:

```bash
docker compose down
```

С удалением данных БД:

```bash
docker compose down -v
```

Nginx во frontend-контейнере проксирует `/api` и `/hubs` на backend.

## Локальный запуск

### 1. PostgreSQL

```bash
docker compose up -d postgres
```

### 2. Backend

```bash
cd ParkingSystem.Api
dotnet run --launch-profile http
```

API: `http://localhost:5049`  
Swagger: `http://localhost:5049/swagger`

### 3. Frontend

```bash
cd parking-web
npm install
npm start
```

Приложение: `http://127.0.0.1:4200`

Если порт занят:

```bash
npx ng serve --host 127.0.0.1 --port 4300
```

При локальной разработке `npm start` использует proxy на API (`proxy.conf.json`).

## Тестовые пользователи

- `admin / admin123`
- `guard / guard123`
- `employee / employee123`
