# SIGNU-IDRD — Sistema Integral de Gestión de Novedades Urbanas

**Proyecto académico de práctica empresarial — Instituto Distrital de Recreación y Deporte (IDRD)**  
**Autor:** Andrés Felipe Iregui Forero · Ingeniería de Software, Fundación Universitaria Compensar · 2026-2

## Alcance y estado del producto

Este repositorio contiene un **prototipo funcional de demostración**, desarrollado como propuesta de mejoramiento para el reporte y seguimiento de novedades de mantenimiento en parques de Bogotá. **No es un servicio oficial ni está implementado en producción en el IDRD.** Usa datos de prueba.

La solución propone que la ciudadanía use un futuro módulo dentro de **VIVE IDRD**, con categoría, descripción, ubicación confirmada en el mapa y fotografía opcional. Para un piloto institucional, se plantea **registrar documentalmente el caso en ORFEO**, a través de un servicio e interfaz autorizados, y que la **Subdirección Técnica de Parques** atienda los casos que formalmente le sean asignados. La integración institucional y estas responsabilidades **no han sido validadas o aprobadas** por las áreas competentes.

En la versión de prueba: módulos simulados Inicio / Noticias / Reportes, formulario ciudadano, API, seguimiento por referencia y clave, y panel local de gestión de tickets con fotografía, prioridad y cambios de estado.

## Requisitos de entorno

- Node.js **24 o superior**, pnpm **11.x** y Windows, Linux o macOS.
- Navegador web moderno para la demostración; el uso de GPS desde un navegador requiere HTTPS y permiso explícito del dispositivo.
- Las dependencias se instalan desde el lockfile del repositorio. **No subir** `node_modules`, archivos `.env`, fotografías personales ni datos internos de pruebas.

## Ejecución recomendada (web + API + panel)

Abrir una terminal en la carpeta raíz `signu-idrd`:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm dev:demo
```

En la modalidad de demo unificada, al completar la exportación web y levantar los servicios:

- **Aplicación ciudadana:** `http://127.0.0.1:8090/`
- **Módulo de reportes:** `http://127.0.0.1:8090/reportar-novedad`
- **Salud de API:** `http://127.0.0.1:8090/health`
- **Panel local de gestión:** `http://127.0.0.1:3101/`

El proceso debe permanecer abierto mientras se hacen pruebas. En caso de error de compatibilidad de rutas de Node.js sobre Windows, verificar la instalación de Node y el script `scripts/start-demo.cjs` antes de usarlo; la versión del código fuente entregada debe incluir el ajuste de rutas del cargador `tsx` aplicado durante la práctica.

### Alternativa de desarrollo por separado

```powershell
# Terminal 1: API de desarrollo
pnpm dev:api

# Terminal 2: interfaz Expo web
pnpm dev:web
```

Con esta alternativa, la API utiliza el puerto **3100** y Expo comunica su puerto web en la terminal (normalmente 8081). La versión web debe tener correctamente configurada la URL de la API. **No incluye el panel unificado en el puerto 8090** hasta activar su modalidad correspondiente.

## Acceso privado desde un teléfono (opcional)

Durante la práctica se utilizó **Tailscale Serve** para que teléfonos de prueba pudieran abrir la demo por HTTPS cuando la red Wi-Fi local impedía conexiones directas. Esta publicación es **solo para la red privada de demostración**, no una puesta en producción. Con la demo unificada abierta:

```powershell
$ts = "$env:ProgramFiles\Tailscale\tailscale.exe"
& $ts serve --bg --https=443 http://127.0.0.1:8090
& $ts serve status
```

La URL de HTTPS depende de la cuenta y del dispositivo Tailscale del evaluador; no se incluye una dirección personal ni credenciales en este README. La aplicación de Tailscale debe estar conectada en el equipo desde el que se accede. No es necesario publicar el panel administrativo.

## Datos de prueba y recorrido de validación

1. Abrir **Reportes** y seleccionar **Iluminación** (u otra categoría), o usar **Crear un nuevo reporte**.
2. Marcar un punto de prueba en el mapa. Se puede seleccionar un parque de demostración, como **Parque Simón Bolívar**. **No usar la ubicación real de una persona** para una entrega pública.
3. Escribir una descripción ficticia (por ejemplo, «Luminaria de prueba sin iluminación»), adjuntar una fotografía no personal si se dispone de ella y enviar.
4. Guardar la referencia generada y la clave de consulta **solo para el evaluador autorizado**. No publicarlas en capturas ni en Git.
5. Desde `http://127.0.0.1:3101/`, buscar la referencia, revisar el detalle y la fotografía, asignar prioridad y cambiar el estado.
6. En la app, abrir **Consultar reporte** y comprobar que el seguimiento refleje el cambio.

**Evidencia de prueba automatizada:** el recorrido verificado fue **Pendiente de revisión → Aprobado → En atención → Resuelto**. El prototipo incluye además los estados *En revisión* y *Descartado*. El catálogo futuro de seis estados planteado en el levantamiento institucional es **diferente y no está aprobado**.

**Indicadores para un eventual piloto (aún sin medir):** porcentaje de reportes elegibles confirmados documentalmente en ORFEO, mediana del tiempo hasta la primera revisión de Parques y porcentaje de reportes revisados con ubicación utilizable.

## Limitaciones y decisiones pendientes

- Integración con la aplicación VIVE IDRD y validación del acceso al módulo.
- Definición por Gestión Documental y Relacionamiento Integral con la Ciudadanía de radicación, clasificación y reparto de reportes en ORFEO; no se permite acceso directo a tablas de la base de datos.
- Confirmación por la Subdirección Técnica de Parques de competencias, categorías, estados, prioridades y reglas de atención.
- Pruebas completas de ubicación, cámara, mapa, accesibilidad y permisos en teléfonos físicos iOS y Android.
- Definición de seguridad, autenticación, retención de fotografías y datos geográficos, monitoreo y respaldo institucional.

## Documentación de la práctica

Consultar el **Informe final de práctica empresarial SIGNU-IDRD** y el **Levantamiento de requerimientos SIGNU-IDRD (versión 0.2, propuesta preliminar académica)**. Esos documentos distinguen las pruebas del prototipo de las condiciones pendientes para implementar un piloto institucional.

*Para la entrega, el repositorio de destino debe ser indicado por el equipo del IDRD. El responsable de la entrega debe verificar que el código local más reciente, este README y los datos sintéticos de prueba correspondan a la misma versión.*
