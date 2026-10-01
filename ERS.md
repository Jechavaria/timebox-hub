# ESPECIFICACIÓN DE REQUISITOS DE SOFTWARE (ERS)

## Proyecto: TimeBox Hub — Gestor Háptico de Tiempo y Tareas

---

### 1. OBJETIVO GENERAL

Desarrollar una aplicación web progresiva (PWA), multidispositivo y multiusuario, orientada a la gestión integral del tiempo y tareas mediante la metodología Timeboxing. El sistema traduce una matriz de pendientes clasificados por ámbitos a una agenda cronológica visual interactiva con bloques físicos tridimensionales (efecto acrílico/glassmorphism), sincronización en la nube 24/7 y persistencia de archivos adjuntos.

---

### 2. ARQUITECTURA TÉCNICA Y STACK

* **Frontend:** React 18+, Vite, TypeScript.
* **Estilos:** Tailwind CSS con extensiones para Glassmorphism (`backdrop-blur-md`, bordes translúcidos, sombras volumétricas).
* **Interacción Física / Drag & Drop:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` configurado con sensores combinados (PointerSensor + TouchSensor con retardo) para garantizar soporte en PC, tablets y móviles.
* **Iconografía:** `lucide-react`.
* **Backend as a Service (BaaS):** Supabase.
  * **Persistencia Relacional:** PostgreSQL con Row Level Security (RLS) basado en `auth.uid()`.
  * **Autenticación:** Supabase Auth (Email / Password).
  * **Almacenamiento:** Supabase Storage (Bucket privado `task-attachments`).

---

### 3. MODELO DE DATOS (POSTGRESQL / SUPABASE)

1. **`areas`:** Ámbitos de vida o asignaturas.
   * `id` (uuid, PK), `user_id` (uuid, FK auth.users), `name` (text), `color` (text), `position` (int), `is_hidden` (boolean), `created_at` (timestamptz).
2. **`master_tasks`:** Tareas maestras del backlog superior.
   * `id` (uuid, PK), `user_id` (uuid, FK), `area_id` (uuid, FK), `title` (text), `description` (text), `estimated_duration_minutes` (int), `priority_order` (int), `is_completed` (boolean), `created_at` (timestamptz).
3. **`schedule_blocks`:** Bloques instanciados en la agenda cronológica.
   * `id` (uuid, PK), `user_id` (uuid, FK), `master_task_id` (uuid, FK nullable), `area_id` (uuid, FK), `title` (text), `scheduled_date` (date), `start_time` (time nullable), `planned_duration_minutes` (int), `actual_duration_minutes` (int nullable), `is_completed` (boolean), `is_routine` (boolean).
4. **`task_files`:** Archivos adjuntos vinculados a tareas.
   * `id` (uuid, PK), `user_id` (uuid, FK), `master_task_id` (uuid, FK), `file_name` (text), `file_url` (text), `file_size` (int), `file_type` (text), `uploaded_at` (timestamptz).

---

### 4. REQUISITOS FUNCIONALES (RF)

#### Módulo A: Autenticación y Privacidad

* **RF-A1:** Registro e inicio de sesión independiente por correo y contraseña.
* **RF-A2:** Aislamiento estricto de datos; cada usuario solo puede visualizar, modificar o eliminar sus propias áreas, tareas, bloques y archivos.

#### Módulo B: Matriz Superior de Ámbitos (Backlog Dinámico)

* **RF-B1:** Columnas dinámicas gestionables (crear, editar nombre/color, reordenar y eliminar).
* **RF-B2:** Filtro de visibilidad: posibilidad de ocultar columnas específicas para reducir fatiga visual.
* **RF-B3:** Renderizado de tareas maestras como "bloques físicos" con altura proporcional a la duración estimada ($1\text{ hora} \approx 60\text{ px}$).
* **RF-B4:** Reordenamiento vertical por prioridad dentro de cada columna con animaciones de desplazamiento suave.

#### Módulo C: Agenda de Timeboxing (Línea de Tiempo)

* **RF-C1:** Vista cronológica estructurada por cajones: "HOY", "MAÑANA" y vista proyectada a 7 días.
* **RF-C2 (Mecánica de Clonación):** Arrastrar un bloque desde la matriz superior hacia la agenda clona el pendiente creando un `schedule_block` sin eliminar la tarea maestra del backlog.
* **RF-C3:** Efecto magnético de apilamiento y reordenamiento de bloques dentro de la línea de tiempo.
* **RF-C4:** Aguja horaria en vivo: línea horizontal indicadora de hora actual en el cajón de "HOY", recalculada en tiempo real.
* **RF-C5:** Comportamiento ante columnas ocultas: si un ámbito está desactivado en la matriz, sus tareas programadas en la agenda diaria permanecen visibles pero adoptan un tono gris mate desaturado.

#### Módulo D: Propiedades, Rutinas y Gestión de Archivos

* **RF-D1:** Clic en bloque abre modal de propiedades para editar duración, notas y estado de completitud.
* **RF-D2:** Plantillas de rutinas cotidianas (Dormir, Transporte con origen-destino, Comida, Ocio) agregables directamente a la agenda.
* **RF-D3:** Subida de archivos multidispositivo (`.pdf`, `.docx`, `.xlsx`, `.md`, `.txt`, `.jpg`, `.png`, `.mp3`, `.m4a`) hacia Supabase Storage.
* **RF-D4:** Descarga y versionamiento de archivos: reemplazo de documentos modificados con eliminación automática de la versión previa.

#### Módulo E: Métricas y Análisis de Tiempo

* **RF-E1:** Registro de discrepancia temporal: input de duración real al marcar una tarea como completada.
* **RF-E2:** Dashboard analítico con distribución de tiempo por ámbito, cálculo de horas pico de actividad y detección visual de bloques libres.

---

### 5. REQUISITOS NO FUNCIONALES (RNF)

* **RNF-01 (Estética Háptica):** Diseño Glassmorphism mate, contraste optimizado para modo oscuro, microinteracciones táctiles y transiciones elásticas.
* **RNF-02 (Soporte Híbrido):** Compatibilidad táctil fluida en tabletas y móviles sin bloquear el scroll vertical.
* **RNF-03 (Disponibilidad 24/7):** Independencia de equipos locales mediante arquitectura en la nube (Supabase + Vercel).
