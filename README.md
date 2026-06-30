# Croply — Backend API

NestJS v11 · TypeORM · PostgreSQL 16 · TypeScript

## Setup local (sin Docker)

```bash
# 1. Instalar dependencias
pnpm install

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Levantar en modo desarrollo (hot-reload)
pnpm start:dev
```

La API estará disponible en `http://localhost:3000/api`
Swagger en `http://localhost:3000/api/docs`

## Migrations

```bash
# Generar nueva migración
pnpm migration:generate src/database/migrations/NombreMigracion

# Ejecutar migraciones pendientes
pnpm migration:run

# Revertir última migración
pnpm migration:revert
```

## Tests

```bash
pnpm test           # Unit tests
pnpm test:cov       # With coverage report
pnpm test:e2e       # End-to-end tests
```
