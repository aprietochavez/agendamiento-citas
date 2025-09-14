# Agendamiento de Citas (PE/CL)

Servicio **serverless** en AWS para agendar citas por país.  
Flujo: **POST /citas** → guarda en **DynamoDB** (`pending`) → publica en **SNS** → **SQS** por país → Lambda país inserta en **RDS MySQL** → emite **EventBridge** → **SQS** de confirmaciones → Lambda marca **`completed`** en DynamoDB.

## Arquitectura (resumen)

- **API Gateway (HTTP API)** → Lambdas `crearCita`, `listarPorAsegurado`
- **DynamoDB** tabla `Citas` con **GSI** `porAsegurado`
- **SNS** `CitaTopic` con filtro por atributo `paisISO` → **SQS_PE** / **SQS_CL**
- Lambdas `cita_pe` / `cita_cl` insertan en **RDS** (PE / CL) y publican a **EventBridge**
- **EventBridge** `CitaBus` → **ConfirmationsQueue** → Lambda `processConfirmations` actualiza estado a `completed`

## Requisitos

- Node.js 18+
- AWS CLI configurado (perfil con permisos)
- Dos **RDS MySQL** (visibles públicamente **solo** para pruebas):
  - **PE**: `rds-pe.xxxx.us-east-1.rds.amazonaws.com` – DB: `citas-pe`
  - **CL**: `rds-cl.xxxx.us-east-1.rds.amazonaws.com` – DB: `citas-cl`

**Tabla en cada DB:**
CREATE TABLE IF NOT EXISTS citas (
  cita_uuid      VARCHAR(36)  PRIMARY KEY,
  asegurado_id   VARCHAR(5)   NOT NULL,
  schedule_id    INT          NOT NULL,
  pais_iso       CHAR(2)      NOT NULL,
  estado         VARCHAR(20)  NOT NULL,
  fecha_creacion TIMESTAMP    NOT NULL
);

## Estructura del proyecto

src/
 ├─ handlers/               # Lambdas expuestas (API + SQS)
 │   ├─ cita.ts             # POST /citas, GET /citas/{aseguradoId}, SQS confirmaciones
 │   ├─ cita_pe.ts          # Consumer SQS_PE → inserta en RDS_PE → EventBridge
 │   └─ cita_cl.ts          # Consumer SQS_CL → inserta en RDS_CL → EventBridge
 ├─ models/
 │   └─ Cita.ts
 ├─ repositories/           # Acceso a datos
 │   ├─ cita.repository.ts
 │   ├─ citaDynamo.repository.ts
 │   └─ citaRds.repository.ts
 ├─ services/               # Lógica de negocio / integraciones
 │   ├─ cita.service.ts
 │   ├─ eventbridge.service.ts
 │   └─ sns.service.ts
 ├─ utils/
 │   ├─ http.ts
 │   └─ index.ts
 └─ config/
     └─ ddb.ts
tests/
 └─ cita.e2e.test.ts

serverless.yml
openapi.yaml
README.md

## Instalación

git clone <tu-repo>
cd <tu-repo>
npm ci

## Configuración de secretos y variables

1) **Guardar la contraseña de RDS en SSM (SecureString)**:

aws ssm put-parameter \
  --name "/citas/dev/rds/password" \
  --type "SecureString" \
  --value "<TU_PASSWORD>" \
  --overwrite \
  --region us-east-1

2) **Edita `serverless.yml`** (sección `provider.environment`) con tus datos reales de RDS y el path del secreto en SSM:
TABLE_CITAS: Citas

# RDS PE
RDS_PE_HOST: rds-pe.xxxx.us-east-1.rds.amazonaws.com
RDS_PE_PORT: "3306"
RDS_PE_DATABASE: citas-pe

# RDS CL
RDS_CL_HOST: rds-cl.xxxx.us-east-1.rds.amazonaws.com
RDS_CL_PORT: "3306"
RDS_CL_DATABASE: citas-cl

# Credenciales (user en env, password en SSM)
RDS_USER: admin
RDS_PASSWORD_SSM: /citas/${sls:stage}/rds/password

La IAM del proyecto incluye permiso **`ssm:GetParameter`** para que las Lambdas lean la contraseña en runtime (sin exponerla en variables de entorno).

## Despliegue

# Deploy
npx serverless deploy --stage dev --region us-east-1

# Ver endpoints y ARNs creados
npx serverless info --stage dev --region us-east-1

## Endpoints

**Base URL**: la que te devuelve `serverless info`  
(p.ej. `https://XXXX.execute-api.us-east-1.amazonaws.com`)

### Crear cita (POST /citas)
curl -X POST "$BASE/citas" \
  -H "Content-Type: application/json" \
  -d '{"insuredId":"01234","scheduleId":100,"countryISO":"PE"}'

**201 Created:**
{
  "citaUuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "aseguradoId": "01234",
  "scheduleId": 100,
  "paisISO": "PE",
  "estado": "pending",
  "fechaCreacion": "2025-09-13T20:40:43.983Z"
}

### Listar por asegurado (GET /citas/{aseguradoId})
curl "$BASE/citas/01234"

## Verificación rápida (post-deploy)

- **DynamoDB** (tabla `Citas`):
  - ver ítem en `pending` al crear
  - ver ítem en `completed` tras confirmación
- **SQS_PE / SQS_CL**: reciben desde SNS si `paisISO` coincide.
- **RDS**: fila insertada en DB del país correcto (`citas-pe` o `citas-cl`).
- **Logs**:
  npx serverless logs -f crearCita -t
  npx serverless logs -f citaPE -t
  npx serverless logs -f citaCL -t
  npx serverless logs -f processConfirmations -t

## Pruebas

npm test
`tests/cita.e2e.test.ts` contiene un E2E mínimo del flujo.

## Eliminación

npx serverless remove --stage dev --region us-east-1

## Troubleshooting (errores comunes)

- **`ENOTFOUND placeholder`**: host RDS inválido en `serverless.yml`.
- **`ETIMEDOUT` al conectar a RDS**: revisa el **Security Group** de RDS
  - abre el puerto **3306** al origen (solo para pruebas) o crea acceso VPC apropiado.
- **`AccessDeniedException ssm:GetParameter`**: IAM sin permiso; asegúrate de que la policy incluya `ssm:GetParameter` para el path del secreto.
- **`ER_BAD_DB_ERROR Unknown database`**: crea la base `citas-pe`/`citas-cl` y la tabla `citas` (DDL arriba).
- **Mensajes en SQS pero sin consumir**: revisa suscripciones **SNS → SQS** (filtro por `paisISO`), y que la Lambda de país esté configurada como evento de la cola correcta.

## Notas de seguridad

- En producción: ejecuta Lambdas en **subnets privadas**, **RDS** no público, y **Security Groups** mínimos.
- La contraseña se obtiene desde **SSM SecureString** en runtime.
- Versiona **`package-lock.json`** para builds reproducibles.

## Licencia

Uso interno del reto técnico.