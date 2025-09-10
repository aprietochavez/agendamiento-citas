# Appointment Service (Serverless, Node.js, TypeScript)

Implementación de referencia para el reto de **agendamiento de citas** con AWS.

## Arquitectura (alto nivel)

- API Gateway → Lambda **appointment** (POST/GET)
- DynamoDB `Appointments` (estado: `pending` → `completed`)
- SNS `appointmentTopic` con filtros por `countryISO` → SQS `SQS_PE` / `SQS_CL`
- Lambdas **appointment_pe** / **appointment_cl** (consumidores SQS) → guardan en **RDS MySQL**
- EventBridge (evento de confirmación) → SQS `confirmationsQueue`
- Lambda **appointment** (trigger SQS) actualiza el estado en DynamoDB a `completed`

> **Nota sobre costos**: Puedes trabajar localmente con `serverless offline` y **NO** desplegar recursos
si solo necesitas demostrar el diseño. Si despliegas, recuerda ejecutar `npm run remove` al terminar.

## Comandos

```bash
npm i
npm run build
# Desarrollo local (sin AWS): 
npm run dev

# Desplegar en AWS (si decides hacerlo):
npm run deploy
# Eliminar recursos:
npm run remove
```

## Variables de entorno (para los lambdas PE/CL)

- `RDS_HOST`
- `RDS_PORT`
- `RDS_USER`
- `RDS_PASSWORD`
- `RDS_DATABASE`

## Swagger / OpenAPI

Archivo `openapi.yaml` con descripción de los endpoints.

## Endpoints

- `POST /appointments` → crea `pending` y publica a SNS
- `GET  /appointments/{insuredId}` → lista por asegurado
