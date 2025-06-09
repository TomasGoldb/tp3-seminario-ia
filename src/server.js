
import express from 'express';
import { tool, agent } from 'llamaindex';
import { Ollama } from '@llamaindex/ollama';
import { z } from 'zod';
import { Estudiantes } from './lib/estudiantes.js';

// Configuración
const DEBUG = false;
const estudiantes = new Estudiantes();
estudiantes.cargarEstudiantesDesdeJson();

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
    timeout: 2 * 60 * 1000,
});

const buscarPorNombreTool = tool({
    name: "buscarPorNombre",
    description: "Usa esta función para encontrar estudiantes por su nombre",
    parameters: z.object({
        nombre: z.string().describe("El nombre del estudiante a buscar. Debe ser un nombre válido, con su primera letra en mayuscula y el resto en minúsculas, si no lo tiene debes modificarlo para que cumpla con eso. Si no tiene alguna tilde y sabes que tiene que llevar, agregásela."),
    }),
    execute: ({ nombre }) => {
        const resultados = estudiantes.buscarEstudiantePorNombre(nombre);
        if (resultados.length === 0) {
            return `No se encontraron estudiantes con el nombre "${nombre}".`;
        }
        return resultados.map(est => `📌 ${est.nombre} ${est.apellido} - Curso: ${est.curso}`).join("\n");
    },
});

const buscarPorApellidoTool = tool({
    name: "buscarPorApellido",
    description: "Usa esta función para encontrar estudiantes por su apellido",
    parameters: z.object({
        apellido: z.string().describe("El apellido del estudiante a buscar"),
    }),
    execute: ({ apellido }) => {
       const resultados = estudiantes.buscarEstudiantePorApellido(apellido);
       if (resultados.length === 0) {
           return `No se encontraron estudiantes con el apellido "${apellido}".`;
       }
       return resultados.map(est => `📌 ${est.nombre} ${est.apellido} - Curso: ${est.curso}`).join("\n");
    },
});

const agregarEstudianteTool = tool({
    name: "agregarEstudiante",
    description: "Usa esta función para agregar un nuevo estudiante",
    parameters: z.object({
        nombre: z.string().describe("El nombre del estudiante. Es una sola palabra"),
        apellido: z.string().describe("El apellido del estudiante"),
        curso: z.string().describe("El curso del estudiante (ej: 4A, 4B, 5A)"),
    }),
    execute: ({ nombre, apellido, curso }) => {
        try {
            estudiantes.agregarEstudiante(nombre, apellido, curso);
            return `Estudiante ${nombre} ${apellido} agregado al curso ${curso}.`;
        } catch (e) {
            return `Error al agregar estudiante: ${e.message}`;
        }
    },
});

const listarEstudiantesTool = tool({
    name: "listarEstudiantes",
    description: "Usa esta función para mostrar todos los estudiantes",
    parameters: z.object({}),
    execute: () => {
        return estudiantes.listarEstudiantes();
    },
});

const elAgente = agent({
    tools: [buscarPorNombreTool, buscarPorApellidoTool, agregarEstudianteTool, listarEstudiantesTool],
    llm: ollamaLLM,
    verbose: DEBUG,
    systemPrompt: systemPrompt,
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/api/chat', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'Falta el prompt (string) en el body.' });
        }
        // El agente responde con un string
        const respuesta = await elAgente.run(prompt);
        // Si el resultado es objeto, convertir a string
        res.json({ respuesta: typeof respuesta === 'string' ? respuesta : JSON.stringify(respuesta) });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

// --- Iniciar el servidor Express ---
app.listen(PORT, () => {
    console.log(`Servidor Express escuchando en el puerto ${PORT}`);
    console.log(`Accede a la API en: http://localhost:${PORT}/api/chat`);
});