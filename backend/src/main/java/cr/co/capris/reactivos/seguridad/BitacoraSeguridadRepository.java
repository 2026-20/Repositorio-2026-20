package cr.co.capris.reactivos.seguridad;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BitacoraSeguridadRepository extends JpaRepository<BitacoraSeguridad, Long> {

	// Usada por las pruebas de integracion para limpiar los registros de un
	// usuario de prueba antes de poder borrarlo (bitacora_seguridad.usuario_id
	// tiene una FK hacia usuario, ver V3__base_seguridad_sprint1.sql).
	void deleteByUsuarioId(Long usuarioId);
}
