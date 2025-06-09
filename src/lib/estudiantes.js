// Gestión de estudiantes
import { readFileSync, writeFileSync } from 'fs';

const DATA_FILE = './data/alumnos.json';

class Estudiantes {
  constructor() {
    this.estudiantes = [];
  }
  
  normalizar (str){
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  cargarEstudiantesDesdeJson() {
    try {
        const data = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
        this.estudiantes = data.alumnos || [];
    } catch (e) {
        console.error("Error al leer el archivo de datos:", e);
    }
  }

  guardarEstudiantes() {
    try {
      writeFileSync(DATA_FILE, JSON.stringify({ alumnos: this.estudiantes }, null, 2));
      this.cargarEstudiantesDesdeJson();
    } catch (e) {
      console.error("Error al guardar los estudiantes:", e);
      throw new Error("No se pudo guardar la lista de estudiantes.");
    }
  }

  // TODO: Implementar método para agregar estudiante
  agregarEstudiante(nombre, apellido, curso) {
    const est={
      nombre: nombre,
      apellido: apellido,
      curso: curso
    }
    try{
    this.estudiantes.push(est);
    this.guardarEstudiantes();
    } catch(err){
      console.error("error: ",err);
    }
  }

  // TODO: Implementar método para buscar estudiante por nombre
  buscarEstudiantePorNombre(nombre) {
    let lista=this.estudiantes.filter((estudiante) => this.normalizar(estudiante.nombre) == this.normalizar(nombre));
    return lista;
  }

  // TODO: Implementar método para buscar estudiante por apellido
  buscarEstudiantePorApellido(apellido) {
    return this.estudiantes.filter(estudiante => this.normalizar(estudiante.apellido) == this.normalizar(apellido));
  }

  // TODO: Implementar método para listar estudiantes
  listarEstudiantes() {
    let li="";
    this.estudiantes.map(estudiante => {
      li+=`📌 ${estudiante.nombre} ${estudiante.apellido} - Curso: ${estudiante.curso} \n`;
    });
    return li;
  }
}


export { Estudiantes }
