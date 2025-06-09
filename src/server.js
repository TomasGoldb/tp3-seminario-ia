
import express from 'express';
import { tool, agent } from 'llamaindex';
import { Ollama } from '@llamaindex/ollama';
import { z } from 'zod';
import { Estudiantes } from './lib/estudiantes.js';
import './main.js'
import cors from "cors";

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
app.use(cors());
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
        const answer=formatearRespuesta(JSON.stringify(respuesta));
        // Si el resultado es objeto, convertir a string
        res.json({ respuesta: typeof respuesta === 'string' ? respuesta : answer });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

// --- Iniciar el servidor Express ---
app.listen(PORT, () => {
    console.log(`Servidor Express escuchando en el puerto ${PORT}`);
    console.log(`Accede a la API en: http://localhost:${PORT}/api/chat`);
});


const formatearRespuesta=(rawResponse) =>{
    // Paso 1: si recibimos un objeto con .respuesta, tomar ese campo, si no, usar el string directamente
    let respuestaStr = rawResponse;
    if (typeof rawResponse === 'object' && rawResponse.respuesta) {
        respuestaStr = rawResponse.respuesta;
    }

    // Paso 2: el campo respuesta es un string con JSON anidado, así que lo parseamos
    let resObj;
    try {
        resObj = JSON.parse(respuestaStr);
    } catch {
        // Si no es JSON, devolver el string tal cual
        return respuestaStr;
    }

    // Paso 3: buscamos el camino: data.result
    let textoFinal = "";
    if (resObj && resObj.data && typeof resObj.data.result === "string") {
        textoFinal = resObj.data.result.trim();
    } else {
        // fallback
        textoFinal = JSON.stringify(resObj, null, 2);
    }

    // Paso 4: elimina todo lo que esté dentro de <think>...</think>
    textoFinal = textoFinal.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Paso 5: elimina dobles saltos de línea redundantes
    textoFinal = textoFinal.replace(/\n{3,}/g, "\n\n");

    // Opcional: si termina con "Nota: ..." lo dejamos, si no, solo devolvemos el bloque limpio.
    return textoFinal;
}