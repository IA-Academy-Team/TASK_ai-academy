import { eq } from "drizzle-orm";
import { ADMIN_ROLE } from "../domain/roles.ts";
import { auth } from "../lib/auth.ts";
import { user } from "./auth-schema.ts";
import { db } from "./client.ts";
import { createProject } from "./projects-repo.ts";
import { createRequest, resolveRequest } from "./support-requests-repo.ts";
import { createTask, logHours, transitionTask } from "./tasks-repo.ts";

const ADMIN_EMAIL = "admin@aiacademy.local";
const ADMIN_PASSWORD = "dev-admin-password-1234";
const DEMO_PASSWORD = "dev-demo-password-1234";

const DEMO_USERS = [
  { email: "santiago@aiacademy.local", name: "Santiago Laguado" },
  { email: "andres@aiacademy.local", name: "Andrés Pardo" },
  { email: "jorge@aiacademy.local", name: "Jorge Cristancho" },
  { email: "valentina@aiacademy.local", name: "Valentina Ríos" },
  { email: "maria@aiacademy.local", name: "María Fernanda Ortiz" },
];

async function getUserByEmail(email: string) {
  const [row] = await db.select().from(user).where(eq(user.email, email));
  return row;
}

async function ensureUser(email: string, name: string) {
  const existing = await getUserByEmail(email);
  if (existing) return existing;
  await auth.api.signUpEmail({
    body: { email, password: DEMO_PASSWORD, name },
  });
  const created = await getUserByEmail(email);
  if (!created) throw new Error(`no se pudo crear ${email}`);
  return created;
}

