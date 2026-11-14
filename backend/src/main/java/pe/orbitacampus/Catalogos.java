package pe.orbitacampus;

import static pe.orbitacampus.Reglas.error;

import java.util.List;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
class Catalogos {
    record Categoria(long id, String nombre, long areaId, String area, boolean activo) {}
    record Area(long id, String nombre) {}
    record Prioridad(String clave, String nombre, int horas) {}
    record Estado(String clave, String nombre) {}

    private final JdbcClient db;
    Catalogos(JdbcClient db) { this.db = db; }

    List<Categoria> categorias(boolean todas) {
        return db.sql("""
                SELECT c.id,c.nombre,c.area_id,a.nombre area,c.activo
                FROM categorias c JOIN areas a ON c.area_id=a.id WHERE c.activo=TRUE OR :todas=TRUE ORDER BY c.nombre
                """).param("todas", todas).query((rs,n) -> new Categoria(rs.getLong(1),rs.getString(2),
                rs.getLong(3),rs.getString(4),rs.getBoolean(5))).list();
    }

    List<Area> areas() { return db.sql("SELECT id,nombre FROM areas ORDER BY nombre").query(Area.class).list(); }
    List<Prioridad> prioridades() { return db.sql("SELECT clave,nombre,horas FROM prioridades ORDER BY horas DESC").query(Prioridad.class).list(); }
    List<Estado> estados() { return db.sql("SELECT clave,nombre FROM estados").query(Estado.class).list(); }

    void guardarCategoria(Long id, String nombre, long area, boolean activa) {
        String titulo = Reglas.texto(nombre,2,80,"La categoría");
        if (db.sql("SELECT COUNT(*) FROM areas WHERE id=:id").param("id",area).query(Long.class).single()==0) {
            throw error(HttpStatus.BAD_REQUEST,"Selecciona un área existente.");
        }
        String sql = id == null ? "INSERT INTO categorias(nombre,area_id,activo) VALUES(:nombre,:area,:activa)"
                : "UPDATE categorias SET nombre=:nombre,area_id=:area,activo=:activa WHERE id=:id";
        var query = db.sql(sql).param("nombre",titulo).param("area",area).param("activa",activa);
        if (id != null) query.param("id",id);
        if (query.update()==0) throw error(HttpStatus.NOT_FOUND,"La categoría no existe.");
    }

    void guardarArea(Long id, String nombre) {
        String titulo = Reglas.texto(nombre,2,80,"El área");
        if (id == null) {
            db.sql("INSERT INTO areas(nombre) VALUES(:nombre)").param("nombre",titulo).update();
        } else if (db.sql("UPDATE areas SET nombre=:nombre WHERE id=:id").param("nombre",titulo)
                .param("id",id).update()==0) {
            throw error(HttpStatus.NOT_FOUND,"El área no existe.");
        }
    }

    void guardarPrioridad(String clave, String nombre, int horas) {
        if (horas < 1 || horas > 720) throw error(HttpStatus.BAD_REQUEST,"El plazo debe ser de 1 a 720 horas.");
        if (db.sql("UPDATE prioridades SET nombre=:nombre,horas=:horas WHERE clave=:clave")
                .param("nombre",Reglas.texto(nombre,2,32,"La prioridad")).param("horas",horas)
                .param("clave",clave).update()==0) throw error(HttpStatus.NOT_FOUND,"La prioridad no existe.");
    }

    void guardarEstado(String clave,String nombre) {
        if (db.sql("UPDATE estados SET nombre=:nombre WHERE clave=:clave")
                .param("nombre",Reglas.texto(nombre,2,32,"El estado")).param("clave",clave)
                .update()==0) throw error(HttpStatus.NOT_FOUND,"El estado no existe.");
    }

    int horas(String clave) {
        return db.sql("SELECT horas FROM prioridades WHERE clave=:clave").param("clave",clave)
                .query(Integer.class).optional().orElseThrow(() -> error(HttpStatus.BAD_REQUEST,"La prioridad no existe."));
    }

    void validarCategoria(long id) {
        if (db.sql("SELECT COUNT(*) FROM categorias WHERE id=:id AND activo=TRUE").param("id",id)
                .query(Long.class).single()==0) throw error(HttpStatus.BAD_REQUEST,"Selecciona una categoría activa.");
    }

    @Bean ApplicationRunner catalogoInicial() {
        return args -> {
            if (areas().isEmpty()) {
                String[][] inicial = {{"Infraestructura","Mantenimiento"},{"Soporte TI","Soporte informático"},
                        {"Secretaría académica","Trámite administrativo"},{"Servicios generales","Reserva de ambientes"}};
                for (String[] par : inicial) {
                    guardarArea(null,par[0]);
                    long id=db.sql("SELECT id FROM areas WHERE nombre=:nombre").param("nombre",par[0]).query(Long.class).single();
                    guardarCategoria(null,par[1],id,true);
                }
            }
            if (prioridades().isEmpty()) {
                List.of(new Prioridad("BAJA","Baja",96),new Prioridad("MEDIA","Media",72),
                        new Prioridad("ALTA","Alta",24),new Prioridad("URGENTE","Urgente",4)).forEach(p ->
                        db.sql("INSERT INTO prioridades(clave,nombre,horas) VALUES(:clave,:nombre,:horas)")
                                .param("clave",p.clave).param("nombre",p.nombre).param("horas",p.horas).update());
            }
            if (estados().isEmpty()) {
                List.of(new Estado("REGISTRADA","Registrada"),new Estado("EVALUACION","En evaluación"),
                        new Estado("ASIGNADA","Asignada"),new Estado("ATENCION","En atención"),
                        new Estado("RESUELTA","Resuelta"),new Estado("CERRADA","Cerrada")).forEach(e ->
                        db.sql("INSERT INTO estados(clave,nombre) VALUES(:clave,:nombre)")
                                .param("clave",e.clave).param("nombre",e.nombre).update());
            }
        };
    }
}
