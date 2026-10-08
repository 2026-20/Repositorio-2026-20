package cr.co.capris.reactivos.auditoria;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ResultadoVisitaRepository extends JpaRepository<ResultadoVisita, Long> {

	Optional<ResultadoVisita> findByNumConAndCodBod(String numCon, String codBod);

	// HU-024: "visitas pendientes asignadas a mi usuario" -- filtro por ruta
	// o laboratorio de la HU todavia no esta cubierto, ver javadoc del
	// controller.
	List<ResultadoVisita> findAllByAsignadoAUsuarioId(Long asignadoAUsuarioId);

	// HU-037 criterio 4 ("ruta del dia").
	List<ResultadoVisita> findAllByAsignadoAUsuarioIdAndFechaAsignada(Long asignadoAUsuarioId, LocalDate fechaAsignada);

	List<ResultadoVisita> findAllByEstadoApp(EstadoVisitaApp estadoApp);

	/**
	 * HU-037: todo lo asignado al usuario que todavia no esta FINALIZADA,
	 * SIN filtro de fecha a proposito -- la ruta tiene que funcionar offline:
	 * si se sincronizo hace una semana, lo atrasado sigue ahi hasta completarse,
	 * y lo asignado para dias siguientes ya queda descargado.
	 *
	 * JOIN sin FK (ver javadoc de Bodega) por (numCon, codBod) filtrando
	 * tipoBod = CLI: ENT/DEV/FAC son buckets virtuales de movimiento (ver
	 * TipoBodega), no puntos a visitar. Con el UNIQUE (num_con, cod_bod,
	 * tipo_bod) de V9, el filtro CLI deja como maximo una bodega por visita,
	 * asi que no se duplican filas. Es INNER JOIN: una visita sin bodega CLI
	 * ingestada no aparece en la ruta.
	 */
	@Query("""
			SELECT new cr.co.capris.reactivos.auditoria.ParadaRutaDTO(
					v.codBod, b.desBod, v.numCon, v.objCon, v.estado, v.estadoApp, v.fechaAsignada)
			FROM ResultadoVisita v
			JOIN Bodega b ON b.numCon = v.numCon AND b.codBod = v.codBod
					AND b.tipoBod = cr.co.capris.reactivos.auditoria.TipoBodega.CLI
			WHERE v.asignadoAUsuarioId = :usuarioId
					AND v.estadoApp <> cr.co.capris.reactivos.auditoria.EstadoVisitaApp.FINALIZADA
			ORDER BY v.fechaAsignada, b.desBod, v.codBod
			""")
	List<ParadaRutaDTO> findRutaPendiente(@Param("usuarioId") Long usuarioId);
}
