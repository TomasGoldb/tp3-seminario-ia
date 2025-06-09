import { tool, agent } from "llamaindex";
import { Ollama } from "@llamaindex/ollama";
import { z } from "zod";
import { empezarChat } from "./lib/cli-chat.js";
import { Estudiantes } from "./lib/estudiantes.js";

// Configuración
const DEBUG = false;

// Instancia de la clase Estudiantes
const estudiantes = new Estudiantes();
estudiantes.cargarEstudiantesDesdeJson();

// System prompt básico
const systemPrompt = `
Rol: Asistente especializado en la gestión de estudiantes.

Objetivo: Ayudar al usuario a consultar, modificar y mantener actualizada una base de datos de alumnos.

✅ Funciones permitidas
Usá las herramientas disponibles para realizar las siguientes acciones:

Buscar estudiantes

Por nombre, apellido o fragmentos parciales de estos.

Ignorando mayúsculas, minúsculas y tildes.

Agregar nuevos estudiantes

Solicitá nombre completo y cualquier otro dato requerido (ej. DNI, email, curso).

Verificá que no exista ya un estudiante con el mismo nombre y datos clave (ej. DNI o email).

Si hay posibles duplicados, informá al usuario y pedí confirmación antes de agregar.

Mostrar la lista de estudiantes

Listado ordenado alfabéticamente por apellido (si está disponible).

Permití filtros opcionales (por curso, inicial del nombre, etc.).

🔒 Validaciones y control de errores
Validá que los datos ingresados tengan un formato correcto (por ejemplo, que el email tenga “@”, o que el DNI sea numérico).

Si falta información importante, pedí al usuario que la complete.

Si ocurre un error técnico o de conexión con la base de datos, informalo con claridad.

💬 Estilo de respuesta
Sé claro, breve y directo.

Usá un tono profesional pero accesible.

Mostrá la información en formato legible y ordenado (por ejemplo, listas con viñetas o tablas simples).

Si hay opciones múltiples, ofrecé al usuario un menú o alternativas claras para elegir.

⚠️ Consideraciones adicionales
Siempre priorizá la integridad de los datos.

Evitá modificar o eliminar información a menos que el usuario lo indique explícitamente.

No repitas acciones innecesarias ni hagas suposiciones: consultá siempre ante la duda.
`.trim();

const ollamaLLM = new Ollama({
    model: "qwen3:1.7b",
    temperature: 0.75,
    timeout: 2 * 60 * 1000, // Timeout de 2 minutos
});


// TODO: Implementar la Tool para buscar por nombre
const buscarPorNombreTool = tool({
    name: "buscarPorNombre",
    description: "Usa esta función para encontrar estudiantes por su nombre",
    parameters: z.object({
        nombre: z.string().describe("El nombre del estudiante a buscar. Debe ser un nombre válido, con su primera letra en mayuscula y el resto en minúsculas, si no lo tiene debes modificarlo para que cumpla con eso. Si no tiene alguna tilde y sabes que tiene que llevar, agregásela."),
    }),
    execute: ({ nombre }) => {
        // Tu código aquí
        const resultados = estudiantes.buscarEstudiantePorNombre(nombre);
        if (resultados.length === 0) {
            return `No se encontraron estudiantes con el nombre "${nombre}".`;
        }

    return resultados.map(est => `📌 ${est.nombre} ${est.apellido} - Curso: ${est.curso}`).join("\n");

    },
});

// TODO: Implementar la Tool para buscar por apellido
const buscarPorApellidoTool = tool({
    name: "buscarPorApellido",
    description: "Usa esta función para encontrar estudiantes por su apellido",
    parameters: z.object({
        apellido: z.string().describe("El apellido del estudiante a buscar"),
    }),
    execute: ({ apellido }) => {
       return estudiantes.buscarEstudiantePorApellido(apellido);
    },
});

// TODO: Implementar la Tool para agregar estudiante
const agregarEstudianteTool = tool({
    name: "agregarEstudiante",
    description: "Usa esta función para agregar un nuevo estudiante",
    parameters: z.object({
        nombre: z.string().describe("El nombre del estudiante. Es una sola palabra"),
        apellido: z.string().describe("El apellido del estudiante"),
        curso: z.string().describe("El curso del estudiante (ej: 4A, 4B, 5A)"),
    }),
    execute: ({ nombre, apellido, curso }) => {
        return estudiantes.agregarEstudiante(nombre, apellido, curso);
    },
});

// TODO: Implementar la Tool para listar estudiantes
const listarEstudiantesTool = tool({
    name: "listarEstudiantes",
    description: "Usa esta función para mostrar todos los estudiantes",
    parameters: z.object({}),
    execute: () => {
        return estudiantes.listarEstudiantes();
    },
});

// Configuración del agente
const elAgente = agent({
    tools: [buscarPorNombreTool, buscarPorApellidoTool, agregarEstudianteTool, listarEstudiantesTool],
    llm: ollamaLLM,
    verbose: DEBUG,
    systemPrompt: systemPrompt,
});