async function main() {
  const existingDemo = await getUserByEmail("santiago@aiacademy.local");
  if (existingDemo) {
    console.log("seed: demo dataset already present, skipping");
    process.exit(0);
  }

  let admin = await getUserByEmail(ADMIN_EMAIL);
  if (!admin) {
    await auth.api.signUpEmail({
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: "Admin" },
    });
    await db
      .update(user)
      .set({ role: ADMIN_ROLE })
      .where(eq(user.email, ADMIN_EMAIL));
    admin = await getUserByEmail(ADMIN_EMAIL);
  }
  if (!admin) throw new Error("no se pudo crear el admin");

  const [santiago, andres, jorge, valentina, maria] = await Promise.all(
    DEMO_USERS.map((u) => ensureUser(u.email, u.name)),
  );

  // Nébula — ruta formativa con cápsulas, con tareas en todos los estados.
  const nebula = await createProject({
    name: "Nébula",
    code: "NEB-001",
    objective:
      "Actualizar la ruta formativa, producir cápsulas y dejar lista la plataforma.",
    leaderId: santiago.id,
    start: "2026-10-27",
    due: "2026-11-20",
    limitActive: 2,
    limitReview: 2,
    memberIds: [
      admin.id,
      santiago.id,
      andres.id,
      jorge.id,
      valentina.id,
      maria.id,
    ],
  });

  const nebDefinirRuta = await createTask({
    projectId: nebula.id,
    title: "Definir ruta y módulos",
    deliverable: "Mapa curricular aprobado",
    description: "Estructurar objetivos, contenidos y duración de cada módulo.",
    ownerId: santiago.id,
    priority: "alta",
    weight: 3,
    estimate: "8",
    dependencyId: null,
    due: "2026-10-30",
    supportIds: [],
    actorId: santiago.id,
  });
  await transitionTask(nebDefinirRuta.id, "activa", santiago.id, {});
  await logHours({
    taskId: nebDefinirRuta.id,
    userId: santiago.id,
    role: "owner",
    date: "2026-10-29",
    hours: "3",
  });
  await logHours({
    taskId: nebDefinirRuta.id,
    userId: santiago.id,
    role: "owner",
    date: "2026-10-30",
    hours: "4",
  });
  await transitionTask(nebDefinirRuta.id, "revision", santiago.id, {
    evidence: "Mapa curricular v1",
  });
  await transitionTask(nebDefinirRuta.id, "completada", santiago.id, {});

  const nebGuiones = await createTask({
    projectId: nebula.id,
    title: "Preparar guiones y materiales",
    deliverable: "Guiones y recursos revisados",
    description: "Guiones por cápsula y anexos didácticos para grabación.",
    ownerId: jorge.id,
    priority: "alta",
    weight: 2,
    estimate: "12",
    dependencyId: nebDefinirRuta.id,
    due: "2026-11-03",
    supportIds: [],
    actorId: jorge.id,
  });
  await transitionTask(nebGuiones.id, "activa", jorge.id, {});
  await logHours({
    taskId: nebGuiones.id,
    userId: jorge.id,
    role: "owner",
    date: "2026-11-02",
    hours: "5",
  });
  await logHours({
    taskId: nebGuiones.id,
    userId: jorge.id,
    role: "owner",
    date: "2026-11-03",
    hours: "6",
  });
  await transitionTask(nebGuiones.id, "revision", jorge.id, {
    evidence: "Guiones consolidados v2",
  });
  await transitionTask(nebGuiones.id, "completada", jorge.id, {});

  const nebCapsulas = await createTask({
    projectId: nebula.id,
    title: "Editar y cargar cápsulas",
    deliverable: "Cápsulas listas en el entorno de prueba",
    description:
      "Editar cápsulas, colocar rótulos correctos y cargarlas en la plataforma.",
    ownerId: andres.id,
    priority: "critica",
    weight: 5,
    estimate: "16",
    dependencyId: nebGuiones.id,
    due: "2026-11-06",
    supportIds: [],
    actorId: andres.id,
  });
  await transitionTask(nebCapsulas.id, "activa", andres.id, {});

  await createTask({
    projectId: nebula.id,
    title: "Validar plataforma y evaluaciones",
    deliverable: "Lista de verificación QA aprobada",
    description: "Probar navegación, evaluaciones, asistencia y certificados.",
    ownerId: valentina.id,
    priority: "alta",
    weight: 3,
    estimate: "10",
    dependencyId: nebCapsulas.id,
    due: "2026-11-12",
    supportIds: [],
    actorId: valentina.id,
  });

  await createTask({
    projectId: nebula.id,
    title: "Publicar ruta y entregar informe",
    deliverable: "Ruta publicada e informe final",
    description:
      "Publicación del contenido aprobado y cierre de documentación.",
    ownerId: santiago.id,
    priority: "media",
    weight: 2,
    estimate: "6",
    dependencyId: nebCapsulas.id,
    due: "2026-11-17",
    supportIds: [],
    actorId: santiago.id,
  });

  const nebBloqueada = await createTask({
    projectId: nebula.id,
    title: "Resolver incidencia de accesos",
    deliverable: "Accesos restablecidos para todo el equipo",
    description:
      "El proveedor de SSO reportó una falla que bloquea la carga de evidencias.",
    ownerId: maria.id,
    priority: "alta",
    weight: 1,
    estimate: "3",
    dependencyId: null,
    due: "2026-11-01",
    supportIds: [],
    actorId: maria.id,
  });
  await transitionTask(nebBloqueada.id, "bloqueada", maria.id, {});

  const nebCancelada = await createTask({
    projectId: nebula.id,
    title: "Explorar integración obsoleta",
    deliverable: "Reporte de viabilidad",
    description: "Se descartó por duplicar un proveedor ya contratado.",
    ownerId: andres.id,
    priority: "baja",
    weight: 1,
    estimate: "2",
    dependencyId: null,
    due: "2026-11-05",
    supportIds: [],
    actorId: andres.id,
  });
  await transitionTask(nebCancelada.id, "cancelada", andres.id, {});

  // Future Minds — ruta formativa infantil.
  const futureMinds = await createProject({
    name: "Future Minds",
    code: "FM-002",
    objective:
      "Diseñar la ruta formativa y materiales para el lanzamiento del programa.",
    leaderId: santiago.id,
    start: "2026-11-02",
    due: "2026-11-27",
    limitActive: 2,
    limitReview: 2,
    memberIds: [admin.id, santiago.id, valentina.id, jorge.id, maria.id],
  });

  const fmDiagnostico = await createTask({
    projectId: futureMinds.id,
    title: "Validar diagnóstico y ruta",
    deliverable: "Diagnóstico aprobado",
    description: "Definir criterios evaluativos.",
    ownerId: valentina.id,
    priority: "alta",
    weight: 3,
    estimate: "7",
    dependencyId: null,
    due: "2026-11-03",
    supportIds: [],
    actorId: valentina.id,
  });
  await transitionTask(fmDiagnostico.id, "activa", valentina.id, {});
  await logHours({
    taskId: fmDiagnostico.id,
    userId: valentina.id,
    role: "owner",
    date: "2026-11-03",
    hours: "6",
  });
  await transitionTask(fmDiagnostico.id, "revision", valentina.id, {
    evidence: "Diagnóstico final",
  });
  await transitionTask(fmDiagnostico.id, "completada", valentina.id, {});

  const fmActividades = await createTask({
    projectId: futureMinds.id,
    title: "Diseñar actividades por edades",
    deliverable: "Plan de aprendizaje por grupos",
    description: "Propuesta de formación para grupos por edades.",
    ownerId: jorge.id,
    priority: "alta",
    weight: 5,
    estimate: "14",
    dependencyId: fmDiagnostico.id,
    due: "2026-11-05",
    supportIds: [],
    actorId: jorge.id,
  });
  await transitionTask(fmActividades.id, "activa", jorge.id, {});

  await createTask({
    projectId: futureMinds.id,
    title: "Construir propuestas comerciales",
    deliverable: "Propuestas por programa",
    description: "Valores, alcance y cronograma.",
    ownerId: maria.id,
    priority: "media",
    weight: 2,
    estimate: "8",
    dependencyId: fmActividades.id,
    due: "2026-11-11",
    supportIds: [],
    actorId: maria.id,
  });

  await createTask({
    projectId: futureMinds.id,
    title: "Aprobar piezas informativas",
    deliverable: "Piezas finales listas",
    description: "Aprobación de comunicaciones.",
    ownerId: valentina.id,
    priority: "baja",
    weight: 1,
    estimate: "5",
    dependencyId: fmActividades.id,
    due: "2026-11-18",
    supportIds: [],
    actorId: valentina.id,
  });

  // Propuestas comerciales — insumos para clientes empresariales.
  const comerciales = await createProject({
    name: "Propuestas comerciales",
    code: "COM-003",
    objective: "Preparar propuestas e insumos para clientes empresariales.",
    leaderId: admin.id,
    start: "2026-10-29",
    due: "2026-11-16",
    limitActive: 2,
    limitReview: 2,
    memberIds: [admin.id, maria.id, valentina.id, santiago.id],
  });

  const comPropuesta = await createTask({
    projectId: comerciales.id,
    title: "Consolidar propuesta IA corporativa",
    deliverable: "Propuesta enviada al cliente",
    description: "Consolidar valores y contenidos.",
    ownerId: maria.id,
    priority: "alta",
    weight: 3,
    estimate: "8",
    dependencyId: null,
    due: "2026-11-02",
    supportIds: [],
    actorId: maria.id,
  });
  await transitionTask(comPropuesta.id, "activa", maria.id, {});
  await logHours({
    taskId: comPropuesta.id,
    userId: maria.id,
    role: "owner",
    date: "2026-11-02",
    hours: "9",
  });
  await transitionTask(comPropuesta.id, "revision", maria.id, {
    evidence: "Propuesta final",
  });
  await transitionTask(comPropuesta.id, "completada", maria.id, {});

  const comAnexos = await createTask({
    projectId: comerciales.id,
    title: "Preparar anexos de certificación",
    deliverable: "Anexos y modelos",
    description: "Organizar evidencias.",
    ownerId: valentina.id,
    priority: "media",
    weight: 2,
    estimate: "6",
    dependencyId: comPropuesta.id,
    due: "2026-11-06",
    supportIds: [],
    actorId: valentina.id,
  });
  await transitionTask(comAnexos.id, "activa", valentina.id, {});

  await createTask({
    projectId: comerciales.id,
    title: "Revisión final de precios",
    deliverable: "Lista de precios aprobada",
    description: "Validación económica del proyecto.",
    ownerId: santiago.id,
    priority: "alta",
    weight: 3,
    estimate: "5",
    dependencyId: comAnexos.id,
    due: "2026-11-10",
    supportIds: [],
    actorId: santiago.id,
  });

  // Solicitudes de apoyo — una pendiente, una aceptada.
  await createRequest({
    taskId: nebCapsulas.id,
    requestedBy: andres.id,
    targetUserId: jorge.id,
    mode: "invite",
    reason: "Revisión técnica de exportación y rótulos.",
  });

  const fmSupportRequest = await createRequest({
    taskId: fmActividades.id,
    requestedBy: jorge.id,
    targetUserId: maria.id,
    mode: "apply",
    reason: "Puedo ayudar con el QA de las actividades.",
  });
  await resolveRequest(fmSupportRequest.id, "aceptada", jorge.id);

  console.log(
    `seed: created admin ${ADMIN_EMAIL} (${ADMIN_PASSWORD}), ${DEMO_USERS.length} demo users (${DEMO_PASSWORD}), and 3 projects (NEB-001, FM-002, COM-003)`,
  );
  process.exit(0);
}

main();
