package pe.orbitacampus;

import static pe.orbitacampus.Reglas.error;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import pe.orbitacampus.Reglas.Estado;
import pe.orbitacampus.Reglas.Rol;
import pe.orbitacampus.ServicioCuentas.Perfil;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ServicioSolicitudes {
    record Solicitud(long id, String codigo, long usuarioId, String usuario, long categoriaId, String categoria,
                     Long responsableId, String responsable, String titulo, String descripcion, String ubicacion,
                     String evidencia, String prioridad, Estado estado, Instant creada, Instant vence,
                     Instant resuelta, int version) {}
    record Actividad(String autor, String tipo, String mensaje, Instant fecha) {}
    record Detalle(Solicitud solicitud, List<Actividad> actividad) {}

    private static final String CONSULTA = """
            SELECT s.*,u.nombre usuario,c.nombre categoria,t.nombre responsable
            FROM solicitudes s JOIN usuarios u ON u.id=s.usuario_id
            JOIN categorias c ON c.id=s.categoria_id LEFT JOIN usuarios t ON t.id=s.responsable_id
            """;
    private final JdbcClient db;
    private final Catalogos catalogos;

    ServicioSolicitudes(JdbcClient db, Catalogos catalogos) { this.db=db; this.catalogos=catalogos; }

    private Solicitud leer(ResultSet rs) throws SQLException {
        long id = rs.getLong("id");
        Timestamp resuelta = rs.getTimestamp("resuelta");
        return new Solicitud(id,"SOL-%04d".formatted(id),rs.getLong("usuario_id"),rs.getString("usuario"),
                rs.getLong("categoria_id"),rs.getString("categoria"),rs.getObject("responsable_id",Long.class),
                rs.getString("responsable"),rs.getString("titulo"),rs.getString("descripcion"),rs.getString("ubicacion"),
                rs.getString("evidencia"),rs.getString("prioridad"),Estado.valueOf(rs.getString("estado")),
                rs.getTimestamp("creada").toInstant(),rs.getTimestamp("vence").toInstant(),
                resuelta == null ? null : resuelta.toInstant(),rs.getInt("version"));
    }

    List<Solicitud> listar(Perfil usuario) {
        String filtro = switch (usuario.rol()) {
            case ESTUDIANTE -> " WHERE s.usuario_id=:usuario";
            case TECNICO -> " WHERE s.responsable_id=:usuario";
            default -> "";
        };
        var consulta = db.sql(CONSULTA + filtro + " ORDER BY s.creada DESC,s.id DESC LIMIT 500");
        if (!filtro.isEmpty()) consulta.param("usuario",usuario.id());
        return consulta.query((rs,n) -> leer(rs)).list();
    }

    private Solicitud buscar(Perfil usuario,long id) {
        Solicitud dato=db.sql(CONSULTA+" WHERE s.id=:id").param("id",id).query((rs,n)->leer(rs)).optional()
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND,"La solicitud no existe."));
        if (usuario.rol()==Rol.ESTUDIANTE && dato.usuarioId!=usuario.id()
                || usuario.rol()==Rol.TECNICO && !Long.valueOf(usuario.id()).equals(dato.responsableId)) {
            throw error(HttpStatus.NOT_FOUND,"La solicitud no existe.");
        }
        return dato;
    }

    Detalle detalle(Perfil usuario,long id) {
        Solicitud dato = buscar(usuario,id);
        List<Actividad> actividad=db.sql("""
                SELECT u.nombre,a.tipo,a.mensaje,a.fecha FROM actividad a JOIN usuarios u ON u.id=a.autor_id
                WHERE a.solicitud_id=:id ORDER BY a.id
                """).param("id",id).query((rs,n)->new Actividad(rs.getString(1),rs.getString(2),
                rs.getString(3),rs.getTimestamp(4).toInstant())).list();
        return new Detalle(dato,actividad);
    }

    @Transactional
    public Detalle crear(Perfil usuario, Api.RegistroSolicitud entrada) {
        catalogos.validarCategoria(entrada.categoriaId());
        Instant ahora=Instant.now();
        GeneratedKeyHolder clave=new GeneratedKeyHolder();
        db.sql("""
                INSERT INTO solicitudes(usuario_id,categoria_id,titulo,descripcion,ubicacion,evidencia,prioridad,estado,creada,vence)
                VALUES(:usuario,:categoria,:titulo,:descripcion,:ubicacion,:evidencia,'MEDIA','REGISTRADA',:creada,:vence)
                """).param("usuario",usuario.id()).param("categoria",entrada.categoriaId())
                .param("titulo",Reglas.texto(entrada.titulo(),5,120,"El asunto"))
                .param("descripcion",Reglas.texto(entrada.descripcion(),10,2000,"La descripción"))
                .param("ubicacion",Reglas.texto(entrada.ubicacion(),3,150,"La ubicación"))
                .param("evidencia",Reglas.evidencia(entrada.evidencia()))
                .param("creada",Timestamp.from(ahora))
                .param("vence",Timestamp.from(ahora.plus(catalogos.horas("MEDIA"),ChronoUnit.HOURS))).update(clave);
        long id=java.util.Objects.requireNonNull(clave.getKey()).longValue();
        evento(id,usuario.id(),"ESTADO","Se registró la solicitud.");
        return detalle(usuario,id);
    }

    @Transactional
    public Detalle actualizar(Perfil usuario,long id,Api.Cambio entrada) {
        Solicitud actual=buscar(usuario,id);
        boolean supervisor=usuario.rol()==Rol.ADMIN || usuario.rol()==Rol.SUPERVISOR;
        Estado destino=entrada.estado();
        boolean transicion=destino!=actual.estado();
        if (transicion && !actual.estado().permite(destino,usuario.rol())
                || !transicion && !supervisor) {
            throw error(HttpStatus.FORBIDDEN,"Tu rol no permite ese cambio de estado.");
        }
        if (!transicion && actual.estado().terminada()) throw error(HttpStatus.CONFLICT,"La solicitud ya está resuelta o cerrada.");
        Long responsable=entrada.responsableId() == null ? actual.responsableId() : entrada.responsableId();
        String prioridad=entrada.prioridad() == null ? actual.prioridad() : entrada.prioridad();
        if (!supervisor && (!java.util.Objects.equals(responsable,actual.responsableId())
                || !prioridad.equals(actual.prioridad()))) {
            throw error(HttpStatus.FORBIDDEN,"Solo un supervisor puede modificar prioridad y responsable.");
        }
        if ((destino==Estado.ASIGNADA || destino==Estado.ATENCION || destino==Estado.RESUELTA) && responsable==null) {
            throw error(HttpStatus.BAD_REQUEST,"Selecciona un técnico responsable.");
        }
        if (responsable != null && (!java.util.Objects.equals(responsable,actual.responsableId()) || destino==Estado.ASIGNADA)) {
            if (destino!=Estado.ASIGNADA && destino!=Estado.ATENCION) throw error(HttpStatus.BAD_REQUEST,"Asigna al técnico durante la asignación o atención.");
            if (db.sql("SELECT id FROM usuarios WHERE id=:id AND rol='TECNICO' AND activo=TRUE AND verificado=TRUE FOR UPDATE")
                    .param("id",responsable).query(Long.class).optional().isEmpty()) {
                throw error(HttpStatus.BAD_REQUEST,"El responsable debe ser un técnico activo y verificado.");
            }
        }
        int horas=catalogos.horas(prioridad);
        Instant vence=prioridad.equals(actual.prioridad()) ? actual.vence() : actual.creada().plus(horas,ChronoUnit.HOURS);
        Instant resuelta=destino==Estado.RESUELTA ? Instant.now() : actual.resuelta();
        int cambios=db.sql("""
                UPDATE solicitudes SET estado=:estado,prioridad=:prioridad,responsable_id=:responsable,
                vence=:vence,resuelta=:resuelta,version=version+1 WHERE id=:id AND version=:version
                """).param("estado",destino.name()).param("prioridad",prioridad).param("responsable",responsable)
                .param("vence",Timestamp.from(vence)).param("resuelta",resuelta==null ? null : Timestamp.from(resuelta))
                .param("id",id).param("version",entrada.version()).update();
        if (cambios==0) throw error(HttpStatus.CONFLICT,"El registro cambió. Actualiza la pantalla y vuelve a intentar.");
        if (transicion) evento(id,usuario.id(),"ESTADO","Estado: "+ destino.name()+".");
        if (!prioridad.equals(actual.prioridad())) evento(id,usuario.id(),"PRIORIDAD","Prioridad: "+prioridad+".");
        if (!java.util.Objects.equals(responsable,actual.responsableId())) evento(id,usuario.id(),"ASIGNACION","Se actualizó el responsable.");
        return detalle(usuario,id);
    }

    @Transactional
    public Detalle comentar(Perfil usuario,long id,String mensaje) {
        Solicitud dato=buscar(usuario,id);
        String valido=Reglas.texto(mensaje,2,1000,"El comentario");
        int filas=db.sql("UPDATE solicitudes SET version=version+1 WHERE id=:id AND version=:version AND estado<>'CERRADA'")
                .param("id",id).param("version",dato.version()).update();
        if (filas==0) throw error(HttpStatus.CONFLICT,"La solicitud cambió o ya fue cerrada.");
        evento(id,usuario.id(),"COMENTARIO",valido);
        return detalle(usuario,id);
    }

    @Transactional
    public void retirar(Perfil usuario,long id) {
        Solicitud dato=buscar(usuario,id);
        if (dato.usuarioId()!=usuario.id() || dato.estado()!=Estado.REGISTRADA) {
            throw error(HttpStatus.CONFLICT,"Solo el solicitante puede retirar una solicitud recién registrada.");
        }
        db.sql("DELETE FROM actividad WHERE solicitud_id=:id").param("id",id).update();
        int filas=db.sql("DELETE FROM solicitudes WHERE id=:id AND version=:version AND estado='REGISTRADA'")
                .param("id",id).param("version",dato.version()).update();
        if (filas==0) throw error(HttpStatus.CONFLICT,"La solicitud cambió. Actualiza el listado.");
    }

    private void evento(long id,long autor,String tipo,String mensaje) {
        db.sql("INSERT INTO actividad(solicitud_id,autor_id,tipo,mensaje,fecha) VALUES(:id,:autor,:tipo,:mensaje,:fecha)")
                .param("id",id).param("autor",autor).param("tipo",tipo).param("mensaje",mensaje)
                .param("fecha",Timestamp.from(Instant.now())).update();
    }
}
